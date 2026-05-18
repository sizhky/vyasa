from ...extensions import AssetBundle, ExtensionMeta, NavigationAction, VyasaExtensionBase

from .api import CallableBookmarkStore, register_bookmarks_routes
from .store import delete_bookmark, list_bookmarks, upsert_bookmark
from .views import bookmarks_block


class BookmarksExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.storage.namespace("bookmarks")
        app.routes.add("/api/bookmarks", _register_bookmarks_routes)
        app.navigation.sidebar_section(_bookmarks_sidebar_section)
        app.navigation.sidebar_row_action(_bookmark_row_action)
        app.navigation.search_result_row_action(_bookmark_row_action)
        app.assets.bundle(
            AssetBundle(
                "bookmarks.runtime",
                css=("/static/extensions/bookmarks/bookmarks.css",),
                js=("/static/extensions/bookmarks/bookmarks.js",),
            )
        )


def _register_bookmarks_routes(rt, runtime):
    from datetime import datetime

    from ...config import get_config

    cache = {"db": None, "tbl": None}

    def _db_list(owner: str):
        return list_bookmarks(get_config().get_root_folder(), cache, owner)

    def _db_upsert(owner: str, path: str):
        upsert_bookmark(
            get_config().get_root_folder(),
            cache,
            owner,
            path,
            datetime.utcnow().isoformat(),
        )

    def _db_delete(owner: str, path: str):
        return delete_bookmark(get_config().get_root_folder(), cache, owner, path)

    register_bookmarks_routes(
        rt,
        runtime,
        CallableBookmarkStore(_db_list, _db_upsert, _db_delete),
        root_folder=get_config().get_root_folder,
    )


def _bookmark_row_action(*, slug=None, title="", context="tree"):
    if not slug:
        return None
    return NavigationAction(
        id="bookmarks.toggle",
        label=f"Bookmark {title}",
        icon_text="☆",
        attrs={
            "data_bookmark_toggle": "true",
            "data_bookmark_path": str(slug).strip("/"),
            "data_bookmark_title": title,
        },
    )


def _bookmarks_sidebar_section(context):
    return context["sidebar_section"](
        "Bookmarks",
        bookmarks_block(),
        is_open=True,
        data_section="bookmarks",
        body_cls="pt-1",
    )


EXTENSION = BookmarksExtension(
    ExtensionMeta(
        "bookmarks",
        "route",
        ("cap:route:bookmarks", "bundle:bookmarks.runtime"),
        route_prefixes=("/api/bookmarks",),
        storage_namespaces=("bookmarks",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
