from urllib.parse import quote_plus

from fasthtml.common import *
from monsterui.all import *


def render_posts_search_results(query, matches, regex_error):
    trimmed = (query or "").strip()
    if not trimmed:
        return Ul(Li("Type to search file names.", cls="text-[0.7rem] text-center text-slate-500 dark:text-slate-400 bg-transparent"), cls="posts-search-results-list space-y-1 bg-white/0 dark:bg-slate-950/0")
    if not matches:
        return Ul(Li(f'No matches for "{trimmed}".', cls="text-xs text-slate-500 dark:text-slate-400 bg-transparent"), (Li(regex_error, cls="text-[0.7rem] text-center text-amber-600 dark:text-amber-400") if regex_error else None), cls="posts-search-results-list space-y-1 bg-white/0 dark:bg-slate-950/0")
    items, gather_href = [], f"/search/gather?q={quote_plus(trimmed)}"
    items.append(Li(A(Span(UkIcon("layers", cls="w-4 h-4 text-slate-400"), cls="w-4 mr-2 flex items-center justify-center shrink-0"), Span("Gather all search results for LLM", cls="truncate min-w-0 text-xs text-slate-600 dark:text-slate-300"), href=gather_href, hx_get=gather_href, hx_target="#main-content", hx_push_url="true", hx_swap="outerHTML show:window:top settle:0.1s", cls="post-search-link flex items-center py-1 px-2 rounded bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors min-w-0"), cls="bg-transparent"))
    for slug, display in matches:
        items.append(Li(A(Span(UkIcon("search", cls="w-4 h-4 text-slate-400"), cls="w-4 mr-2 flex items-center justify-center shrink-0"), Span(display, cls="truncate min-w-0 font-mono text-xs text-slate-600 dark:text-slate-300", title=display), href=f"/posts/{slug}", hx_get=f"/posts/{slug}", hx_target="#main-content", hx_push_url="true", hx_swap="outerHTML show:window:top settle:0.1s", cls="post-search-link flex items-center py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors min-w-0")))
    if regex_error:
        items.append(Li(regex_error, cls="text-[0.7rem] text-center text-amber-600 dark:text-amber-400 mt-1 bg-transparent"))
    return Ul(*items, cls="posts-search-results-list space-y-1 bg-white/0 dark:bg-slate-950/0")


def posts_search_block(initial_results):
    return Div(Div("Filter", cls="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2"), Div(Input(type="search", name="q", placeholder="Search file names…", autocomplete="off", data_placeholder_cycle="1", data_placeholder_primary="Search file names…", data_placeholder_alt="Search regex with /pattern/ syntax", data_search_key="posts", hx_get="/_sidebar/posts/search", hx_trigger="input changed delay:300ms", hx_target="next .posts-search-results", hx_swap="innerHTML", cls="w-full px-3 py-2 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"), Button("×", type="button", aria_label="Clear search", cls="posts-search-clear-button absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"), cls="relative"), Div(initial_results, id="posts-search-results", cls="posts-search-results mt-4 max-h-64 overflow-y-auto bg-white/0 dark:bg-slate-950/0"), cls="posts-search-block sticky top-0 z-10 bg-white/20 dark:bg-slate-950/70 mb-3")
