import re
from pathlib import Path

from fasthtml.common import *
from monsterui.all import *
from .helpers import resolve_heading_anchor


def _scope_css(css_text, scope):
    css_text = re.sub(r"/\*.*?\*/", "", css_text, flags=re.DOTALL)
    out, decls, i, n = [], [], 0, len(css_text)
    while i < n:
        while i < n and css_text[i].isspace():
            i += 1
        start, depth = i, 0
        while i < n:
            ch = css_text[i]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
            elif ch == ";" and depth == 0:
                i += 1
                break
            elif ch == "}" and depth < 0:
                break
            i += 1
            if depth == 0 and i < n and css_text[i - 1] == "}":
                break
        chunk = css_text[start:i].strip()
        if not chunk:
            continue
        if "{" not in chunk:
            decls.append(chunk)
            continue
        head, body = chunk.split("{", 1)
        body = body.rsplit("}", 1)[0]
        head = head.strip()
        if head.startswith("@media") or head.startswith("@supports") or head.startswith("@container"):
            out.append(f"{head} {{ {_scope_css(body, scope)} }}")
        elif head.startswith("@"):
            out.append(chunk)
        else:
            selectors = ", ".join(
                scope if sel.strip() == ":root" else f"{scope} {sel.strip()}"
                for sel in head.split(",") if sel.strip()
            )
            out.append(f"{selectors} {{{body}}}")
    if decls:
        out.insert(0, f"{scope} {{ {' '.join(decls)} }}")
    return "\n".join(out)


def collapsible_sidebar(icon, title, items_list, is_open=False, data_sidebar=None, shortcut_key=None, extra_content=None, scroll_target="container"):
    sidebar_kind = (data_sidebar or title or "sidebar").strip().lower().replace(" ", "-")
    summary_content = [Span(UkIcon(icon, cls="w-5 h-5 block"), cls="flex items-center justify-center w-5 h-5 shrink-0 leading-none"), Span(title, cls="flex-1 leading-none")]
    if shortcut_key:
        summary_content.append(Kbd(shortcut_key, cls="kbd-key px-2.5 py-1.5 text-xs font-mono font-semibold bg-gradient-to-b from-slate-50 to-slate-200 dark:from-slate-700 dark:to-slate-900 text-slate-800 dark:text-slate-200 rounded-md border-2 border-slate-300 dark:border-slate-600 shadow-[0_2px_0_0_rgba(0,0,0,0.1),inset_0_1px_0_0_rgba(255,255,255,0.5)] dark:shadow-[0_2px_0_0_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.1)]"))
    common_frost_style = "bg-white/20 dark:bg-slate-950/70 backdrop-blur-lg border border-slate-900/10 dark:border-slate-700/25 ring-1 ring-white/20 dark:ring-slate-900/30 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)] dark:shadow-[0_28px_70px_-45px_rgba(2,6,23,0.85)]"
    summary_classes = f"vyasa-sidebar-toggle vyasa-sidebar-toggle-{sidebar_kind} vyasa-ui-text flex items-center gap-2 font-semibold cursor-pointer py-2.5 px-3 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 rounded-lg select-none list-none {common_frost_style} min-h-[56px]"
    content_classes = f"vyasa-sidebar-body vyasa-sidebar-body-{sidebar_kind} p-3 {common_frost_style} rounded-lg max-h-[calc(100vh-18rem)] flex flex-col overflow-hidden min-h-0" if scroll_target == "list" else f"vyasa-sidebar-body vyasa-sidebar-body-{sidebar_kind} p-3 {common_frost_style} rounded-lg overflow-x-auto overflow-y-auto max-h-[calc(100vh-18rem)] sidebar-scroll-container"
    list_classes = "list-none pt-2 sidebar-scroll-container" if scroll_target == "list" else "list-none pt-4"
    extra_content = extra_content or []
    content_id = "sidebar-scroll-container" if scroll_target != "list" else None
    return Details(Summary(*summary_content, cls=summary_classes, style="margin: 0 0 0.5rem 0;"), Div(*extra_content, (Div(Ul(*items_list, cls=list_classes, id=("sidebar-scroll-container" if scroll_target == "list" else None)), cls="min-w-0 flex-1 min-h-0 overflow-x-auto overflow-y-auto") if scroll_target == "list" else Ul(*items_list, cls=list_classes, id=content_id)), cls=content_classes, id=content_id, style="will-change: auto;"), open=is_open, data_sidebar=data_sidebar, cls=f"vyasa-sidebar-card vyasa-sidebar-card-{sidebar_kind}", style="will-change: auto;")


def extract_toc(content, strip_inline_markdown, text_to_anchor, unique_anchor):
    content_no_code = re.sub(r"^```.*?^```", "", content, flags=re.MULTILINE | re.DOTALL)
    content_no_code = re.sub(r"^~~~.*?^~~~", "", content_no_code, flags=re.MULTILINE | re.DOTALL)
    headings, counts = [], {}
    for match in re.finditer(r"^(#{1,6})\s+(.+)$", content_no_code, flags=re.MULTILINE):
        raw_text = strip_inline_markdown(match.group(2).strip())
        text, anchor = resolve_heading_anchor(raw_text, counts)
        headings.append((len(match.group(1)), text, anchor))
    return headings


def build_toc_items(headings):
    if not headings:
        return [Li("No headings found", cls="text-sm text-slate-500 dark:text-slate-400 py-1")]
    return [Li(A(text, href=f"#{anchor}", cls=f"toc-link vyasa-ui-text block py-1 px-2 text-sm rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors {'ml-0' if level == 1 else f'ml-{(level-1)*3}'}", data_anchor=anchor), cls="my-1") for level, text, anchor in headings]


def get_custom_css_links(root, current_path=None, section_class=None):
    css_elements = []
    for filename in ["global.css", "custom.css", "style.css"]:
        if (root / filename).exists():
            css_elements.append(Link(rel="stylesheet", href=f"/posts/{filename}"))
            if filename != "global.css":
                break
    if current_path and section_class:
        post_dir = Path(current_path).parent if "/" in current_path else Path(".")
        ancestors = [] if str(post_dir) == "." else [Path(*post_dir.parts[:idx]) for idx in range(1, len(post_dir.parts) + 1)]
        for ancestor in ancestors:
            global_css = root / ancestor / "global.css"
            if global_css.exists():
                css_elements.append(Link(rel="stylesheet", href=f"/posts/{ancestor.as_posix()}/global.css"))
        for ancestor in ancestors:
            for filename in ["custom.css", "style.css"]:
                css_file = root / ancestor / filename
                if css_file.exists():
                    scope = f"#main-content.{section_class}"
                    css_elements.append(Style(_scope_css(css_file.read_text(), scope)))
                    break
    return css_elements
