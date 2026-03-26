import html
import json
import re
import time
from pathlib import Path
from urllib.parse import quote

from fasthtml.common import A, Button, Div, H1, Li, NotStr, Ol, P, Response, Script, Strong, Textarea
from monsterui.all import UkIcon
from .helpers import get_adjacent_posts


def _prev_next_nav(root, current_path, abbreviations):
    prev_item, next_item = get_adjacent_posts(root, current_path, abbreviations=abbreviations)
    if not prev_item and not next_item:
        return None
    prev_link = A(f"← {prev_item['title']}", href=prev_item["href"], cls="vyasa-prev-link") if prev_item else Div()
    next_link = A(f"{next_item['title']} →", href=next_item["href"], cls="vyasa-next-link") if next_item else Div()
    return Div(prev_link, next_link, cls="vyasa-prev-next")


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
            pdf_content = Div(Div(H1(post_title, cls="text-4xl font-bold"), Button("Focus PDF", cls="pdf-focus-toggle inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors", type="button", data_pdf_focus_toggle="true", data_pdf_focus_label="Focus PDF", data_pdf_exit_label="Exit focus", aria_pressed="false"), cls="flex items-center justify-between gap-4 flex-wrap mb-6"), NotStr(f'<object data="{pdf_src}" type="application/pdf" class="pdf-viewer w-full h-[calc(100vh-14rem)] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"><p class="p-4 text-sm text-slate-600 dark:text-slate-300">PDF preview not available. <a href="{pdf_src}" class="text-blue-600 hover:underline">Download PDF</a>.</p></object>'))
            return layout(pdf_content, htmx=htmx, title=f"{post_title} - {get_blog_title()}", show_sidebar=True, toc_content=None, current_path=path, show_toc=False, auth=request.scope.get("auth"))
        return not_found(htmx, auth=request.scope.get("auth"))
    metadata, raw_content = parse_frontmatter(file_path)
    post_title, render_content = resolve_markdown_title(file_path, abbreviations=abbreviations)
    md_start = time.time()
    content = from_md(render_content, current_path=path)
    logger.debug(f"[DEBUG] Markdown rendering took {(time.time() - md_start) * 1000:.2f}ms")
    copy_button = Button(UkIcon("clipboard", cls="w-4 h-4"), type="button", title="Copy raw markdown", onclick="(function(){const el=document.getElementById('raw-md-clipboard');const toast=document.getElementById('raw-md-toast');if(!el){return;}el.focus();el.select();const text=el.value;const done=()=>{if(!toast){return;}toast.classList.remove('opacity-0');toast.classList.add('opacity-100');setTimeout(()=>{toast.classList.remove('opacity-100');toast.classList.add('opacity-0');},1400);};if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(done).catch(()=>{document.execCommand('copy');done();});}else{document.execCommand('copy');done();}})()", cls="inline-flex items-center justify-center p-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500 transition-colors")
    present_button = A(UkIcon("monitor", cls="w-4 h-4"), "Present", href=f"/slides/{path}", target="_blank", rel="noopener noreferrer", cls="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500 transition-colors text-sm") if bool(metadata.get("slides", False)) else None
    pager = _prev_next_nav(root, path, abbreviations)
    post_content = Div(Div(H1(post_title, cls="text-4xl font-bold"), present_button, copy_button, cls="flex items-center gap-2 flex-wrap mb-8"), Div("Copied Raw Markdown!", id="raw-md-toast", cls="fixed top-6 right-6 bg-slate-900 text-white text-sm px-4 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300"), Textarea(raw_content, id="raw-md-clipboard", cls="absolute left-[-9999px] top-0 opacity-0 pointer-events-none"), content, pager if pager else Div())
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
    post_content = Div(Script("document.body.dataset.forceFullNav='1';"), Div(H1(title, cls="text-4xl font-bold"), Div(Button(default_user or "Set your name", type="button", data_excalidraw_name=host_id, data_excalidraw_name_locked="1" if auth else "0", data_excalidraw_name_default=default_user, disabled=bool(auth), cls="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm " + ("opacity-70 cursor-default" if auth else "hover:bg-slate-100 dark:hover:bg-slate-800")), Button("Enable editing", type="button", data_excalidraw_toggle=host_id, cls="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"), A("Download .excalidraw", href=download_url, download=download_name, cls="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"), Button("Open Excalidraw", type="button", data_excalidraw_open_external="1", data_excalidraw_download_url=download_url, data_excalidraw_download_name=download_name, cls="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"), cls="flex items-center gap-3"), cls="flex items-center justify-between gap-3 mb-6 flex-wrap"), Div(id=host_id, cls="excalidraw-host w-full flex-1 min-h-0 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden", data_excalidraw_path=path, data_excalidraw_src=f"/posts/{path}.excalidraw", data_excalidraw_save_url=f"/api/excalidraw/{path}", data_excalidraw_unlock_url=f"/api/excalidraw/unlock/{path}", data_excalidraw_protected="1" if drawing_protected else "0"), cls="h-[calc(100vh-8rem)] flex flex-col overflow-hidden")
    return layout(post_content, htmx=htmx, title=f"{title} - {get_blog_title()}", show_sidebar=True, toc_content=None, current_path=path, show_toc=False, auth=request.scope.get("auth"), nav_posts_menu=True, full_width=True, show_footer=False, no_scroll=True)


