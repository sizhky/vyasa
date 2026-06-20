from pathlib import Path
import shutil

from ..extensions import ExtensionMeta, VyasaExtensionBase
from ..runtime_services import get_runtime_services


class FilesystemRoutesExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.routes.add("/posts/raw-markdown", _register_filesystem_routes)
        app.routes.add("/posts/static-attachment", _register_filesystem_routes)
        app.routes.add("/download", _register_filesystem_routes)
        app.routes.static_build("cap:static_copy:filesystem_routes", copy_static_filesystem_routes)


def _register_filesystem_routes(rt, runtime) -> None:
    from starlette.responses import FileResponse, Response

    @rt("/posts/{path:path}.md")
    def serve_post_markdown(path: str):
        services = get_runtime_services()
        file_path = services.content_path_for_slug(path, ".md")
        if file_path and file_path.exists():
            return FileResponse(file_path, media_type="text/markdown; charset=utf-8")
        return Response(status_code=404)

    @rt("/posts/{path:path}.{ext:static}")
    def serve_post_static(path: str, ext: str):
        services = get_runtime_services()
        file_path = services.content_path_for_slug(path, f".{ext}")
        if file_path and file_path.exists():
            return FileResponse(file_path)
        return Response(status_code=404)

    @rt("/posts/{path:path}.jsx")
    def serve_post_jsx(path: str):
        services = get_runtime_services()
        file_path = services.content_path_for_slug(path, ".jsx")
        if file_path and file_path.exists():
            return FileResponse(file_path, media_type="text/javascript; charset=utf-8")
        return Response(status_code=404)

    @rt("/posts/{path:path}.json")
    def serve_post_json(path: str):
        services = get_runtime_services()
        file_path = services.content_path_for_slug(path, ".json")
        if file_path and file_path.exists():
            return FileResponse(
                file_path,
                headers={"Content-Disposition": f'attachment; filename="{file_path.name}"'},
            )
        return Response(status_code=404)

    @rt("/download/{path:path}")
    def download_file(path: str):
        services = get_runtime_services()
        file_path = services.content_path_for_slug(path)
        if not file_path:
            return Response(status_code=403)
        if file_path.exists() and file_path.is_file():
            return FileResponse(
                file_path,
                headers={"Content-Disposition": f'attachment; filename="{file_path.name}"'},
            )
        return Response(status_code=404)


def copy_static_filesystem_routes(context) -> None:
    root = Path(context.root_folder).resolve()
    root_parts = len(root.parts)
    for source in sorted(root.rglob("*")):
        if not source.is_file():
            continue
        rel_parts = source.parts[root_parts:]
        if not rel_parts:
            continue
        if not context.show_hidden and any(part.startswith(".") for part in rel_parts):
            continue
        if any(not context.should_include_folder(part, context.include_list, context.ignore_list) for part in rel_parts[:-1]):
            continue
        rel = Path(*rel_parts)
        _copy_static_source(source, context.output_dir / "download" / rel, overwrite=True)
        _copy_static_source(source, context.output_dir / "posts" / rel, overwrite=False)


def _copy_static_source(source: Path, destination: Path, *, overwrite: bool) -> None:
    if destination.exists() and not overwrite:
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


EXTENSION = FilesystemRoutesExtension(
    ExtensionMeta(
        "filesystem_routes",
        "route",
        ("cap:route:filesystem_routes", "cap:static_copy:filesystem_routes"),
        route_prefixes=("/posts/raw-markdown", "/posts/static-attachment", "/download"),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
