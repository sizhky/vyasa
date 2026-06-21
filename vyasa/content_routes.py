import json
import re
import time
from pathlib import Path
from types import SimpleNamespace

from fasthtml.common import A, Button, Div, H1, Kbd, NotStr, Response, Script, Span, to_xml
from monsterui.all import UkIcon
from .assets import asset_url, bundle_asset_nodes_for_collector
from .config import get_config
from .content_tree import ContentTree
from .document_pages import (
    DocumentActionContext,
    DocumentPage,
    document_header,
    frontmatter_error_nodes,
    frontmatter_metadata_block,
    resolve_document_actions,
)
from .extensions import get_extension_runtime, refresh_extension_runtime
from .helpers import content_location, content_path_for_slug, content_root_and_relative, content_slug_for_path, content_url_for_slug, expand_markdown_includes_for_reading, get_adjacent_posts, strip_more_marker
from .runtime_context import traced
from .extensions_builtin.markdown.renderer import _render_markdown_fragment
from .extensions_builtin.slides.deck import ZenSlideDeck, build_slide_reveal_units, resolve_slide_reveal_config, slide_slug

FALLBACK_HOME_SLUG = "__home__"


def _resolve_slide_width(metadata):
    value = str((metadata or {}).get("slide_width", "") or "").strip()
    if not value or len(value) > 40:
        return None
    if not re.fullmatch(r"[0-9a-zA-Z.%(),\-+\s]+", value):
        return None
    return value


def _fallback_home_markdown(blog_title):
    return (
        "## Quick start tutorial\n\n"
        "- Use the left sidebar to browse the files and folders in your blog. Use `Z` to toggle the sidebar.\n"
        "- Use the right sidebar to browse the table of contents of the current file. Use `X` to toggle the sidebar.\n"
        "- In docs view, use `C` to toggle the fold all and unfold all sections button.\n"
        "- Use the <span class=\"vyasa-page-action-button vyasa-inline-action-demo\"><uk-icon icon=\"monitor\" class=\"w-4 h-4\"></uk-icon><span>Present</span></span> button to launch slide view for any document.\n"
        "\n"
        "More guides, examples, and documentation are available at [vyasa.yeshwanth.dev](https://vyasa.yeshwanth.dev).\n"
    )


def _prev_next_nav(root, current_path, abbreviations):
    prev_item, next_item = get_adjacent_posts(root, current_path, abbreviations=abbreviations)
    if not prev_item and not next_item:
        return None
    prev_link = A(f"← {prev_item['title']}", href=prev_item["href"], cls="vyasa-prev-link") if prev_item else Div()
    next_link = A(f"{next_item['title']} →", href=next_item["href"], cls="vyasa-next-link") if next_item else Div()
    return Div(prev_link, next_link, cls="vyasa-prev-next")


def _breadcrumbs(path, slug_to_title, abbreviations, *, disable_boost=False, include_current=False, current_anchor=None):
    parts = [part for part in str(path).split("/") if part]
    if len(parts) < 2:
        return None
    boost_attrs = {"hx_boost": "false"} if disable_boost else {}
    items = [Span(A("Posts", href="/", cls="hover:underline whitespace-nowrap", **boost_attrs), cls="inline-flex min-w-0 items-center")]
    acc = []
    breadcrumb_parts = parts if include_current else parts[:-1]
    for part in breadcrumb_parts:
        acc.append(part)
        # the first segment may carry the git ref as `alias@ref`; show only the
        # alias (the ref already appears as a badge), but keep it in the href.
        label_part = part.split("@", 1)[0] if "@" in part else part
        items.append(
            Span(
                Span(UkIcon("chevron-right", cls="w-3 h-3"), cls="opacity-50"),
                A(
                    slug_to_title(label_part, abbreviations=abbreviations),
                    href=content_url_for_slug("/".join(acc)),
                    cls="hover:underline whitespace-nowrap",
                    **boost_attrs,
                ),
                cls="inline-flex min-w-0 items-center gap-2",
            )
        )
    if include_current and current_anchor:
        items.append(
            Span(
                Span(UkIcon("chevron-right", cls="w-3 h-3"), cls="opacity-50"),
                A(
                    slug_to_title(current_anchor.replace("-", " "), abbreviations=abbreviations),
                    href=content_url_for_slug("/".join(parts), fragment=current_anchor),
                    cls="hover:underline whitespace-nowrap",
                    **boost_attrs,
                ),
                cls="inline-flex min-w-0 items-center gap-2",
            )
        )
    return Div(*items, cls="vyasa-breadcrumbs mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400")