def render_slide_deck(path, request, *, get_root_folder, not_found, get_roles_from_auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, is_allowed, parse_frontmatter, slug_to_title, effective_abbreviations, from_md, asset_url):
    root, file_path = get_root_folder(), get_root_folder() / f"{path}.md"
    if not file_path.exists():
        return not_found(auth=request.scope.get("auth"))
    roles = get_roles_from_auth(request.scope.get("auth"), rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list)
    if not is_allowed(f"/posts/{path}", roles or [], rbac_rules):
        return not_found(auth=request.scope.get("auth"))
    metadata, raw_content = parse_frontmatter(file_path)
    title = metadata.get("title", slug_to_title(Path(path).name, abbreviations=effective_abbreviations(root)))
    safe_title = html.escape(f"{title} - Slides")
    reveal_block = metadata.get("reveal", {}) if isinstance(metadata.get("reveal"), dict) else {}
    reveal_cfg = {**reveal_block, **{k[7:]: v for k, v in metadata.items() if k.startswith("reveal_")}}
    theme = str(reveal_cfg.pop("theme", "black")).strip() or "black"
    highlight_theme = str(reveal_cfg.pop("highlightTheme", "monokai")).strip() or "monokai"
    theme = theme if re.fullmatch(r"[a-zA-Z0-9_-]+", theme) else "black"
    highlight_theme = highlight_theme if re.fullmatch(r"[a-zA-Z0-9_-]+", highlight_theme) else "monokai"
    md_separator, md_separator_vertical = str(reveal_cfg.pop("separator", "^---$")), str(reveal_cfg.pop("separatorVertical", "^--$"))
    reveal_cfg.pop("separatorNotes", None)
    slide_padding = str(reveal_cfg.pop("slidePadding", "1.25rem")).strip() or "1.25rem"
    reveal_cfg.pop("margin", None)
    font_size = str(reveal_cfg.pop("fontSize", "18px")).strip() or "18px"
    right_advances_all = reveal_cfg.pop("rightAdvancesAll", False)
    if isinstance(right_advances_all, str):
        right_advances_all = right_advances_all.strip().lower() in {"1", "true", "yes", "on"}
    if right_advances_all and "navigationMode" not in reveal_cfg:
        reveal_cfg["navigationMode"] = "linear"
    if not re.fullmatch(r"[0-9]+(?:\.[0-9]+)?(?:px|rem|em|vw|vh|%)", font_size):
        font_size = "18px"
    reveal_init_json, sep_re, sep_v_re = json.dumps({"hash": True, "slideNumber": True, "margin": 0, **reveal_cfg}, ensure_ascii=False), re.compile(md_separator), re.compile(md_separator_vertical)

    def _split_slide_groups(md_text):
        groups, group, buf, in_fence, fence_char, fence_len = [], [], [], False, "", 0
        for line in md_text.splitlines():
            s = line.strip()
            m = re.match(r"^(```+|~~~+)", s)
            if m:
                tok = m.group(1)
                if not in_fence:
                    in_fence, fence_char, fence_len = True, tok[0], len(tok)
                elif tok[0] == fence_char and len(tok) >= fence_len:
                    in_fence = False
            if not in_fence and sep_re.fullmatch(s):
                group.append("\n".join(buf).strip()); groups.append([x for x in group if x.strip()]); group, buf = [], []; continue
            if not in_fence and sep_v_re.fullmatch(s):
                group.append("\n".join(buf).strip()); buf = []; continue
            buf.append(line)
        group.append("\n".join(buf).strip()); groups.append([x for x in group if x.strip()])
        return [g for g in groups if g]

    def _render_slide_fragment(md_fragment):
        from fasthtml.common import to_xml
        return re.sub(r"<link[^>]*sidenote\\.css[^>]*>", "", to_xml(from_md(md_fragment, current_path=path)), count=1)

    sections = []
    for group in _split_slide_groups(raw_content):
        sections.append(f"<section>{_render_slide_fragment(group[0])}</section>" if len(group) == 1 else f"<section>{''.join(f'<section>{_render_slide_fragment(item)}</section>' for item in group)}</section>")
    slides_markup = "".join(sections) if sections else "<section><h2>Empty deck</h2></section>"
    page_html = f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{safe_title}</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.css"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/{theme}.css" id="theme"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/highlight/{highlight_theme}.css"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"><style>:root{{--vyasa-slide-padding:{slide_padding};--vyasa-slide-font-size:{font_size};}}.reveal{{font-size:var(--vyasa-slide-font-size);}}.reveal .slides section{{padding:var(--vyasa-slide-padding);}}.reveal pre code{{max-height:none;}}.reveal .slides section.present{{left:0!important;}}.reveal section img{{max-height:72vh;}}.reveal .mermaid-container,.reveal .d2-container{{position:relative;border:1px solid rgba(15,23,42,.18)!important;border-radius:10px!important;box-shadow:none!important;background:transparent!important;padding:14px!important;box-sizing:border-box!important;left:auto!important;transform:none!important;margin:0 auto!important;width:85%!important;max-width:85%!important;height:85%!important;max-height:85%!important;min-height:0!important;align-self:center!important;}}.reveal .mermaid-controls,.reveal .d2-controls{{display:none!important;}}.reveal .mermaid-wrapper,.reveal .d2-wrapper{{overflow:visible;min-height:0!important;height:100%!important;width:100%!important;justify-content:center!important;align-items:center!important;}}.reveal .mermaid-wrapper svg,.reveal .d2-wrapper svg{{width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;}}.reveal .slides section:has(.mermaid-container),.reveal .slides section:has(.d2-container){{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;padding:0!important;width:100%!important;height:100%!important;min-height:100%!important;}}.reveal .slides section:has(.mermaid-container)>*,.reveal .slides section:has(.d2-container)>*{{width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;}}.reveal .mermaid,.reveal .mermaid svg{{font-size:16px!important;line-height:1.2!important;}}.reveal .mermaid svg text,.reveal .mermaid svg tspan{{fill:#1f2937!important;}}.reveal .mermaid .nodeLabel,.reveal .mermaid .edgeLabel,.reveal .mermaid foreignObject div,.reveal .mermaid foreignObject span,.reveal .mermaid foreignObject p{{color:#1f2937!important;fill:#1f2937!important;}}.reveal .code-copy-button,.reveal .code-block [id$="-toast"]{{display:none!important;}}.reveal .code-block textarea{{position:absolute!important;left:-9999px!important;top:0!important;opacity:0!important;pointer-events:none!important;}}</style></head><body><div class="reveal"><div class="slides">{slides_markup}</div></div><script src="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.js"></script><script src="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/highlight/highlight.js"></script><script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script><script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script><script type="module" src="{asset_url('/static/scripts.js')}"></script><script>const cfg = {reveal_init_json};cfg.plugins = [RevealHighlight];Reveal.initialize(cfg);function runMathPass(node) {{if (typeof renderMathInElement !== 'function') return;renderMathInElement(node || document.body, {{delimiters: [{{left: '$$', right: '$$', display: true}},{{left: '$', right: '$', display: false}},{{left: '\\\\[', right: '\\\\]', display: true}},{{left: '\\\\(', right: '\\\\)', display: false}}],throwOnError: false}});}}runMathPass(document.body);Reveal.on('ready', () => runMathPass(document.body));Reveal.on('slidechanged', (e) => runMathPass(e.currentSlide || document.body));</script></body></html>"""
    return Response(page_html, media_type="text/html; charset=utf-8")


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
        page_content = Div(H1(page_title, cls="text-4xl font-bold mb-8"), from_md(render_content, current_path=index_path))
        result = layout(page_content, htmx=htmx, title=f"{page_title} - {blog_title}", show_sidebar=True, toc_content=raw_content, current_path=index_path, auth=request.scope.get("auth"))
        if logger:
            logger.debug("Request complete path=/ route=index total={:.2f}ms", (time.time() - request_start) * 1000)
        return result
    result = layout(Div(H1(f"Welcome to {blog_title}!", cls="text-4xl font-bold tracking-tight mb-8"), P("Quick start tutorial", cls="text-lg font-medium text-slate-700 dark:text-slate-300 mb-4"), Ol(Li("Use the sidebar to browse the files and folders in your blog."), Li("Open a markdown file to preview it instantly."), Li("Create an ", Strong("index.md"), " or ", Strong("README.md"), " in your blog directory to replace this page with your own landing page."), cls="list-decimal pl-6 space-y-2 text-base text-slate-600 dark:text-slate-400 mb-4"), P("More guides, examples, and documentation are available at ", A("vyasa.yeshwanth.com", href="https://vyasa.yeshwanth.com", cls="text-slate-900 dark:text-slate-100 underline underline-offset-4"), ".", cls="text-base text-slate-600 dark:text-slate-400"), cls="w-full"), htmx=htmx, title=f"Home - {blog_title}", show_sidebar=True, auth=request.scope.get("auth"))
    if logger:
        logger.debug("Request complete path=/ route=index total={:.2f}ms", (time.time() - request_start) * 1000)
    return result
