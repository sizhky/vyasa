from dataclasses import dataclass
from pathlib import Path
from fastsql import Database


@dataclass
class BookmarkRow:
    owner: str
    path: str
    created_at: str


def bookmark_owner_from_auth(auth):
    auth = auth or {}
    owner = auth.get("email") or auth.get("username") or auth.get("sub")
    if owner:
        return str(owner).strip().lower()
    provider = str(auth.get("provider") or "").strip().lower()
    provider_id = auth.get("id")
    return f"{provider}:{provider_id}".strip(":").lower() if provider and provider_id else ""


def _normalize_bookmark_path(path):
    return str(path or "").strip("/")


def get_bookmarks_table(db_path: Path, cache, create_if_missing: bool = True):
    if cache["db"] is None:
        if db_path.suffix != ".db":
            db_path = db_path / ".vyasa-bookmarks.db"
        if not create_if_missing and not db_path.exists():
            return None, None
        db_path.parent.mkdir(parents=True, exist_ok=True)
        cache["db"] = Database(f"sqlite:///{db_path}")
        cache["tbl"] = cache["db"].create(BookmarkRow, pk=("owner", "path"), name="bookmarks")
    return cache["db"], cache["tbl"]


def list_bookmarks(db_path: Path, cache, owner: str) -> list[BookmarkRow]:
    _, tbl = get_bookmarks_table(db_path, cache, create_if_missing=False)
    if tbl is None or not owner:
        return []
    return sorted(
        tbl(where="owner = :owner", owner=owner),
        key=lambda row: (row.created_at or "", row.path or ""),
    )


def upsert_bookmark(db_path: Path, cache, owner: str, path: str, created_at: str) -> None:
    _, tbl = get_bookmarks_table(db_path, cache)
    assert tbl is not None
    payload = BookmarkRow(owner=owner, path=_normalize_bookmark_path(path), created_at=str(created_at))
    existing = list(tbl(where="owner = :owner AND path = :path", owner=payload.owner, path=payload.path))
    tbl.update(**payload.__dict__) if existing else tbl.insert(payload)


def delete_bookmark(db_path: Path, cache, owner: str, path: str) -> bool:
    _, tbl = get_bookmarks_table(db_path, cache, create_if_missing=False)
    if tbl is None or not owner:
        return False
    normalized = _normalize_bookmark_path(path)
    existing = list(tbl(where="owner = :owner AND path = :path", owner=owner, path=normalized))
    if not existing:
        return False
    tbl.delete((owner, normalized))
    return True
