from ..extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase
from ..file_search import search_file_records
from ..config import get_config
from ..helpers import get_content_mounts
from .default_search_routes import register_default_search_routes
from ..search_views import posts_search_block


class DefaultSearchExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.assets.bundle(AssetBundle("default_search.runtime", js=("/static/extensions/default_search/search.js",)))
        app.routes.add("/search/gather", register_default_search_routes)
        app.routes.add("/search/preview", register_default_search_routes)
        app.routes.add("/search/preview/s", register_default_search_routes)
        app.routes.add("/_sidebar/posts/search", register_default_search_routes)
        app.navigation.sidebar_section(_search_sidebar_section)
        app.search.match_finder(find_default_search_matches)
        app.search.preview_match_finder(find_default_search_preview_matches)


EXTENSION = DefaultSearchExtension(
    ExtensionMeta(
        "default_search",
        "search",
        ("slot:search_provider", "bundle:default_search.runtime"),
        requires=("slot:layout",),
        route_prefixes=("/search/gather", "/search/preview", "/search/preview/s", "/_sidebar/posts/search"),
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]


def find_default_search_matches(query, limit=40):
    return _find_search_candidates(query, limit, suffixes=(".md", ".pdf"))


def find_default_search_preview_matches(query, limit=200):
    return _find_search_candidates(query, limit, suffixes=(".md",))


def _find_search_candidates(query, limit, *, suffixes):
    return search_file_records(
        query,
        get_content_mounts(),
        suffixes,
        get_config().get_show_hidden(),
        limit,
    )


def _search_sidebar_section(context):
    return context["sidebar_section"](
        "Filter",
        posts_search_block(context["render_search_results"]("")),
        is_open=True,
        data_section="filter",
        body_cls="pt-1",
        title_suffix=context["kbd"](
            "⌘K",
            cls="kbd-key ml-2 px-2.5 py-1 text-sm font-mono font-semibold normal-case tracking-normal leading-none",
            style="font-size: 0.875rem; line-height: 1; letter-spacing: 0;",
        ),
    )
