import html
import json
import re
import time
from pathlib import Path
from urllib.parse import quote

from fasthtml.common import A, Button, Div, H1, Kbd, Li, Main, NotStr, Ol, P, Response, Script, Span, Strong, Textarea, to_xml
from monsterui.all import UkIcon
from .helpers import estimate_read_time_minutes, get_adjacent_posts
from .markdown_rendering import _render_markdown_fragment
from .slides import ZenSlideDeck, build_slide_reveal_units, resolve_slide_reveal_config, slide_slug

PAGE_TITLE_CLS = "vyasa-page-title text-4xl font-bold"


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
    items = [A("Posts", href="/", cls="hover:underline", **boost_attrs)]
    acc = []
    breadcrumb_parts = parts if include_current else parts[:-1]
    for part in breadcrumb_parts:
        acc.append(part)
        items.extend((
            Span(UkIcon("chevron-right", cls="w-3 h-3"), cls="opacity-50"),
            A(slug_to_title(part, abbreviations=abbreviations), href=f"/posts/{'/'.join(acc)}", cls="hover:underline", **boost_attrs),
        ))
    if include_current and current_anchor:
        items.extend((
            Span(UkIcon("chevron-right", cls="w-3 h-3"), cls="opacity-50"),
            A(
                slug_to_title(current_anchor.replace("-", " "), abbreviations=abbreviations),
                href=f"/posts/{'/'.join(parts)}#{current_anchor}",
                cls="hover:underline",
                **boost_attrs,
            ),
        ))
    return Div(*items, cls="vyasa-breadcrumbs mb-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400")