def _ref_badge(name):
    """Small branch/tag chip shown in a document's meta line."""
    return Span(UkIcon("git-branch", cls="w-3.5 h-3.5"), Span(name or "default"), cls="vyasa-ref-badge inline-flex items-center gap-1")


def _current_branch_for(root):
    """The checked-out branch when `root` is a working clone, else "" (plain
    folders / bare mirrors have no working branch to surface)."""
    from .content_backend import classify_root

    try:
        rc = classify_root(root)
        return rc.current_branch if rc.kind == "clone" else ""
    except Exception:
        return ""


def _render_ref_markdown(ref_doc, *, path, htmx, request, slug_to_title, layout, get_blog_title, from_md, not_found):
    """Render a markdown document served from a git ref (object store)."""
    abbreviations = {}
    breadcrumbs = _breadcrumbs(path, slug_to_title, abbreviations)
    ref_badge = _ref_badge(ref_doc.ref)
    if not ref_doc.found:
        body = Div(
            H1(f"Not present on {ref_doc.ref}", cls="mb-2"),
            Span(f"“{ref_doc.relative}” does not exist on this ref.", cls="opacity-70"),
            cls="w-full",
        )
        return DocumentPage(f"Not on {ref_doc.ref}", path, body, toc_source="").render(layout, htmx=htmx, blog_title=get_blog_title(), auth=request.scope.get("auth"))
    from .content_backend import ref_read_scope

    # current_path stays the slug string (URLs/escaping/etc. expect a str); the
    # ref-backed VirtualPath rides a contextvar so dependent-file readers resolve
    # siblings (KG packs, palettes, ...) from the same git ref, not the worktree.
    with ref_read_scope(ref_doc.vpath):
        rendered_body = from_md(strip_more_marker(ref_doc.body), current_path=path)
    content = Div(
        document_header(ref_doc.title, ref_doc.body, actions=(), breadcrumbs=breadcrumbs, meta_extra=ref_badge),
        rendered_body,
        cls="w-full",
    )
    return DocumentPage(ref_doc.title, path, content, toc_source=ref_doc.body).render(layout, htmx=htmx, blog_title=get_blog_title(), auth=request.scope.get("auth"))


def _uncommitted_banner(root, file_path):
    """Show an indicator when a working clone serves an uncommitted file from
    disk (its checked-out branch). Per-file: only flags the page being viewed."""
    from .content_backend import classify_root, uncommitted_paths

    try:
        rc = classify_root(root)
        if rc.kind != "clone":
            return None
        rel = Path(file_path).resolve().relative_to(Path(root).resolve()).as_posix()
    except (ValueError, OSError):
        return None
    if rel not in uncommitted_paths(rc):
        return None
    return Div(
        Span(UkIcon("git-commit", cls="w-4 h-4"), cls="opacity-70"),
        Span("Uncommitted draft - this page shows the working tree, not a committed ref."),
        cls="vyasa-uncommitted-banner mb-3 flex items-center gap-2 text-xs rounded-md px-3 py-2 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200",
    )


def _render_ref_other_kind(ref_doc, *, path, htmx, request, slug_to_title, layout, get_blog_title, not_found):
    """Dispatch a non-markdown git-ref document (pdf/html/...) to its kind
    renderer. The renderer builds asset URLs from the ref-carrying slug, so
    the ref-aware byte routes serve the blob from objects."""
    runtime = get_extension_runtime() or refresh_extension_runtime(get_config().get_extensions_config())
    renderer = runtime.document_renderers.get(ref_doc.kind) if runtime else None
    if renderer is None:
        return None
    document = SimpleNamespace(kind=ref_doc.kind, path=ref_doc.vpath, folder_note=None, slug=ref_doc.slug)
    return renderer(
        SimpleNamespace(
            document=document,
            path=path,
            htmx=htmx,
            request=request,
            auth=request.scope.get("auth"),
            layout=layout,
            blog_title=get_blog_title(),
            breadcrumbs=_breadcrumbs(path, slug_to_title, {}),
            slug_to_title=slug_to_title,
            abbreviations={},
        )
    )


