import json
import re
import time
from pathlib import Path
from types import SimpleNamespace

from fasthtml.common import A, Button, Div, H1, Kbd, NotStr, Response, Script, Span, to_xml
from monsterui.all import UkIcon
from .content_tree import ContentTree
from .document_pages import (
    PAGE_TITLE_CLS,
    DocumentPage,
    copy_raw_button,
    copy_raw_nodes,
    document_header,
    frontmatter_error_nodes,
    frontmatter_metadata_block,
    present_button,
)
from .helpers import content_path_for_slug, content_root_and_relative, content_url_for_slug, get_adjacent_posts, strip_more_marker
from .markdown_rendering import _render_markdown_fragment
from .slides import ZenSlideDeck, build_slide_reveal_units, resolve_slide_reveal_config, slide_slug

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
        items.append(
            Span(
                Span(UkIcon("chevron-right", cls="w-3 h-3"), cls="opacity-50"),
                A(
                    slug_to_title(part, abbreviations=abbreviations),
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


def render_post_detail(path, htmx, request, *, get_root_folder, effective_abbreviations, find_folder_note_file, slug_to_title, layout, get_blog_title, not_found, parse_frontmatter, resolve_markdown_title, from_md, logger, PathCls=Path):
    request_start = time.time()
    logger.info(f"\n[DEBUG] ########## REQUEST START: /posts/{path} ##########")
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
    pdf_path = document.path if document.kind == "pdf" else None
    if document.kind != "markdown":
        if document.kind == "pdf":
            post_title = f"{slug_to_title(PathCls(path).name, abbreviations=abbreviations)} (PDF)"
            pdf_src = content_url_for_slug(path, suffix=".pdf")
            pdf_content = Div(_breadcrumbs(path, slug_to_title, abbreviations), Div(H1(post_title, cls=PAGE_TITLE_CLS), Button("Focus PDF", cls="pdf-focus-toggle inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors", type="button", data_pdf_focus_toggle="true", data_pdf_focus_label="Focus PDF", data_pdf_exit_label="Exit focus", aria_pressed="false"), cls="flex items-center justify-between gap-4 flex-wrap mb-6"), NotStr(f'<object data="{pdf_src}" type="application/pdf" class="pdf-viewer w-full h-[calc(100vh-14rem)] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"><p class="p-4 text-sm text-slate-600 dark:text-slate-300">PDF preview not available. <a href="{pdf_src}" class="text-blue-600 hover:underline">Download PDF</a>.</p></object>'))
            return DocumentPage(post_title, path, pdf_content, show_toc=False).render(layout, htmx=htmx, blog_title=get_blog_title(), auth=request.scope.get("auth"))
        return not_found(htmx, auth=request.scope.get("auth"))
    metadata, raw_content = parse_frontmatter(file_path)
    frontmatter_error = metadata.get("__frontmatter_error__")
    post_title, render_content = resolve_markdown_title(file_path, abbreviations=abbreviations)
    md_start = time.time()
    content = from_md(strip_more_marker(render_content), current_path=path)
    logger.debug(f"[DEBUG] Markdown rendering took {(time.time() - md_start) * 1000:.2f}ms")
    pager = _prev_next_nav(root, relative_slug, abbreviations)
    breadcrumbs = _breadcrumbs(path, slug_to_title, abbreviations)
    error_chip, error_toast, error_script = frontmatter_error_nodes(file_path, frontmatter_error)
    actions = (error_chip if error_chip else Div(), present_button(path), copy_raw_button("Copy Markdown", "raw-md-clipboard", "raw-md-toast"))
    post_content = Div(
        document_header(post_title, render_content, actions=actions, breadcrumbs=breadcrumbs, file_path=file_path),
        frontmatter_metadata_block(metadata) or Div(),
        error_toast if error_toast else Div(),
        error_script if error_script else Div(),
        *copy_raw_nodes(raw_content),
        content,
        pager if pager else Div(),
    )
    layout_start = time.time()
    result = DocumentPage(post_title, path, post_content, toc_source=raw_content).render(layout, htmx=htmx, blog_title=get_blog_title(), auth=request.scope.get("auth"))
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
            Script(src="/static/present.js", type="module"),
            cls="vyasa-zen-content w-full mx-auto space-y-8",
            style=f"--vyasa-zen-slide-max-width: {slide_width};" if slide_width else None,
        )
    else:
        slide_markdown = deck.body(slide_num - 1)
        reveal_units = build_slide_reveal_units(
            slide_markdown,
            render_fragment=_render_markdown_fragment,
            current_path=doc_path,
            config=reveal_config,
        ) if reveal_config.enabled else []
        if reveal_units:
            slide_body = Div(
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
            Script(src="/static/present.js", type="module"),
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
        page_content = Div(
            document_header(page_title, render_content, actions=(present_button(index_path), copy_raw_button("Copy Markdown", "raw-md-clipboard", "raw-md-toast")), file_path=index_file),
            *copy_raw_nodes(raw_content),
            from_md(render_content, current_path=index_path),
        )
        result = DocumentPage(page_title, index_path, page_content, toc_source=raw_content).render(layout, htmx=htmx, blog_title=blog_title, auth=request.scope.get("auth"))
        if logger:
            logger.debug("Request complete path=/ route=index total={:.2f}ms", (time.time() - request_start) * 1000)
        return result
    raw_content = _fallback_home_markdown(blog_title)
    fallback_title = f"Welcome to {blog_title}!"
    fallback_body = Div(
        document_header(fallback_title, raw_content, actions=(present_button(FALLBACK_HOME_SLUG), copy_raw_button("Copy Markdown", "raw-md-clipboard", "raw-md-toast"))),
        *copy_raw_nodes(raw_content),
        from_md(raw_content, current_path=FALLBACK_HOME_SLUG),
        cls="w-full",
    )
    result = DocumentPage("Home", FALLBACK_HOME_SLUG, fallback_body, toc_source=raw_content).render(layout, htmx=htmx, blog_title=blog_title, auth=request.scope.get("auth"))
    if logger:
        logger.debug("Request complete path=/ route=index total={:.2f}ms", (time.time() - request_start) * 1000)
    return result
