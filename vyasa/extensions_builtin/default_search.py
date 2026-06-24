import json
from pathlib import Path

from ..extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase
from ..file_search import search_file_records
from ..config import get_config
from ..content_tree import ref_root_vpath
from ..helpers import content_location, get_content_mounts, get_ref_content_mounts, enabled_document_suffixes
from .default_search_routes import register_default_search_routes
from ..search_views import posts_search_block


class DefaultSearchExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.assets.bundle(AssetBundle("default_search.runtime", js=("/static/extensions/default_search/search.js",)))
        app.assets.page(_page_bundles)
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


def find_default_search_matches(query, limit=40, *, current_path="", ref_state=""):
    return _find_search_candidates(
        query,
        limit,
        suffixes=tuple(suffix for suffix in enabled_document_suffixes() if suffix in {".md", ".pdf"}),
        current_path=current_path,
        ref_state=ref_state,
    )


def find_default_search_preview_matches(query, limit=200, *, current_path="", ref_state=""):
    return _find_search_candidates(query, limit, suffixes=(".md",), current_path=current_path, ref_state=ref_state)


def _find_search_candidates(query, limit, *, suffixes, current_path="", ref_state=""):
    return search_file_records(
        query,
        _search_mounts(current_path=current_path, ref_state=ref_state),
        suffixes,
        get_config().get_show_hidden(),
        limit,
    )


def _search_mounts(*, current_path="", ref_state=""):
    refs = _parse_ref_state(ref_state)
    if current_path:
        root_id, _, ref, _ = content_location(current_path)
        if root_id and ref:
            refs[root_id] = ref
    mounts = list(get_content_mounts())
    mounted_aliases = {alias for alias, _ in mounts}
    for alias, root in get_ref_content_mounts():
        if alias in refs and alias not in mounted_aliases:
            mounts.append((alias, root))
    out = []
    for alias, root in mounts:
        ref = refs.get(alias)
        root_vpath = ref_root_vpath(alias, ref) if ref else None
        out.append(("", root_vpath) if root_vpath is not None else (alias, Path(root)))
    return out


def _parse_ref_state(raw):
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(alias): str(ref) for alias, ref in data.items() if alias and ref}


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


def _page_bundles(context):
    return ("default_search.runtime",) if context.get("show_sidebar") and not context.get("slide_mode") else ()


_page_bundles.page_asset_priority = 10
