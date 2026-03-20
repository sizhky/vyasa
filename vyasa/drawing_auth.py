import os
import tomllib


def drawing_password_for(root, path: str):
    if not path:
        return None
    drawing = (root.resolve() / f"{path.strip('/')}.excalidraw").resolve()
    if not str(drawing).startswith(str(root.resolve()) + os.sep):
        return None
    rel_root = drawing.with_suffix("").relative_to(root).as_posix()
    cur = drawing.parent
    while True:
        cfg = cur / ".vyasa"
        if cfg.exists():
            try:
                passwords = tomllib.loads(cfg.read_text(encoding="utf-8")).get("drawings_passwords", {})
                if isinstance(passwords, dict):
                    rel_cur = drawing.with_suffix("").relative_to(cur).as_posix()
                    if rel_cur in passwords: return str(passwords[rel_cur])
                    if rel_root in passwords: return str(passwords[rel_root])
            except Exception:
                pass
        if cur == root or cur.parent == cur:
            break
        cur = cur.parent
    return None


def drawing_unlocked_in_session(session, path: str) -> bool:
    return bool((session or {}).get("drawings_unlocked", {}).get(path.strip("/")))


def unlock_drawing(session, path: str):
    key = path.strip("/")
    unlocked = dict(session.get("drawings_unlocked", {}))
    unlocked[key] = True
    session["drawings_unlocked"] = unlocked