def render_post_detail(path, htmx, request, *, get_root_folder, effective_abbreviations, find_folder_note_file, slug_to_title, layout, get_blog_title, not_found, parse_frontmatter, resolve_markdown_title, from_md, logger, PathCls=Path):
    request_start = time.time()
    logger.info(f"\n[DEBUG] ########## REQUEST START: /posts/{path} ##########")
    root = get_root_folder()
    abbreviations = effective_abbreviations(root)
    file_path, pdf_path, excalidraw_path, folder_path = root / f"{path}.md", root / f"{path}.pdf", root / f"{path}.excalidraw", root / path
    if not file_path.exists():
        if folder_path.exists() and folder_path.is_dir():
            note_file = find_folder_note_file(folder_path)
            if note_file:
                from starlette.responses import RedirectResponse
                return RedirectResponse(f"/posts/{note_file.relative_to(root).with_suffix('')}", status_code=307)
        if pdf_path.exists():
            post_title = f"{slug_to_title(PathCls(path).name, abbreviations=abbreviations)} (PDF)"
            pdf_src = f"/posts/{path}.pdf"
            pdf_content = Div(_breadcrumbs(path, slug_to_title, abbreviations), Div(H1(post_title, cls=PAGE_TITLE_CLS), Button("Focus PDF", cls="pdf-focus-toggle inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors", type="button", data_pdf_focus_toggle="true", data_pdf_focus_label="Focus PDF", data_pdf_exit_label="Exit focus", aria_pressed="false"), cls="flex items-center justify-between gap-4 flex-wrap mb-6"), NotStr(f'<object data="{pdf_src}" type="application/pdf" class="pdf-viewer w-full h-[calc(100vh-14rem)] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"><p class="p-4 text-sm text-slate-600 dark:text-slate-300">PDF preview not available. <a href="{pdf_src}" class="text-blue-600 hover:underline">Download PDF</a>.</p></object>'))
            return layout(pdf_content, htmx=htmx, title=f"{post_title} - {get_blog_title()}", show_sidebar=True, toc_content=None, current_path=path, show_toc=False, auth=request.scope.get("auth"))
        return not_found(htmx, auth=request.scope.get("auth"))
    metadata, raw_content = parse_frontmatter(file_path)
    frontmatter_error = metadata.get("__frontmatter_error__")
    post_title, render_content = resolve_markdown_title(file_path, abbreviations=abbreviations)
    md_start = time.time()
    content = from_md(render_content, current_path=path)
    logger.debug(f"[DEBUG] Markdown rendering took {(time.time() - md_start) * 1000:.2f}ms")
    read_time = P(f"{estimate_read_time_minutes(render_content)}-min read", cls="vyasa-read-time text-sm text-slate-500 dark:text-slate-400 mt-2")
    copy_button = Button(
        UkIcon("clipboard", cls="w-4 h-4"),
        Span("Copy Markdown", cls="text-sm font-medium"),
        type="button",
        title="Copy raw markdown",
        onclick="(function(){const el=document.getElementById('raw-md-clipboard');const toast=document.getElementById('raw-md-toast');if(!el){return;}el.focus();el.select();const text=el.value;const done=()=>{if(!toast){return;}toast.classList.remove('opacity-0');toast.classList.add('opacity-100');setTimeout(()=>{toast.classList.remove('opacity-100');toast.classList.add('opacity-0');},1400);};if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(done).catch(()=>{document.execCommand('copy');done();});}else{document.execCommand('copy');done();}})()",
        cls="vyasa-page-action-button inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm",
    )
    present_button = A(UkIcon("monitor", cls="w-4 h-4"), "Present", href=f"/slides/{path}/slide-1", target="_blank", rel="noopener noreferrer", cls="vyasa-page-action-button inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm")
    pager = _prev_next_nav(root, path, abbreviations)
    error_chip = Span("Bad Front Matter", cls="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50/70 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200") if frontmatter_error else None
    metadata_items = [(k, v) for k, v in metadata.items() if k not in {"__frontmatter_error__", "title", "slides", "reveal"} and isinstance(v, str) and v.strip()]
    breadcrumbs = _breadcrumbs(path, slug_to_title, abbreviations)
    metadata_block = NotStr(
        '<details class="mb-8 overflow-hidden rounded-2xl border border-[rgba(126,154,144,0.28)] bg-[linear-gradient(180deg,rgba(248,250,249,0.96),rgba(241,246,244,0.92))] px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:border-[rgba(126,154,144,0.22)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.52),rgba(15,23,42,0.3))]">'
        '<summary class="cursor-pointer text-xs font-medium uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">Front Matter</summary>'
        + ''.join(
            f'<div class="space-y-1 pt-6 first:pt-4"><div class="border-t border-[rgba(126,154,144,0.16)] pb-6 first:border-t-0 first:pb-0"></div><div class="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{html.escape(k.replace("_", " "))}</div><p class="m-0 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{html.escape(v)}</p></div>'
            for k, v in metadata_items[:4]
        )
        + '</details>'
    ) if metadata_items else None
    error_toast = Div(
        Strong("Invalid front matter", cls="block mb-1"),
        P(f"{file_path}", cls="m-0 text-xs opacity-80 break-all"),
        P(frontmatter_error["message"], cls="m-0 mt-1 font-mono text-xs break-all"),
        id="frontmatter-error-toast",
        cls="fixed top-6 right-6 z-[9999] max-w-md rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-xl transition-all duration-500 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
    ) if frontmatter_error else None
    error_script = Script("setTimeout(()=>{const el=document.getElementById('frontmatter-error-toast');if(!el)return;el.classList.add('opacity-0','translate-x-8');setTimeout(()=>el.remove(),500);},3200)") if frontmatter_error else None
    post_content = Div(
        Div(
            breadcrumbs,
            Div(H1(post_title, cls=PAGE_TITLE_CLS), Div(error_chip if error_chip else Div(), present_button, copy_button, cls="flex items-center gap-2 flex-wrap"), cls="flex items-start justify-between gap-4 flex-wrap"),
            read_time,
            cls="mb-8",
        ),
        metadata_block if metadata_block else Div(),
        error_toast if error_toast else Div(),
        error_script if error_script else Div(),
        Div("Copied Raw Markdown!", id="raw-md-toast", cls="fixed top-6 right-6 bg-slate-900 text-white text-sm px-4 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300"),
        Textarea(raw_content, id="raw-md-clipboard", cls="absolute left-[-9999px] top-0 opacity-0 pointer-events-none"),
        content,
        pager if pager else Div(),
    )
    layout_start = time.time()
    result = layout(post_content, htmx=htmx, title=f"{post_title} - {get_blog_title()}", show_sidebar=True, toc_content=raw_content, current_path=path, auth=request.scope.get("auth"))
    logger.debug(f"[DEBUG] Layout generation took {(time.time() - layout_start) * 1000:.2f}ms")
    logger.debug(f"[DEBUG] ########## REQUEST COMPLETE: {(time.time() - request_start) * 1000:.2f}ms TOTAL ##########\n")
    return result