@traced("total")
def render_post_detail(path, htmx, request, *, get_root_folder, effective_abbreviations, find_folder_note_file, slug_to_title, layout, get_blog_title, not_found, parse_frontmatter, resolve_markdown_title, from_md, logger, PathCls=Path):
    request_start = time.time()
    logger.info(f"\n[DEBUG] ########## REQUEST START: /posts/{path} ##########")
    ref_override = request.query_params.get("ref", "") if hasattr(request, "query_params") else ""
    root_id, root_path, ref, relative = content_location(path, ref_override=ref_override)
    if root_id and ref and "@" not in Path(path.strip("/")).parts[0]:
        # ref arrived as `?ref=` on a named root — fold it back into the
        # internal `alias@ref` slug so the render + sidebar pipeline is uniform.
        rel = relative.as_posix()
        packed = f"{root_id}@{ref.replace('/', ':')}"
        path = f"{packed}/{rel}" if rel and rel != "." else packed
    if root_path is not None:
        from .content_tree import resolve_ref_document
        ref_doc = resolve_ref_document(path, ref_override=ref_override)
        if ref_doc is not None:  # served from git objects (bare, or non-current ref)
            if ref_doc.found and ref_doc.kind != "markdown":
                rendered = _render_ref_other_kind(ref_doc, path=path, htmx=htmx, request=request, slug_to_title=slug_to_title, layout=layout, get_blog_title=get_blog_title, not_found=not_found)
                if rendered is not None:
                    return rendered
            return _render_ref_markdown(ref_doc, path=path, htmx=htmx, request=request, slug_to_title=slug_to_title, layout=layout, get_blog_title=get_blog_title, from_md=from_md, not_found=not_found)
        if ref:
            # disk-served but slug carries @ref (plain folder, or clone on its
            # current branch): strip the @ref so the disk pipeline resolves it.
            rel = relative.as_posix()
            path = (f"{root_id}/{rel}" if root_id else rel).strip("/")
    root, relative_path = content_root_and_relative(path)
    if root is None:
        return not_found(htmx, auth=request.scope.get("auth"))
    relative_slug = relative_path.as_posix()
    abbreviations = effective_abbreviations(root)
    document = ContentTree.from_runtime().resolve_document(path)
    if not document:
        file_path = content_path_for_slug(path, ".md")
        document = SimpleNamespace(kind="markdown", path=file_path, folder_note=None, slug=path) if file_path and file_path.exists() else None
    if not document or document.kind == "folder":
        return not_found(htmx, auth=request.scope.get("auth"))
    if document.folder_note:
        from starlette.responses import RedirectResponse
        return RedirectResponse(content_url_for_slug(document.slug), status_code=307)
    file_path = document.path if document.kind == "markdown" else None
    if document.kind != "markdown":
        runtime = get_extension_runtime()
        if runtime is None:
            runtime = refresh_extension_runtime(get_config().get_extensions_config())
        renderer = runtime.document_renderers.get(document.kind) if runtime is not None else None
        if renderer:
            return renderer(
                SimpleNamespace(
                    document=document,
                    path=path,
                    htmx=htmx,
                    request=request,
                    auth=request.scope.get("auth"),
                    layout=layout,
                    blog_title=get_blog_title(),
                    breadcrumbs=_breadcrumbs(path, slug_to_title, abbreviations),
                    slug_to_title=slug_to_title,
                    abbreviations=abbreviations,
                )
            )
        return not_found(htmx, auth=request.scope.get("auth"))
    metadata, raw_content = parse_frontmatter(file_path)
    frontmatter_error = metadata.get("__frontmatter_error__")
    post_title, render_content = resolve_markdown_title(file_path, abbreviations=abbreviations)
    read_source = expand_markdown_includes_for_reading(render_content, current_path=path, root_folder=root)
    md_start = time.time()
    content = from_md(strip_more_marker(render_content), current_path=path)
    logger.debug(f"[DEBUG] Markdown rendering took {(time.time() - md_start) * 1000:.2f}ms")
    pager = _prev_next_nav(root, relative_slug, abbreviations)
    breadcrumbs = _breadcrumbs(path, slug_to_title, abbreviations)
    error_chip, error_toast, error_script = frontmatter_error_nodes(file_path, frontmatter_error)
    relative_file_path = content_slug_for_path(file_path, strip_suffix=False) or file_path.name
    document_actions, action_aux_nodes = resolve_document_actions(
        DocumentActionContext(
            title=post_title,
            current_path=path,
            raw_content=raw_content,
            file_path=str(file_path),
            relative_file_path=relative_file_path,
        )
    )
    actions = ((error_chip,) if error_chip else ()) + document_actions
    uncommitted_banner = _uncommitted_banner(root, file_path)
    disk_branch = _current_branch_for(root)
    post_content = Div(
        document_header(post_title, read_source, actions=actions, breadcrumbs=breadcrumbs, file_path=file_path, meta_extra=_ref_badge(disk_branch) if disk_branch else None),
        uncommitted_banner if uncommitted_banner else Div(),
        frontmatter_metadata_block(metadata) or Div(),
        error_toast if error_toast else Div(),
        error_script if error_script else Div(),
        *action_aux_nodes,
        content,
        pager if pager else Div(),
    )
    layout_start = time.time()
    result = DocumentPage(post_title, path, post_content, file_path=str(file_path), toc_source=raw_content).render(layout, htmx=htmx, blog_title=get_blog_title(), auth=request.scope.get("auth"))
    logger.debug(f"[DEBUG] Layout generation took {(time.time() - layout_start) * 1000:.2f}ms")
    logger.debug(f"[DEBUG] ########## REQUEST COMPLETE: {(time.time() - request_start) * 1000:.2f}ms TOTAL ##########\n")
    return result


