from dataclasses import dataclass
from fastsql import Database


@dataclass
class BookmarkRow:
    owner: str
    path: str
    created_at: str


def bookmark_owner_from_auth(auth):
    auth = auth or {}
    return str(auth.get("email") or auth.get("username") or "").strip().lower()


def _normalize_bookmark_path(path):
    return str(path or "").strip("/")


def get_bookmarks_table(root_folder, cache, create_if_missing=True):
    if cache["db"] is None:
        db_path = root_folder / ".vyasa-bookmarks.db"
        if not create_if_missing and not db_path.exists():
            return None, None
        db_path.parent.mkdir(parents=True, exist_ok=True)
        cache["db"] = Database(f"sqlite:///{db_path}")
        cache["tbl"] = cache["db"].create(BookmarkRow, pk=("owner", "path"), name="bookmarks")
    return cache["db"], cache["tbl"]


def list_bookmarks(root_folder, cache, owner):
    _, tbl = get_bookmarks_table(root_folder, cache, create_if_missing=False)
    if tbl is None or not owner:
        return []
    return sorted(
        tbl(where="owner = :owner", owner=owner),
        key=lambda row: (row.created_at or "", row.path or ""),
    )


def upsert_bookmark(root_folder, cache, owner, path, created_at):
    _, tbl = get_bookmarks_table(root_folder, cache)
    payload = BookmarkRow(owner=owner, path=_normalize_bookmark_path(path), created_at=str(created_at))
    existing = list(tbl(where="owner = :owner AND path = :path", owner=payload.owner, path=payload.path))
    tbl.update(**payload.__dict__) if existing else tbl.insert(payload)


def delete_bookmark(root_folder, cache, owner, path):
    _, tbl = get_bookmarks_table(root_folder, cache, create_if_missing=False)
    if tbl is None or not owner:
        return False
    normalized = _normalize_bookmark_path(path)
    existing = list(tbl(where="owner = :owner AND path = :path", owner=owner, path=normalized))
    if not existing:
        return False
    tbl.delete((owner, normalized))
    return True
