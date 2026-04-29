from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Callable, Protocol

from starlette.responses import Response

from .bookmark_store import bookmark_owner_from_auth
from .helpers import _effective_abbreviations, content_path_for_slug, content_url_for_slug, parse_frontmatter, slug_to_title
from .runtime_context import RuntimeAccess


class BookmarkStoreAdapter(Protocol):
    def list(self, owner: str): ...
    def upsert(self, owner: str, path: str) -> None: ...
    def delete(self, owner: str, path: str) -> bool: ...


@dataclass(frozen=True)
class CallableBookmarkStore:
    list_rows: Callable[[str], list]
    upsert_row: Callable[[str, str], None]
    delete_row: Callable[[str, str], bool]

    def list(self, owner: str):
        return self.list_rows(owner)

    def upsert(self, owner: str, path: str) -> None:
        self.upsert_row(owner, path)

    def delete(self, owner: str, path: str) -> bool:
        return self.delete_row(owner, path)


def _resolve_bookmark_items(owner: str, roles, *, store: BookmarkStoreAdapter, root, rbac_rules):
    from .auth.policy import is_allowed

    items = []
    for row in store.list(owner):
        slug = (row.path or "").strip("/")
        path = content_path_for_slug(slug, ".md") or content_path_for_slug(slug, ".tree") or content_path_for_slug(slug, ".pdf")
        if not slug or not path or path.suffix not in {".md", ".tree", ".pdf"}:
            continue
        if not is_allowed(f"/posts/{slug}", roles or [], rbac_rules):
            continue
        abbreviations = _effective_abbreviations(root, path.parent)
        if path.suffix == ".md":
            metadata, _ = parse_frontmatter(path)
            title = metadata.get("title", slug_to_title(path.stem, abbreviations=abbreviations))
        else:
            title = slug_to_title(path.stem, abbreviations=abbreviations)
        items.append({"path": slug, "href": content_url_for_slug(slug), "title": title})
    return items


def register_bookmarks_routes(rt, runtime: RuntimeAccess, store: BookmarkStoreAdapter, *, root_folder) -> None:
    @rt("/api/bookmarks", methods=["GET"])
    async def get_bookmarks(request):
        auth = runtime.auth_for_request(request)
        owner = bookmark_owner_from_auth(auth)
        runtime.logger.info(f"[BOOKMARKS][GET] auth={auth} owner={owner!r}")
        if not owner:
            return Response(json.dumps({"items": [], "mode": "local"}), media_type="application/json", headers={"Cache-Control": "no-store"})
        roles = runtime.roles_for_request(request)
        db_rows = [(row.owner, row.path, row.created_at) for row in store.list(owner)]
        items = _resolve_bookmark_items(owner, roles, store=store, root=root_folder(), rbac_rules=runtime.current_rbac_rules())
        runtime.logger.info(f"[BOOKMARKS][GET] owner={owner!r} roles={roles} db_rows={db_rows} returned={[item['path'] for item in items]}")
        return Response(json.dumps({"items": items, "mode": "server"}), media_type="application/json", headers={"Cache-Control": "no-store"})

    @rt("/api/bookmarks/{path:path}", methods=["PUT"])
    async def save_bookmark(path: str, request):
        auth = runtime.auth_for_request(request)
        owner = bookmark_owner_from_auth(auth)
        runtime.logger.info(f"[BOOKMARKS][PUT] path={path!r} auth={auth} owner={owner!r}")
        if not owner:
            return Response("Unauthorized", status_code=401)
        slug = str(path or "").strip("/")
        if not content_path_for_slug(slug, ".md") and not content_path_for_slug(slug, ".pdf"):
            return Response("Not Found", status_code=404)
        if not runtime.can_read_post(slug, request):
            return Response("Forbidden", status_code=403)
        store.upsert(owner, slug)
        runtime.logger.info(f"[BOOKMARKS][PUT] owner={owner!r} saved={slug!r} db_rows={[(row.owner, row.path) for row in store.list(owner)]}")
        return Response(json.dumps({"ok": True}), media_type="application/json", headers={"Cache-Control": "no-store"})

    @rt("/api/bookmarks/{path:path}", methods=["DELETE"])
    async def remove_bookmark(path: str, request):
        owner = bookmark_owner_from_auth(runtime.auth_for_request(request))
        if not owner:
            return Response("Unauthorized", status_code=401)
        return Response(json.dumps({"ok": store.delete(owner, path)}), media_type="application/json", headers={"Cache-Control": "no-store"})