def render_slide_deck(path, htmx, request, *, get_root_folder, not_found, get_roles_from_auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, is_allowed, parse_frontmatter, resolve_markdown_title, slug_to_title, effective_abbreviations, from_md, layout):
    trimmed_path = path.rstrip("/")
    match = re.match(r"^(?P<doc>.+?)(?:/slide-(?P<num>\d+))?$", trimmed_path)
    if not match:
        return not_found(auth=request.scope.get("auth"))
    doc_path = match.group("doc")
    slide_token = match.group("num")
    if slide_token is None:
        from starlette.responses import RedirectResponse
        return RedirectResponse(content_url_for_slug(doc_path, prefix="/slides", suffix=f"/{slide_slug(1)}"), status_code=307)
    slide_num = int(slide_token)
    if doc_path == FALLBACK_HOME_SLUG:
        root = get_root_folder()
        abbreviations = effective_abbreviations(root)
        title = f"Welcome to {get_root_folder().name.upper()}!"
        render_content = _fallback_home_markdown(get_root_folder().name.upper())
        reveal_config = resolve_slide_reveal_config({})
        slide_width = None
        deck = ZenSlideDeck(render_content)
        overview = deck.outline(doc_path)
        total = len(deck.slides) + 2
        slide_num = max(1, min(slide_num, total))
        doc_href = "/"
    else:
        root, _ = content_root_and_relative(doc_path)
        if root is None:
            return not_found(auth=request.scope.get("auth"))
        file_path = content_path_for_slug(doc_path, ".md")
        if not file_path or not file_path.exists():
            return not_found(auth=request.scope.get("auth"))
        roles = get_roles_from_auth(request.scope.get("auth"), rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list)
        if not is_allowed(f"/posts/{doc_path}", roles or [], rbac_rules):
            return not_found(auth=request.scope.get("auth"))
        metadata, raw_content = parse_frontmatter(file_path)
        abbreviations = effective_abbreviations(root)
        title, render_content = resolve_markdown_title(file_path, abbreviations=abbreviations)
        reveal_config = resolve_slide_reveal_config(metadata)
        slide_width = _resolve_slide_width(metadata)
        deck = ZenSlideDeck(render_content or "")
        overview = deck.outline(doc_path)
        total = len(deck.slides) + 2
        slide_num = max(1, min(slide_num, total))
        doc_href = content_url_for_slug(doc_path) if slide_num == 1 else deck.doc_href(doc_path, len(deck.slides) if slide_num == total else slide_num - 1)
    nav_link = lambda label, href, side: Button(Kbd(label, cls="vyasa-zen-nav-kbd"), type="button", data_zen_nav=side, data_zen_href=href, cls="vyasa-zen-nav-key")
    nav_state = {"index": slide_num, "total": total, "left": content_url_for_slug(doc_path, prefix="/slides", suffix=f"/{slide_slug(slide_num - 1)}"), "right": content_url_for_slug(doc_path, prefix="/slides", suffix=f"/{slide_slug(slide_num + 1)}")}
    left_control = nav_link("←", nav_state["left"], "left") if nav_state["index"] > 1 else Kbd("←", cls="vyasa-zen-nav-kbd opacity-30 pointer-events-none")
    right_control = nav_link("→", nav_state["right"], "right") if nav_state["index"] < nav_state["total"] else Kbd("→", cls="vyasa-zen-nav-kbd opacity-30 pointer-events-none")
    nav = Div(
        left_control,
        Button(f'{nav_state["index"]} / {nav_state["total"]}', type="button", data_zen_overview_toggle="true", cls="underline underline-offset-4"),
        right_control,
        cls="inline-flex items-center gap-4",
    )
    overview_rows = [
        f'<tr data-zen-overview-href="{item["href"]}" class="cursor-pointer"><td class="pr-4 align-top whitespace-nowrap opacity-70"><span class="inline-flex items-center gap-1">{to_xml(UkIcon("file-text", cls="w-4 h-4"))}<span>{item["index"]}</span></span></td>'
        f'<td class="align-top"><a href="{item["href"]}" hx-get="{item["href"]}" hx-target="#main-content" '
        f'hx-swap="outerHTML show:window:top settle:0.1s" hx-push-url="true">{item["text"]}</a></td></tr>'
        for item in overview
    ]
    overview_panel = Div(
        Div(
            NotStr('<table class="uk-table uk-table-striped uk-table-hover uk-table-divider uk-table-middle w-full"><tbody>' + "".join(overview_rows) + '</tbody></table>'),
            cls="w-[min(78rem,calc(100vw-3rem))] max-h-[70vh] overflow-y-auto rounded-xl border bg-white/95 dark:bg-slate-900/95 p-4 shadow-2xl pointer-events-auto",
        ),
        id="slide-overview",
        cls="hidden fixed inset-0 z-30 flex items-center justify-center p-6 pointer-events-none",
    )
    if slide_num == 1 or slide_num == total:
        card = title if slide_num == 1 else "स्वस्ति"
        content = Div(
            Div(nav, cls="flex justify-center"),
            Div(
                A(card, href=doc_href, hx_boost="false", cls="underline underline-offset-8 hover:no-underline"),
                cls="vyasa-zen-title min-h-[60vh] flex items-center justify-center",
            ),
            overview_panel,
            Script(f"window.__vyasaZen={json.dumps(nav_state)};"),
            cls="vyasa-zen-content w-full mx-auto space-y-8",
            style=f"--vyasa-zen-slide-max-width: {slide_width};" if slide_width else None,
        )
    else:
        slide_markdown = deck.body(slide_num - 1)
        runtime = get_extension_runtime()
        if runtime is None:
            runtime = refresh_extension_runtime(get_config().get_extensions_config())
        asset_collector = runtime.new_asset_collector() if runtime else None
        reveal_units = build_slide_reveal_units(
            slide_markdown,
            render_fragment=lambda body, current_path=None, slide_mode=False: _render_markdown_fragment(
                body,
                current_path=current_path,
                slide_mode=slide_mode,
                asset_collector=asset_collector,
            ),
            current_path=doc_path,
            config=reveal_config,
        ) if reveal_config.enabled else []
        if reveal_units:
            slide_body = Div(
                *bundle_asset_nodes_for_collector(asset_collector, runtime=runtime),
                *[
                    Div(
                        NotStr(unit["html"]),
                        cls="vyasa-reveal-unit",
                        data_reveal_index=str(index),
                        data_reveal_state=(
                            "visible"
                            if (
                                (unit.get("style") or reveal_config.style) in {"none", "instant"}
                                or (reveal_config.policy == "step" and unit.get("kind") == "heading")
                                or (
                                    reveal_config.policy == "step"
                                    and not any(u.get("kind") == "heading" for u in reveal_units)
                                    and index == 0
                                )
                            )
                            else "hidden"
                        ),
                        data_reveal_kind=str(unit.get("kind") or "content"),
                        data_reveal_style=str(unit.get("style") or reveal_config.style),
                        data_reveal_delay=str(unit.get("delay") or ""),
                        data_reveal_duration=str(unit.get("duration") or ""),
                        data_reveal_distance=str(unit.get("distance") or ""),
                        data_reveal_easing=str(unit.get("easing") or ""),
                    )
                    for index, unit in enumerate(reveal_units)
                ],
                cls="vyasa-zen-slide-body",
                data_reveal_mode="stagger",
                data_reveal_policy=reveal_config.policy,
                data_reveal_unit=reveal_config.unit,
                data_reveal_style=reveal_config.style,
                style="; ".join(
                    part for part in (
                        f"--vyasa-reveal-stagger: {reveal_config.stagger_ms}ms",
                        f"--vyasa-reveal-duration: {reveal_config.duration_ms}ms",
                        f"--vyasa-reveal-distance: {reveal_config.distance}",
                        f"--vyasa-reveal-easing: {reveal_config.easing}",
                    ) if part
                ),
            )
        else:
            slide_body = Div(from_md(slide_markdown, current_path=doc_path, slide_mode=True), cls="vyasa-zen-slide-body")
        content = Div(
            _breadcrumbs(doc_path, slug_to_title, abbreviations, disable_boost=True, include_current=True, current_anchor=deck.anchor(slide_num - 1)),
            Div(H1(title, cls="vyasa-zen-deck-title"), cls="flex justify-center"),
            Div(nav, cls="flex justify-center"),
            slide_body,
            overview_panel,
            Script(f"window.__vyasaZen={json.dumps(nav_state)};"),
            cls="vyasa-zen-content w-full mx-auto space-y-8",
            style=f"--vyasa-zen-slide-max-width: {slide_width};" if slide_width else None,
        )
    return layout(content, htmx=htmx, title=f"{title} - Zen", show_sidebar=False, toc_content=None, current_path=doc_path, show_toc=False, auth=request.scope.get("auth"), htmx_nav=False, show_footer=False, slide_mode=True)


