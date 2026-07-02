from __future__ import annotations

from pathlib import Path
from urllib.parse import quote


def pack_ref(ref: str) -> str:
    return str(ref or "").replace("/", ":")


def unpack_ref(ref: str) -> str:
    return str(ref or "").replace(":", "/")


def sidebar_path(alias: str, ref: str) -> str:
    packed = pack_ref(ref)
    return f"{alias}@{packed}" if alias else f"@{packed}"


def ref_from_current_path(current_path: str | None) -> tuple[str, str, tuple[str, ...]] | None:
    parts = Path(str(current_path or "").strip("/")).parts
    if not parts or "@" not in parts[0]:
        return None
    root_id, ref = parts[0].split("@", 1)
    ref = unpack_ref(ref)
    if not ref:
        return None
    return root_id, ref, tuple(parts[1:-1])


def target_url(alias: str, ref: str, current_path: str | None, *, content_location, content_url_for_slug) -> str:
    rel = ""
    if current_path:
        _, _, _, relp = content_location(current_path)
        rp = relp.as_posix()
        rel = rp if rp and rp != "." else ""
    if alias:
        slug = sidebar_path(alias, ref)
        return content_url_for_slug(f"{slug}/{rel}" if rel else slug)
    base = content_url_for_slug(rel) if rel else "/"
    sep = "&" if "?" in base else "?"
    return f"{base}{sep}ref={quote(ref, safe='')}"
