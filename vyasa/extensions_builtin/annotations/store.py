from dataclasses import dataclass
from pathlib import Path
from fastsql import Database


@dataclass
class AnnotationRow:
    id: str
    path: str
    parent_id: str
    quote: str
    prefix: str
    suffix: str
    anchor: str
    comment: str
    author: str
    created_at: str
    updated_at: str


def _normalize_annotation_path(path):
    return str(path or "").strip("/")


def _annotation_payload(row):
    return dict(
        id=row.id,
        path=_normalize_annotation_path(row.path),
        parent_id=row.parent_id or "",
        quote=row.quote,
        prefix=row.prefix,
        suffix=row.suffix,
        anchor=row.anchor,
        comment=row.comment,
        author=row.author,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def get_annotations_table(db_path: Path, cache, create_if_missing: bool = True):
    if cache["db"] is None:
        if db_path.suffix != ".db":
            db_path = db_path / ".vyasa-annotations.db"
        if not create_if_missing and not db_path.exists():
            return None, None
        db_path.parent.mkdir(parents=True, exist_ok=True)
        cache["db"] = Database(f"sqlite:///{db_path}")
        cache["tbl"] = cache["db"].create(AnnotationRow, pk="id", name="annotations")
        with cache["db"].engine.begin() as conn:
            cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(annotations)").fetchall()}
            if "anchor" not in cols:
                conn.exec_driver_sql("ALTER TABLE annotations ADD COLUMN anchor TEXT DEFAULT '{}'")
            if "parent_id" not in cols:
                conn.exec_driver_sql("ALTER TABLE annotations ADD COLUMN parent_id TEXT DEFAULT ''")
    return cache["db"], cache["tbl"]


def list_annotations(db_path: Path, cache, path: str) -> list[AnnotationRow]:
    _, tbl = get_annotations_table(db_path, cache, create_if_missing=False)
    if tbl is None:
        return []
    normalized_path = _normalize_annotation_path(path)
    return sorted(tbl(where="path = :path", path=normalized_path), key=lambda row: (row.created_at, row.id))


def list_all_annotations(db_path: Path, cache) -> list[AnnotationRow]:
    _, tbl = get_annotations_table(db_path, cache, create_if_missing=False)
    if tbl is None:
        return []
    return sorted(tbl(), key=lambda row: (row.path, row.created_at, row.id))


def upsert_annotation(db_path: Path, cache, row: AnnotationRow) -> None:
    _, tbl = get_annotations_table(db_path, cache)
    assert tbl is not None
    existing = {item.id for item in tbl(where="id = :id", id=row.id)}
    payload = _annotation_payload(row)
    if row.id in existing:
        tbl.update(**payload)
    else:
        tbl.insert(AnnotationRow(**payload))


def delete_annotation(db_path: Path, cache, annotation_id: str) -> bool:
    _, tbl = get_annotations_table(db_path, cache, create_if_missing=False)
    if tbl is None:
        return False
    existing = list(tbl(where="id = :id", id=annotation_id))
    if not existing:
        return False
    tbl.delete(annotation_id)
    return True
