from pathlib import Path


def asset_url(path: str) -> str:
    """Return static URL with mtime cache-busting token."""
    rel = path.lstrip("/")
    if not rel.startswith("static/"):
        return path
    static_root = Path(__file__).resolve().parent / "static"
    file_path = static_root / rel.replace("static/", "", 1)
    try:
        token = int(file_path.stat().st_mtime_ns)
    except OSError:
        return path
    sep = "&" if "?" in path else "?"
    return f"{path}{sep}v={token}"
