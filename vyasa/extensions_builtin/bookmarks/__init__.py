from functools import partial

from ...extensions import AssetBundle, ExtensionMeta, NavigationAction, VyasaExtensionBase

from .api import CallableBookmarkStore, register_bookmarks_routes
from .store import BookmarkRow, delete_bookmark, list_bookmarks, upsert_bookmark
from .views import bookmarks_block


class BookmarksExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        storage = app.storage.namespace("bookmarks")
        app.routes.add("/api/bookmarks", partial(_register_bookmarks_routes, storage=storage))
        app.navigation.sidebar_section(_bookmarks_sidebar_section)
        app.navigation.sidebar_row_action(_bookmark_row_action)
        app.navigation.search_result_row_action(_bookmark_row_action)
        app.layout.main_attrs(_main_attrs)
        app.assets.bundle(
            AssetBundle(
                "bookmarks.runtime",
                css=("/static/extensions/bookmarks/bookmarks.css",),
                js=("/static/extensions/bookmarks/bookmarks.js",),
            )
        )
        app.assets.page(_page_bundles)


def _register_bookmarks_routes(rt, runtime, *, storage):
    from datetime import datetime

    cache = {"db": None, "tbl": None}
    db_path = storage.file("bookmarks.db", legacy_name=".vyasa-bookmarks.db")

    def _db_list(owner: str) -> list[BookmarkRow]:
        return list_bookmarks(db_path, cache, owner)

    def _db_upsert(owner: str, path: str) -> None:
        upsert_bookmark(
            db_path,
            cache,
            owner,
            path,
            datetime.utcnow().isoformat(),
        )

    def _db_delete(owner: str, path: str) -> bool:
        return delete_bookmark(db_path, cache, owner, path)

    register_bookmarks_routes(
        rt,
        runtime,
        CallableBookmarkStore(_db_list, _db_upsert, _db_delete),
        root_folder=runtime.config.get_root_folder,
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


# The `B` shortcut needs this bundle on every document page, so a page without
# the sidebar and a slide page also load it.
def _page_bundles(context):
    return ("bookmarks.runtime",) if context.get("show_sidebar") or context.get("current_path") else ()


def _main_attrs(context):
    """Give the client the slug of the open document.

    The `/posts/` and `/slides/` routes both pass the same slug as
    `current_path`, so the client does not parse the URL.
    """
    slug = str(context.get("current_path") or "").strip("/")
    return {"data-bookmark-current-path": slug} if slug else {}


_page_bundles.page_asset_priority = 20


EXTENSION = BookmarksExtension(
    ExtensionMeta(
        "bookmarks",
        "route",
        ("cap:route:bookmarks", "bundle:bookmarks.runtime", "cap:layout:main_attrs"),
        route_prefixes=("/api/bookmarks",),
        storage_namespaces=("bookmarks",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
