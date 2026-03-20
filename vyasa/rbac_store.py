import json
from dataclasses import dataclass

from fastsql import Database


@dataclass
class RbacConfigRow:
    key: str
    value: str


def get_rbac_table(root_folder, cache, create_if_missing=True):
    if cache["db"] is None:
        db_path = root_folder / ".vyasa-rbac.db"
        if not create_if_missing and not db_path.exists():
            return None, None
        db_path.parent.mkdir(parents=True, exist_ok=True)
        cache["db"] = Database(f"sqlite:///{db_path}")
        cache["tbl"] = cache["db"].create(RbacConfigRow, pk="key", name="rbac_config")
    return cache["db"], cache["tbl"]


def load_rbac_cfg(root_folder, cache, normalize):
    _, tbl = get_rbac_table(root_folder, cache, create_if_missing=False)
    if tbl is None:
        return None
    rows = tbl()
    if not rows:
        return None
    data = {}
    for row in rows:
        data[row.key] = json.loads(row.value)
    return normalize(data)


def write_rbac_cfg(root_folder, cache, cfg, normalize):
    _, tbl = get_rbac_table(root_folder, cache)
    cfg = normalize(cfg)
    existing = {row.key for row in tbl()}
    for key, value in cfg.items():
        payload = json.dumps(value, sort_keys=True)
        tbl.update(key=key, value=payload) if key in existing else tbl.insert(RbacConfigRow(key=key, value=payload))
    for key in existing - set(cfg.keys()):
        tbl.delete(key)
