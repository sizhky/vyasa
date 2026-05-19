from fasthtml.common import *
from monsterui.all import *


TREE_ROW_CLASSES = "vyasa-tree-row vyasa-tree-row-shell whitespace-nowrap"
FOLDER_ROW_CLASSES = f"{TREE_ROW_CLASSES} font-medium cursor-pointer select-none list-none"
FILE_ROW_CLASSES = f"{TREE_ROW_CLASSES} post-link"
TREE_ACTION_BUTTON_CLASSES = "vyasa-sidebar-tree-action vyasa-row-action shrink-0 text-slate-400 transition-colors"
TREE_ACTION_ROW_BASE_CLASSES = {
    "search": "flex items-center gap-1 min-w-0",
    "tree-inline": "inline-flex items-center gap-1 w-max",
    "tree": f"{TREE_ROW_CLASSES} inline-flex items-center gap-1 w-max",
}


class NavigationRow:
    def __init__(self, *, slug, title, label, href, icon, kind="file", folder_note=False):
        self.slug = slug
        self.title = title
        self.label = label
        self.href = href
        self.icon = icon
        self.kind = kind
        self.folder_note = folder_note


def navigation_row_view(row, *, cls, onclick=None, show_icon=True):
    link_cls = f"vyasa-tree-link inline-flex items-center min-w-0 whitespace-nowrap {cls}".strip()
    attrs = {
        "href": row.href,
        "hx_get": row.href,
        "hx_target": "#main-content",
        "hx_push_url": "true",
        "hx_swap": "outerHTML show:window:top settle:0.1s",
        "cls": link_cls,
        "data_path": row.slug,
    }
    if onclick:
        attrs["onclick"] = onclick
    icon_nodes = (
        Span(cls="w-4 mr-2 shrink-0"),
        Span(UkIcon(row.icon, cls="text-current w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
    ) if show_icon else ()
    return A(*icon_nodes, Span(row.label, cls="whitespace-nowrap", title=row.title), **attrs)


def navbar_view(blog_title, theme_toggle_node, show_mobile_menus=False, htmx_nav=True, posts_menu_items=None, compact_mode=False, updated_label=None):
    home_link_attrs = {"hx_get": "/", "hx_target": "#main-content", "hx_push_url": "true", "hx_swap": "outerHTML show:window:top settle:0.1s"} if htmx_nav else {}
    left_items = [A(blog_title, href="/", **home_link_attrs)]
    left = Div(*left_items, cls="flex items-center gap-3")
    menu = None if not posts_menu_items else Details(Summary(UkIcon("menu", cls="w-4 h-4"), Span("Library"), cls="list-none flex items-center gap-2 cursor-pointer select-none rounded-md px-3 py-2 text-slate-100 hover:bg-slate-800/80 transition-colors [&::-webkit-details-marker]:hidden"), Div(Ul(*posts_menu_items, cls="list-none text-sm max-h-[60vh] overflow-y-auto pr-2"), cls="absolute right-0 mt-2 w-80 p-3 rounded-lg bg-white text-slate-800 shadow-lg border border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 z-[1100]"), cls="relative hidden xl:block")
    right = Div(menu, theme_toggle_node, cls="flex items-center gap-3")
    if compact_mode:
        compact_menu = None if not posts_menu_items else Details(Summary(UkIcon("menu", cls="w-5 h-5"), cls="list-none p-2 cursor-pointer rounded hover:bg-slate-800 transition-colors [&::-webkit-details-marker]:hidden"), Div(Ul(*posts_menu_items, cls="list-none text-sm max-h-[60vh] overflow-y-auto pr-2"), cls="absolute left-0 mt-2 w-80 p-3 rounded-lg bg-white text-slate-800 shadow-lg border border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 z-[1100]"), cls="relative")
        title_block = Div(A(blog_title, href="/", cls="flex-1 text-center truncate", **home_link_attrs), cls="flex-1 px-4 flex flex-col items-center")
        row = Div(Div(compact_menu or Div(cls="w-9"), cls="w-16"), title_block, Div(theme_toggle_node, cls="w-16 flex justify-end"), cls="flex items-center justify-between")
        return Div(row, cls="vyasa-navbar-card overflow-visible bg-slate-900 text-white px-4 py-3 dark:bg-slate-800")
    if show_mobile_menus:
        mobile_title = Div(A(blog_title, href="/", cls="text-center truncate", **home_link_attrs), cls="flex-1 px-4 flex flex-col items-center")
        mobile = Div(Button(UkIcon("menu", cls="w-5 h-5"), title="Toggle file tree", id="mobile-posts-toggle", cls="p-2 hover:bg-slate-800 rounded transition-colors", type="button", onclick="window.__vyasaTogglePostsPanel && window.__vyasaTogglePostsPanel()"), mobile_title, Div(Button(UkIcon("list", cls="w-5 h-5"), title="Toggle table of contents", id="mobile-toc-toggle", cls="p-2 hover:bg-slate-800 rounded transition-colors", type="button", onclick="window.__vyasaToggleTocPanel && window.__vyasaToggleTocPanel()"), theme_toggle_node, cls="flex items-center gap-1"), cls="flex items-center justify-between xl:hidden")
        desktop = Div(left, right, cls="hidden xl:flex items-center justify-between")
        return Div(mobile, desktop, cls="vyasa-navbar-card overflow-visible bg-slate-900 text-white px-4 py-3 dark:bg-slate-800")
    return Div(left, right, cls="vyasa-navbar-card overflow-visible flex items-center justify-between bg-slate-900 text-white px-4 py-3 dark:bg-slate-800")