def render_drawing_detail(path, htmx, request, *, get_root_folder, not_found, get_roles_from_request, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, is_allowed, slug_to_title, effective_abbreviations, drawing_password_for, get_blog_title, layout):
    root, file_path = get_root_folder(), get_root_folder() / f"{path}.excalidraw"
    if not file_path.exists():
        return not_found(htmx, auth=request.scope.get("auth"))
    if htmx and getattr(htmx, "request", None):
        return Response(status_code=200, headers={"HX-Redirect": f"/drawings/{path}"})
    roles = get_roles_from_request(request, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list)
    if roles is not None and not is_allowed(f"/posts/{path}", roles or [], rbac_rules):
        return not_found(htmx, auth=request.scope.get("auth"))
    title = f"{slug_to_title(Path(path).name, abbreviations=effective_abbreviations(root))} (Excalidraw)"
    host_id, drawing_protected = f"excalidraw-{abs(hash(path)) & 0xFFFFFF}", bool(drawing_password_for(path))
    download_url, download_name, auth = f"/download/{path}.excalidraw", f"{Path(path).name}.excalidraw", request.scope.get("auth")
    default_user = (auth.get("name") or auth.get("email") or auth.get("username") or "") if auth else ""
    post_content = Div(Div(H1(title, cls=PAGE_TITLE_CLS), Div(Button(default_user or "Set your name", type="button", data_excalidraw_name=host_id, data_excalidraw_name_locked="1" if auth else "0", data_excalidraw_name_default=default_user, disabled=bool(auth), cls="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm " + ("opacity-70 cursor-default" if auth else "hover:bg-slate-100 dark:hover:bg-slate-800")), Button("Enable editing", type="button", data_excalidraw_toggle=host_id, cls="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"), A("Download .excalidraw", href=download_url, download=download_name, cls="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"), Button("Open Excalidraw", type="button", data_excalidraw_open_external="1", data_excalidraw_download_url=download_url, data_excalidraw_download_name=download_name, cls="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"), cls="flex items-center gap-3"), cls="flex items-center justify-between gap-3 mb-6 flex-wrap"), Div(id=host_id, cls="excalidraw-host w-full flex-1 min-h-0 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden", data_excalidraw_path=path, data_excalidraw_src=f"/posts/{path}.excalidraw", data_excalidraw_save_url=f"/api/excalidraw/{path}", data_excalidraw_unlock_url=f"/api/excalidraw/unlock/{path}", data_excalidraw_protected="1" if drawing_protected else "0"), cls="h-[calc(100vh-8rem)] flex flex-col overflow-hidden")
    return layout(post_content, htmx=htmx, title=f"{title} - {get_blog_title()}", show_sidebar=True, toc_content=None, current_path=path, show_toc=False, auth=request.scope.get("auth"), full_width=True, show_footer=False, no_scroll=True)


