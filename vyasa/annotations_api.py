from __future__ import annotations

import json
from datetime import datetime
from dataclasses import dataclass
from typing import Callable, Protocol

from starlette.responses import Response

from .annotations_store import AnnotationRow
from .runtime_context import RuntimeAccess


class AnnotationStoreAdapter(Protocol):
    def list(self, path: str) -> list[AnnotationRow]: ...
    def upsert(self, row: AnnotationRow) -> None: ...
    def delete(self, annotation_id: str) -> bool: ...


@dataclass(frozen=True)
class CallableAnnotationStore:
    list_rows: Callable[[str], list[AnnotationRow]]
    upsert_row: Callable[[AnnotationRow], None]
    delete_row: Callable[[str], bool]

    def list(self, path: str) -> list[AnnotationRow]:
        return self.list_rows(path)

    def upsert(self, row: AnnotationRow) -> None:
        self.upsert_row(row)

    def delete(self, annotation_id: str) -> bool:
        return self.delete_row(annotation_id)


def _row_payload(row: AnnotationRow) -> dict:
    return {
        "id": row.id,
        "path": row.path,
        "parent_id": getattr(row, "parent_id", ""),
        "quote": row.quote,
        "prefix": row.prefix,
        "suffix": row.suffix,
        "anchor": getattr(row, "anchor", ""),
        "comment": row.comment,
        "author": row.author,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _author_from_auth(auth: dict) -> str:
    return auth.get("name") or auth.get("email") or auth.get("username") or "anonymous"


def register_annotations_routes(rt, runtime: RuntimeAccess, store: AnnotationStoreAdapter) -> None:
    @rt("/api/annotations/{path:path}", methods=["GET"])
    async def get_annotations(path: str, request):
        if not runtime.config.get_annotations_enabled():
            return Response("Not Found", status_code=404)
        if not runtime.can_read_post(path, request):
            return Response("Forbidden", status_code=403)
        return Response(json.dumps([_row_payload(row) for row in store.list(path)]), media_type="application/json")

    @rt("/api/annotations/{path:path}", methods=["POST"])
    async def save_annotation(path: str, request):
        if not runtime.config.get_annotations_enabled():
            return Response("Not Found", status_code=404)
        if not runtime.can_read_post(path, request):
            return Response("Forbidden", status_code=403)
        try:
            payload = json.loads((await request.body()).decode("utf-8"))
        except Exception:
            return Response("Invalid JSON", status_code=400)
        if not isinstance(payload, dict):
            return Response("Expected JSON object", status_code=400)
        author = _author_from_auth(runtime.auth_for_request(request))
        now = str(payload.get("updated_at") or datetime.utcnow().isoformat())
        row = AnnotationRow(
            id=str(payload.get("id") or ""),
            path=path.strip("/"),
            parent_id=str(payload.get("parent_id") or ""),
            quote=str(payload.get("quote") or ""),
            prefix=str(payload.get("prefix") or ""),
            suffix=str(payload.get("suffix") or ""),
            anchor=json.dumps(payload.get("anchor") or {}),
            comment=str(payload.get("comment") or ""),
            author=author,
            created_at=str(payload.get("created_at") or now),
            updated_at=now,
        )
        if not row.id or not row.comment:
            return Response("Missing annotation fields", status_code=400)
        store.upsert(row)
        return Response(json.dumps({"ok": True, "author": author}), media_type="application/json")

    @rt("/api/annotations/{path:path}/{annotation_id}", methods=["DELETE"])
    async def remove_annotation(path: str, annotation_id: str, request):
        if not runtime.config.get_annotations_enabled():
            return Response("Not Found", status_code=404)
        if not runtime.can_read_post(path, request):
            return Response("Forbidden", status_code=403)
        rows = store.list(path)
        ids = {annotation_id}
        changed = True
        while changed:
            changed = False
            for row in rows:
                if getattr(row, "parent_id", "") in ids and row.id not in ids:
                    ids.add(row.id)
                    changed = True
        ok = False
        for item_id in ids:
            ok = store.delete(item_id) or ok
        return Response(json.dumps({"ok": ok}), media_type="application/json")
