from fasthtml.common import *
from monsterui.all import *


def navbar_view(blog_title, theme_toggle_node, show_mobile_menus=False, htmx_nav=True, posts_menu_items=None, compact_mode=False, updated_label=None):
    home_link_attrs = {"hx_get": "/", "hx_target": "#main-content", "hx_push_url": "true", "hx_swap": "outerHTML show:window:top settle:0.1s"} if htmx_nav else {}
    left_items = [A(blog_title, href="/", **home_link_attrs)]
    if updated_label:
        left_items.append(Span(updated_label, cls="text-xs text-slate-300 whitespace-nowrap"))
    left = Div(*left_items, cls="flex items-center gap-3")
    menu = None if not posts_menu_items else Details(Summary(UkIcon("menu", cls="w-4 h-4"), Span("Library"), cls="list-none flex items-center gap-2 cursor-pointer select-none rounded-md px-3 py-2 text-slate-100 hover:bg-slate-800/80 transition-colors [&::-webkit-details-marker]:hidden"), Div(Ul(*posts_menu_items, cls="list-none text-sm max-h-[60vh] overflow-y-auto pr-2"), cls="absolute right-0 mt-2 w-80 p-3 rounded-lg bg-white text-slate-800 shadow-lg border border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 z-[1100]"), cls="relative hidden xl:block")
    right = Div(menu, theme_toggle_node, cls="flex items-center gap-3")
    if compact_mode:
        compact_menu = None if not posts_menu_items else Details(Summary(UkIcon("menu", cls="w-5 h-5"), cls="list-none p-2 cursor-pointer rounded hover:bg-slate-800 transition-colors [&::-webkit-details-marker]:hidden"), Div(Ul(*posts_menu_items, cls="list-none text-sm max-h-[60vh] overflow-y-auto pr-2"), cls="absolute left-0 mt-2 w-80 p-3 rounded-lg bg-white text-slate-800 shadow-lg border border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 z-[1100]"), cls="relative")
        title_block = Div(A(blog_title, href="/", cls="flex-1 text-center truncate", **home_link_attrs), Span(updated_label, cls="text-[11px] text-slate-300 truncate") if updated_label else None, cls="flex-1 px-4 flex flex-col items-center")
        row = Div(Div(compact_menu or Div(cls="w-9"), cls="w-16"), title_block, Div(theme_toggle_node, cls="w-16 flex justify-end"), cls="flex items-center justify-between")
        return Div(row, cls="vyasa-navbar-card overflow-visible bg-slate-900 text-white px-4 py-3 dark:bg-slate-800")
    if show_mobile_menus:
        mobile_title = Div(A(blog_title, href="/", cls="text-center truncate", **home_link_attrs), Span(updated_label, cls="text-[11px] text-slate-300 truncate") if updated_label else None, cls="flex-1 px-4 flex flex-col items-center")
        mobile = Div(Button(UkIcon("menu", cls="w-5 h-5"), title="Toggle file tree", id="mobile-posts-toggle", cls="p-2 hover:bg-slate-800 rounded transition-colors", type="button", onclick="window.__vyasaTogglePostsPanel && window.__vyasaTogglePostsPanel()"), mobile_title, Div(Button(UkIcon("list", cls="w-5 h-5"), title="Toggle table of contents", id="mobile-toc-toggle", cls="p-2 hover:bg-slate-800 rounded transition-colors", type="button", onclick="window.__vyasaToggleTocPanel && window.__vyasaToggleTocPanel()"), theme_toggle_node, cls="flex items-center gap-1"), cls="flex items-center justify-between xl:hidden")
        desktop = Div(left, right, cls="hidden xl:flex items-center justify-between")
        return Div(mobile, desktop, cls="vyasa-navbar-card overflow-visible bg-slate-900 text-white px-4 py-3 dark:bg-slate-800")
    return Div(left, right, cls="vyasa-navbar-card overflow-visible flex items-center justify-between bg-slate-900 text-white px-4 py-3 dark:bg-slate-800")
