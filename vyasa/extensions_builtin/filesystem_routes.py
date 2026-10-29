import os
from pathlib import Path
import shutil
import zipfile

from ..extensions import ExtensionMeta, VyasaExtensionBase
from ..runtime_services import get_runtime_services


class FilesystemRoutesExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.routes.add("/posts/raw-markdown", _register_filesystem_routes)
        app.routes.add("/posts/static-attachment", _register_filesystem_routes)
        app.routes.add("/download", _register_filesystem_routes)
        app.routes.add("/download-folder", _register_filesystem_routes)
        app.routes.static_build("cap:static_copy:filesystem_routes", copy_static_filesystem_routes)


def _ref_of(request) -> str:
    """The `?ref=` query param (git ref), packed as `alias@ref` paths emit it)."""
    try:
        return request.query_params.get("ref", "") or ""
    except AttributeError:
        return ""


def _ref_blob_response(path: str, suffix: str, *, ref_override="", media_type=None, headers=None):
    """A Response for a git-ref-served blob, or None when disk-served."""
    import mimetypes

    from starlette.responses import Response

    from ..content_tree import resolve_ref_blob

    data = resolve_ref_blob(path, suffix, ref_override=ref_override)
    if data is None:
        return None
    guessed = media_type or mimetypes.guess_type(f"x{suffix}")[0] or "application/octet-stream"
    return Response(data, media_type=guessed, headers=headers)


def _markdown_section_response(text: str, anchor: str):
    """`?section=<anchor>` on a raw Markdown URL: the heading and its body, 404 when no heading has that anchor.

    >>> _markdown_section_response("# A\\nx\\n## B\\ny\\n", "b").body
    b'## B\\ny\\n'
    >>> _markdown_section_response("# A\\n", "missing").status_code
    404
    """
    from starlette.responses import Response

    from ..sections import extract_markdown_section_by_anchor

    section = extract_markdown_section_by_anchor(text, anchor)
    if section is None:
        return Response(status_code=404)
    return Response(section + "\n", media_type="text/markdown; charset=utf-8")


