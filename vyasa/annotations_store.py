from dataclasses import dataclass
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


def get_annotations_table(root_folder, cache, create_if_missing=True):
    if cache["db"] is None:
        db_path = root_folder / ".vyasa-annotations.db"
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


def list_annotations(root_folder, cache, path):
    _, tbl = get_annotations_table(root_folder, cache, create_if_missing=False)
    if tbl is None:
        return []
    normalized_path = _normalize_annotation_path(path)
    return sorted(tbl(where="path = :path", path=normalized_path), key=lambda row: (row.created_at, row.id))


def upsert_annotation(root_folder, cache, row):
    _, tbl = get_annotations_table(root_folder, cache)
    existing = {item.id for item in tbl(where="id = :id", id=row.id)}
    payload = _annotation_payload(row)
    if row.id in existing:
        tbl.update(**payload)
    else:
        tbl.insert(AnnotationRow(**payload))


def delete_annotation(root_folder, cache, annotation_id):
    _, tbl = get_annotations_table(root_folder, cache, create_if_missing=False)
    if tbl is None:
        return False
    existing = list(tbl(where="id = :id", id=annotation_id))
    if not existing:
        return False
    tbl.delete(annotation_id)
    return True
