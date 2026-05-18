from pathlib import Path

from fasthtml.common import Link, Script, to_xml
from .runtime_context import traced


def _static_file_for_url(path: str) -> Path | None:
    rel = path.lstrip("/")
    package_root = Path(__file__).resolve().parent
    if rel.startswith("static/extensions/"):
        parts = Path(rel).parts
        if len(parts) < 4:
            return None
        extension_id = parts[2]
        asset_rel = Path(*parts[3:])
        try:
            from .extensions import get_extension_runtime

            runtime = get_extension_runtime()
            static_dir = runtime.extension_static_dirs.get(extension_id) if runtime else None
            if static_dir:
                return static_dir / asset_rel
        except Exception:
            pass
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
    try:
        from .extensions import get_extension_runtime

        runtime = get_extension_runtime()
        static_dir = runtime.extension_static_dirs.get(extension_id) if runtime else None
        if static_dir:
            return static_dir / asset_name
    except Exception:
        pass
    return Path(__file__).resolve().parent / "extensions_builtin" / extension_id / "static" / asset_name


@traced("assets")
def route_bundle_names(*, show_sidebar: bool = False, current_path: str | None = None, slide_mode: bool = False, annotations_enabled: bool = False) -> tuple[str, ...]:
    names: list[str] = []
    if show_sidebar and not slide_mode:
        names.extend(("default_search.runtime", "bookmarks.runtime"))
        try:
            from .extensions import get_extension_runtime

            runtime = get_extension_runtime()
            if runtime:
                for extension_id in runtime.plan.enabled_ids:
                    names.extend(runtime.catalog[extension_id].asset_bundles)
        except Exception:
            pass
    if annotations_enabled and current_path and not slide_mode:
        names.append("annotations.runtime")
    if slide_mode:
        names.append("slides.runtime")
    return tuple(dict.fromkeys(names))


def bundle_asset_nodes(bundle_names: tuple[str, ...] | list[str], runtime=None) -> tuple[object, ...]:
    if runtime is None:
        from .extensions import get_extension_runtime

        runtime = get_extension_runtime()
    if runtime is None:
        return ()
    nodes: list[object] = []
    seen: set[str] = set()
    for bundle_name in bundle_names:
        bundle = runtime.bundles.get(bundle_name)
        if not bundle:
            continue
        for href in bundle.css:
            if href not in seen:
                seen.add(href)
                nodes.append(Link(rel="stylesheet", href=asset_url(href)))
        for src in bundle.js:
            if src not in seen:
                seen.add(src)
                nodes.append(Script(src=asset_url(src), type="module"))
    return tuple(nodes)


def bundle_asset_nodes_for_collector(asset_collector, runtime=None) -> tuple[object, ...]:
    if not asset_collector:
        return ()
    return bundle_asset_nodes(tuple(asset_collector.requested), runtime=runtime)


def bundle_asset_html(bundle_names: tuple[str, ...] | list[str], runtime=None) -> str:
    return "".join(to_xml(node) for node in bundle_asset_nodes(bundle_names, runtime=runtime))


def iter_extension_static_dirs() -> list[tuple[str, Path]]:
    root = Path(__file__).resolve().parent / "extensions_builtin"
    result: list[tuple[str, Path]] = []
    for entry in sorted(root.iterdir()):
        static_dir = entry / "static"
        if entry.is_dir() and static_dir.is_dir():
            result.append((entry.name, static_dir))
    try:
        from .extensions import get_extension_runtime

        runtime = get_extension_runtime()
        if runtime:
            result.extend(sorted(runtime.extension_static_dirs.items()))
    except Exception:
        pass
    return result