# Already-compressed formats gain nothing from deflate, so the zip stores them as they are.
_STORED_SUFFIXES = frozenset({".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".pdf", ".zip", ".gz", ".mp3", ".mp4", ".mov", ".webm", ".woff2"})


class _ZipSink:
    """A write-only stream the zip writer fills and the response drains."""

    def __init__(self):
        self.chunks: list[bytes] = []

    def write(self, data: bytes, /) -> int:
        self.chunks.append(bytes(data))
        return len(data)

    def flush(self) -> None:
        pass

    def close(self) -> None:
        pass

    def drain(self) -> bytes:
        out = b"".join(self.chunks)
        self.chunks.clear()
        return out


def folder_zip_chunks(folder: Path, keep_dir, keep_file):
    """Zip bytes for the files under `folder`, streamed a chunk at a time so memory stays flat.

    `keep_dir(name)` prunes a folder before it is walked; `keep_file(path)` drops one file.

    >>> import io, tempfile
    >>> root = Path(tempfile.mkdtemp()) / "docs"
    >>> (root / "skip").mkdir(parents=True)
    >>> _ = (root / "a.md").write_text("x"), (root / "skip" / "b.md").write_text("y"), (root / "c.png").write_bytes(b"p")
    >>> data = b"".join(folder_zip_chunks(root, lambda name: name != "skip", lambda path: True))
    >>> [(i.filename, i.compress_type) for i in zipfile.ZipFile(io.BytesIO(data)).infolist()]
    [('docs/a.md', 8), ('docs/c.png', 0)]
    """
    sink = _ZipSink()
    with zipfile.ZipFile(sink, "w") as archive:
        for current, dirs, files in os.walk(folder):
            dirs[:] = sorted(name for name in dirs if keep_dir(name))
            for name in sorted(files):
                path = Path(current) / name
                if not path.is_file() or not keep_file(path):
                    continue
                info = zipfile.ZipInfo.from_file(path, f"{folder.name}/{path.relative_to(folder).as_posix()}")
                info.compress_type = zipfile.ZIP_STORED if path.suffix.lower() in _STORED_SUFFIXES else zipfile.ZIP_DEFLATED
                with path.open("rb") as source, archive.open(info, "w") as target:
                    while chunk := source.read(1 << 20):
                        target.write(chunk)
                        yield sink.drain()
    yield sink.drain()


def _register_filesystem_routes(rt, runtime) -> None:
    from starlette.responses import FileResponse, Response

    @rt("/posts/{path:path}.md")
    def serve_post_markdown(path: str, request):
        section = request.query_params.get("section", "")
        ref = _ref_blob_response(path, ".md", ref_override=_ref_of(request), media_type="text/markdown; charset=utf-8")
        if ref is not None:
            return _markdown_section_response(bytes(ref.body).decode("utf-8"), section) if section else ref
        services = get_runtime_services()
        file_path = services.content_path_for_slug(path, ".md")
        if file_path and file_path.exists():
            if section:
                return _markdown_section_response(file_path.read_text(encoding="utf-8"), section)
            return FileResponse(file_path, media_type="text/markdown; charset=utf-8")
        return Response(status_code=404)

    @rt("/posts/{path:path}.{ext:static}")
    def serve_post_static(path: str, ext: str, request):
        ref = _ref_blob_response(path, f".{ext}", ref_override=_ref_of(request))
        if ref is not None:
            return ref
        services = get_runtime_services()
        file_path = services.content_path_for_slug(path, f".{ext}")
        if file_path and file_path.exists():
            return FileResponse(file_path)
        return Response(status_code=404)

    @rt("/posts/{path:path}.jsx")
    def serve_post_jsx(path: str, request):
        ref = _ref_blob_response(path, ".jsx", ref_override=_ref_of(request), media_type="text/javascript; charset=utf-8")
        if ref is not None:
            return ref
        services = get_runtime_services()
        file_path = services.content_path_for_slug(path, ".jsx")
        if file_path and file_path.exists():
            return FileResponse(file_path, media_type="text/javascript; charset=utf-8")
        return Response(status_code=404)

    @rt("/posts/{path:path}.json")
    def serve_post_json(path: str, request):
        name = f"{path.rsplit('/', 1)[-1]}.json"
        ref = _ref_blob_response(path, ".json", ref_override=_ref_of(request), headers={"Content-Disposition": f'attachment; filename="{name}"'})
        if ref is not None:
            return ref
        services = get_runtime_services()
        file_path = services.content_path_for_slug(path, ".json")
        if file_path and file_path.exists():
            return FileResponse(
                file_path,
                headers={"Content-Disposition": f'attachment; filename="{file_path.name}"'},
            )
        return Response(status_code=404)

    @rt("/download/{path:path}")
    def download_file(path: str, request):
        name = path.rsplit("/", 1)[-1]
        ref = _ref_blob_response(path, "", ref_override=_ref_of(request), headers={"Content-Disposition": f'attachment; filename="{name}"'})
        if ref is not None:
            return ref
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

    @rt("/download-folder/{path:path}")
    def download_folder(path: str, request):
        from starlette.responses import StreamingResponse

        from ..auth.policy import is_allowed
        from ..helpers import content_root_and_relative, content_slug_for_path, folder_zip_allowed, should_exclude_dir

        config = runtime.config
        folder = get_runtime_services().content_path_for_slug(path)
        root = content_root_and_relative(path)[0]
        if not config.get_folder_zip() or not folder or not root or not folder.is_dir() or not folder_zip_allowed(root, folder):
            return Response(status_code=404)
        roles, rules = runtime.roles_for_request(request), runtime.current_rbac_rules()
        show_hidden, excluded = config.get_show_hidden(), set(config.get_reload_excludes())

        # The zip holds what the sidebar would list: no excluded or hidden folders, no unreadable files.
        def keep_dir(name):
            return not should_exclude_dir(name, excluded) and (show_hidden or not name.startswith("."))

        def keep_file(file):
            if not show_hidden and file.name.startswith("."):
                return False
            return roles is None or is_allowed(f"/posts/{content_slug_for_path(file) or ''}", roles or [], rules)

        return StreamingResponse(
            folder_zip_chunks(folder, keep_dir, keep_file),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{folder.name}.zip"'},
        )


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
        route_prefixes=("/posts/raw-markdown", "/posts/static-attachment", "/download", "/download-folder"),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