def render_slide_deck(path, htmx, request, *, get_root_folder, not_found, get_roles_from_auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, is_allowed, parse_frontmatter, resolve_markdown_title, slug_to_title, effective_abbreviations, from_md, layout):
    trimmed_path = path.rstrip("/")
    match = re.match(r"^(?P<doc>.+?)(?:/slide-(?P<num>\d+))?$", trimmed_path)
    if not match:
        return not_found(auth=request.scope.get("auth"))
    doc_path = match.group("doc")
    slide_token = match.group("num")
    if slide_token is None:
        from starlette.responses import RedirectResponse
        return RedirectResponse(f"/slides/{doc_path}/{slide_slug(1)}", status_code=307)
    slide_num = int(slide_token)
    root, file_path = get_root_folder(), get_root_folder() / f"{doc_path}.md"
    if not file_path.exists():
        return not_found(auth=request.scope.get("auth"))
    roles = get_roles_from_auth(request.scope.get("auth"), rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list)
    if not is_allowed(f"/posts/{doc_path}", roles or [], rbac_rules):
        return not_found(auth=request.scope.get("auth"))
    metadata, raw_content = parse_frontmatter(file_path)
    abbreviations = effective_abbreviations(root)
    title, render_content = resolve_markdown_title(file_path, abbreviations=abbreviations)
    reveal_config = resolve_slide_reveal_config(metadata)
    deck = ZenSlideDeck(render_content or "")
    overview = deck.outline(doc_path)
    total = len(deck.slides) + 2
    slide_num = max(1, min(slide_num, total))
    doc_href = f"/posts/{doc_path}" if slide_num == 1 else deck.doc_href(doc_path, len(deck.slides) if slide_num == total else slide_num - 1)
    nav_link = lambda label, href, side: Button(Kbd(label, cls="vyasa-zen-nav-kbd"), type="button", data_zen_nav=side, data_zen_href=href, cls="vyasa-zen-nav-key")
    nav_state = {"index": slide_num, "total": total, "left": f"/slides/{doc_path}/{slide_slug(slide_num - 1)}", "right": f"/slides/{doc_path}/{slide_slug(slide_num + 1)}"}
    left_control = nav_link("←", nav_state["left"], "left") if nav_state["index"] > 1 else Kbd("←", cls="vyasa-zen-nav-kbd opacity-30 pointer-events-none")
    right_control = nav_link("→", nav_state["right"], "right") if nav_state["index"] < nav_state["total"] else Kbd("→", cls="vyasa-zen-nav-kbd opacity-30 pointer-events-none")
    nav = Div(
        left_control,
        Button(f'{nav_state["index"]} / {nav_state["total"]}', type="button", data_zen_overview_toggle="true", cls="underline underline-offset-4"),
        right_control,
        cls="inline-flex items-center gap-4",
    )
    overview_rows = [
        f'<tr><td class="pr-4 align-top whitespace-nowrap opacity-70"><span class="inline-flex items-center gap-1">{to_xml(UkIcon("file-text", cls="w-4 h-4"))}<span>{item["index"]}</span></span></td>'
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
        card = title if slide_num == 1 else "Fin"
        content = Div(
            Div(nav, cls="flex justify-center"),
            Div(card, cls="vyasa-zen-title min-h-[60vh] flex items-center justify-center"),
            overview_panel,
            Script(f"window.__vyasaZen={json.dumps(nav_state)};"),
            Script(src="/static/present.js", type="module"),
            cls="vyasa-zen-content w-full mx-auto space-y-8",
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
            Div(H1(title, cls="vyasa-zen-title"), cls="flex justify-center"),
            Div(nav, cls="flex justify-center"),
            slide_body,
            overview_panel,
            Script(f"window.__vyasaZen={json.dumps(nav_state)};"),
            Script(src="/static/present.js", type="module"),
            cls="vyasa-zen-content w-full mx-auto space-y-8",
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
        read_time = P(f"{estimate_read_time_minutes(render_content)}-min read", cls="vyasa-read-time text-sm text-slate-500 dark:text-slate-400 mt-2")
        copy_button = Button(
            UkIcon("clipboard", cls="w-4 h-4"),
            Span("Copy Markdown", cls="text-sm font-medium"),
            type="button",
            title="Copy raw markdown",
            onclick="(function(){const el=document.getElementById('raw-md-clipboard');const toast=document.getElementById('raw-md-toast');if(!el){return;}el.focus();el.select();const text=el.value;const done=()=>{if(!toast){return;}toast.classList.remove('opacity-0');toast.classList.add('opacity-100');setTimeout(()=>{toast.classList.remove('opacity-100');toast.classList.add('opacity-0');},1400);};if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(done).catch(()=>{document.execCommand('copy');done();});}else{document.execCommand('copy');done();}})()",
            cls="vyasa-page-action-button inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm",
        )
        present_button = A(UkIcon("monitor", cls="w-4 h-4"), "Present", href=f"/slides/{index_path}/slide-1", target="_blank", rel="noopener noreferrer", cls="vyasa-page-action-button inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm")
        page_content = Div(
            Div(
                Div(H1(page_title, cls=PAGE_TITLE_CLS), Div(present_button, copy_button, cls="flex items-center gap-2 flex-wrap"), cls="flex items-start justify-between gap-4 flex-wrap"),
                read_time,
                cls="mb-8",
            ),
            Div("Copied Raw Markdown!", id="raw-md-toast", cls="fixed top-6 right-6 bg-slate-900 text-white text-sm px-4 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300"),
            Textarea(raw_content, id="raw-md-clipboard", cls="absolute left-[-9999px] top-0 opacity-0 pointer-events-none"),
            from_md(render_content, current_path=index_path),
        )
        result = layout(page_content, htmx=htmx, title=f"{page_title} - {blog_title}", show_sidebar=True, toc_content=raw_content, current_path=index_path, auth=request.scope.get("auth"))
        if logger:
            logger.debug("Request complete path=/ route=index total={:.2f}ms", (time.time() - request_start) * 1000)
        return result
    result = layout(Div(H1(f"Welcome to {blog_title}!", cls="text-4xl font-bold tracking-tight mb-8"), NotStr('<h2 class="text-lg font-medium text-slate-700 dark:text-slate-300 mb-4">Quick start tutorial</h2><ul class="list-disc pl-6 space-y-2 text-base text-slate-600 dark:text-slate-400 mb-4"><li>Use the left sidebar to browse the files and folders in your blog. Use <kbd>Z</kbd> to toggle the sidebar.</li><li>Use the right sidebar to browse the table of contents of the current file. Use <kbd>X</kbd> to toggle the sidebar.</li><li>In docs view, use <kbd>C</kbd> to toggle the fold all and unfold all sections button.</li><li>Open a markdown file to preview it instantly.</li></ul>'), P("More guides, examples, and documentation are available at ", A("vyasa.yeshwanth.com", href="https://vyasa.yeshwanth.com", cls="text-slate-900 dark:text-slate-100 underline underline-offset-4"), ".", cls="text-base text-slate-600 dark:text-slate-400"), cls="w-full"), htmx=htmx, title=f"Home - {blog_title}", show_sidebar=True, auth=request.scope.get("auth"))
    if logger:
        logger.debug("Request complete path=/ route=index total={:.2f}ms", (time.time() - request_start) * 1000)
    return result
