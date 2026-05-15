from pathlib import Path


def _static_file_for_url(path: str) -> Path | None:
    rel = path.lstrip("/")
    package_root = Path(__file__).resolve().parent
    if rel.startswith("static/extensions/"):
        parts = Path(rel).parts
        if len(parts) < 4:
            return None
        extension_id = parts[2]
        asset_rel = Path(*parts[3:])
        return package_root / "extensions_builtin" / extension_id / "static" / asset_rel
    if rel.startswith("static/"):
        return package_root / "static" / rel.replace("static/", "", 1)
    return None


def extension_asset_url(extension_id: str, asset_name: str) -> str:
    return asset_url(f"/static/extensions/{extension_id}/{asset_name.lstrip('/')}")


def asset_url(path: str) -> str:
    """Return static URL with mtime cache-busting token."""
    file_path = _static_file_for_url(path)
    if file_path is None:
        return path
    try:
        token = int(file_path.stat().st_mtime_ns)
    except OSError:
        return path
    sep = "&" if "?" in path else "?"
    return f"{path}{sep}v={token}"


def extension_asset_path(extension_id: str, asset_name: str) -> Path:
    return Path(__file__).resolve().parent / "extensions_builtin" / extension_id / "static" / asset_name
