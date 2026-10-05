import base64
from urllib.parse import quote_plus

from fasthtml.common import *
from monsterui.all import *
from .helpers import content_url_for_slug


def _decorate_search_row(node, slug=None, title="", decorators=()):
    decorated = node
    for decorator in decorators or ():
        decorated = decorator(decorated, slug=slug, title=title, context="search")
    return decorated


def render_posts_search_results(query, matches, regex_error, row_decorators=()):
    trimmed = (query or "").strip()
    if not trimmed:
        return Ul(Li("Type to search file names.", cls="posts-search-empty"), cls="posts-search-results-list space-y-1")
    if not matches:
        return Ul(Li(f'No matches for "{trimmed}".', cls="posts-search-empty"), (Li(regex_error, cls="posts-search-error") if regex_error else None), cls="posts-search-results-list space-y-1")
    items, gather_href = [], f"/search/gather?q={quote_plus(trimmed)}"
    items.append(Li(A(Span(UkIcon("layers", cls="w-4 h-4 text-vyasa-faint"), cls="w-4 mr-2 flex items-center justify-center shrink-0"), Span("Gather all search results for LLM", cls="truncate min-w-0 text-xs text-vyasa-muted"), href=gather_href, hx_get=gather_href, hx_target="#main-content", hx_push_url="true", hx_swap="outerHTML show:window:top settle:0.1s", cls="post-search-link flex items-center py-1 px-2 rounded bg-transparent hover:bg-vyasa-hover text-vyasa-text hover:text-vyasa-text transition-colors min-w-0"), cls="bg-transparent"))
    for slug, display in matches:
        href = content_url_for_slug(slug)
        link = A(Span(UkIcon("search", cls="w-4 h-4 text-vyasa-faint"), cls="w-4 mr-2 flex items-center justify-center shrink-0"), Span(display, cls="truncate min-w-0 font-mono text-xs text-vyasa-muted", title=display), href=href, hx_get=href, hx_target="#main-content", hx_push_url="true", hx_swap="outerHTML show:window:top settle:0.1s", cls="post-search-link flex items-center py-1 px-2 rounded hover:bg-vyasa-hover text-vyasa-text hover:text-vyasa-text transition-colors min-w-0 flex-1", data_path=slug)
        items.append(Li(_decorate_search_row(link, slug, display, row_decorators), cls="bg-transparent"))
    if regex_error:
        items.append(Li(regex_error, cls="posts-search-error"))
    return Ul(*items, cls="posts-search-results-list space-y-1")


def search_preview_href(query):
    trimmed = (query or "").strip()
    if not trimmed:
        return "/search/preview"
    token = base64.urlsafe_b64encode(trimmed.encode("utf-8")).decode("ascii").rstrip("=")
    return f"/search/preview/s/{token}"


def posts_search_block(initial_results):
    return Div(
        Div(
            Input(
                type="search",
                name="q",
                placeholder="Search file names…",
                autocomplete="off",
                data_placeholder_cycle="1",
                data_placeholder_primary="Search file names…",
                data_placeholder_alt="Search regex with /pattern/ syntax",
                data_search_key="posts",
                hx_get="/_sidebar/posts/search",
                hx_trigger="input changed delay:300ms",
                hx_target="next .posts-search-results",
                hx_swap="innerHTML",
                cls="posts-search-input w-full",
            ),
            A(
                "→",
                href="/search/preview",
                aria_label="Open page previews",
                title="Open page previews",
                data_search_preview_base="/search/preview",
                cls="posts-search-preview-button absolute right-8 top-1/2 -translate-y-1/2 flex items-center justify-center",
            ),
            Button(
                "×",
                type="button",
                aria_label="Clear search",
                cls="posts-search-clear-button absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center",
            ),
            cls="relative",
        ),
        Div(initial_results, id="posts-search-results", cls="posts-search-results mt-2 max-h-64 overflow-y-auto"),
        cls="posts-search-block sticky top-0 z-10",
    )


def navbar_search_block(initial_results):
    return Div(
        Input(
            type="search",
            name="q",
            placeholder="Search files…",
            autocomplete="off",
            hx_get="/_sidebar/posts/search",
            hx_trigger="input changed delay:180ms",
            hx_target="next .vyasa-navbar-search-results",
            hx_swap="innerHTML",
            cls="vyasa-navbar-search-input w-full",
        ),
        Div(initial_results, cls="vyasa-navbar-search-results hidden-empty"),
        cls="vyasa-navbar-search-block relative hidden md:block w-[30rem] max-w-[44vw]",
    )
