from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase
from .api import CallableBookmarkStore, register_bookmarks_routes
from .store import delete_bookmark, list_bookmarks, upsert_bookmark


class BookmarksExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.storage.namespace("bookmarks")
        app.routes.add("/api/bookmarks", _register_bookmarks_routes)
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
