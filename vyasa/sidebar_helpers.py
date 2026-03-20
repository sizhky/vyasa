import re
from pathlib import Path

from fasthtml.common import *
from monsterui.all import *


def collapsible_sidebar(icon, title, items_list, is_open=False, data_sidebar=None, shortcut_key=None, extra_content=None, scroll_target="container"):
    summary_content = [Span(UkIcon(icon, cls="w-5 h-5 block"), cls="flex items-center justify-center w-5 h-5 shrink-0 leading-none"), Span(title, cls="flex-1 leading-none")]
    if shortcut_key:
        summary_content.append(Kbd(shortcut_key, cls="kbd-key px-2.5 py-1.5 text-xs font-mono font-semibold bg-gradient-to-b from-slate-50 to-slate-200 dark:from-slate-700 dark:to-slate-900 text-slate-800 dark:text-slate-200 rounded-md border-2 border-slate-300 dark:border-slate-600 shadow-[0_2px_0_0_rgba(0,0,0,0.1),inset_0_1px_0_0_rgba(255,255,255,0.5)] dark:shadow-[0_2px_0_0_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.1)]"))
    common_frost_style = "bg-white/20 dark:bg-slate-950/70 backdrop-blur-lg border border-slate-900/10 dark:border-slate-700/25 ring-1 ring-white/20 dark:ring-slate-900/30 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)] dark:shadow-[0_28px_70px_-45px_rgba(2,6,23,0.85)]"
    summary_classes = f"flex items-center gap-2 font-semibold cursor-pointer py-2.5 px-3 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 rounded-lg select-none list-none {common_frost_style} min-h-[56px]"
    content_classes = f"p-3 {common_frost_style} rounded-lg max-h-[calc(100vh-18rem)] flex flex-col overflow-hidden min-h-0" if scroll_target == "list" else f"p-3 {common_frost_style} rounded-lg overflow-x-auto overflow-y-auto max-h-[calc(100vh-18rem)] sidebar-scroll-container"
    list_classes = "list-none pt-2 sidebar-scroll-container" if scroll_target == "list" else "list-none pt-4"
    extra_content = extra_content or []
    content_id = "sidebar-scroll-container" if scroll_target != "list" else None
    return Details(Summary(*summary_content, cls=summary_classes, style="margin: 0 0 0.5rem 0;"), Div(*extra_content, (Div(Ul(*items_list, cls=list_classes, id=("sidebar-scroll-container" if scroll_target == "list" else None)), cls="min-w-0 flex-1 min-h-0 overflow-x-auto overflow-y-auto") if scroll_target == "list" else Ul(*items_list, cls=list_classes, id=content_id)), cls=content_classes, id=content_id, style="will-change: auto;"), open=is_open, data_sidebar=data_sidebar, style="will-change: auto;")


def extract_toc(content, strip_inline_markdown, text_to_anchor, unique_anchor):
    content_no_code = re.sub(r"^```.*?^```", "", content, flags=re.MULTILINE | re.DOTALL)
    content_no_code = re.sub(r"^~~~.*?^~~~", "", content_no_code, flags=re.MULTILINE | re.DOTALL)
    headings, counts = [], {}
    for match in re.finditer(r"^(#{1,6})\s+(.+)$", content_no_code, flags=re.MULTILINE):
        text = strip_inline_markdown(match.group(2).strip())
        headings.append((len(match.group(1)), text, unique_anchor(text_to_anchor(text), counts)))
    return headings


def build_toc_items(headings):
    if not headings:
        return [Li("No headings found", cls="text-sm text-slate-500 dark:text-slate-400 py-1")]
    return [Li(A(text, href=f"#{anchor}", cls=f"toc-link block py-1 px-2 text-sm rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors {'ml-0' if level == 1 else f'ml-{(level-1)*3}'}", data_anchor=anchor), cls="my-1") for level, text, anchor in headings]


def get_custom_css_links(root, current_path=None, section_class=None):
    css_elements = []
    for filename in ["custom.css", "style.css"]:
        if (root / filename).exists():
            css_elements.append(Link(rel="stylesheet", href=f"/posts/{filename}"))
            break
    if current_path and section_class:
        post_dir = Path(current_path).parent if "/" in current_path else Path(".")
        for ancestor in ([] if str(post_dir) == "." else [Path(*post_dir.parts[:idx]) for idx in range(1, len(post_dir.parts) + 1)]):
            for filename in ["custom.css", "style.css"]:
                css_file = root / ancestor / filename
                if css_file.exists():
                    css_elements.append(Style(f"\n                        #main-content.{section_class} {{\n                            {css_file.read_text()}\n                        }}\n                    "))
                    break
    return css_elements