def find_index_file(get_root_folder):
    root = get_root_folder()
    for file in root.iterdir():
        if file.is_file() and file.suffix == ".md" and file.stem.lower() == "index":
            return file
    for file in root.iterdir():
        if file.is_file() and file.suffix == ".md" and file.stem.lower() == "readme":
            return file
    return None


def render_index(htmx, request, *, get_blog_title, find_index_file_fn, parse_frontmatter, resolve_markdown_title, get_root_folder, from_md, layout, not_found=None, logger=None):
    request_start = time.time()
    if logger:
        logger.debug("Request start path=/ route=index")
    blog_title = get_blog_title()
    index_file = find_index_file_fn()
    if index_file:
        _, raw_content = parse_frontmatter(index_file)
        page_title, render_content = resolve_markdown_title(index_file)
        index_path = str(index_file.relative_to(get_root_folder()).with_suffix(""))
        relative_file_path = content_slug_for_path(index_file, strip_suffix=False) or index_file.name
        document_actions, action_aux_nodes = resolve_document_actions(
            DocumentActionContext(
                title=page_title,
                current_path=index_path,
                raw_content=raw_content,
                file_path=str(index_file),
                relative_file_path=relative_file_path,
            )
        )
        page_content = Div(
            document_header(page_title, render_content, actions=document_actions, file_path=index_file),
            *action_aux_nodes,
            from_md(render_content, current_path=index_path),
        )
        result = DocumentPage(page_title, index_path, page_content, toc_source=raw_content).render(layout, htmx=htmx, blog_title=blog_title, auth=request.scope.get("auth"))
        if logger:
            logger.debug("Request complete path=/ route=index total={:.2f}ms", (time.time() - request_start) * 1000)
        return result
    raw_content = _fallback_home_markdown(blog_title)
    fallback_title = f"Welcome to {blog_title}!"
    document_actions, action_aux_nodes = resolve_document_actions(
        DocumentActionContext(
            title=fallback_title,
            current_path=FALLBACK_HOME_SLUG,
            raw_content=raw_content,
        )
    )
    fallback_body = Div(
        document_header(fallback_title, raw_content, actions=document_actions),
        *action_aux_nodes,
        from_md(raw_content, current_path=FALLBACK_HOME_SLUG),
        cls="w-full",
    )
    result = DocumentPage("Home", FALLBACK_HOME_SLUG, fallback_body, toc_source=raw_content).render(layout, htmx=htmx, blog_title=blog_title, auth=request.scope.get("auth"))
    if logger:
        logger.debug("Request complete path=/ route=index total={:.2f}ms", (time.time() - request_start) * 1000)
    return result
