from __future__ import annotations

from pathlib import Path
import os
import tempfile
from urllib.parse import unquote

from starlette.responses import FileResponse, Response

from ...runtime_services import get_runtime_services
from ...api_catalog import publish_api


_REF_QUERY = ({"name": "ref", "required": True, "description": "Content-root-safe sidecar path"},)


def register_mdx_file_routes(rt, runtime) -> None:
    @publish_api(
        rt,
        namespace="mdx",
        operation_id="mdx.files.read",
        path="/api/mdx/files/{path:path}",
        query=_REF_QUERY,
    )
    def get_mdx_file(path: str, request):
        """Read a sidecar file relative to an authorized MDX document."""
        file_path = _resolve_ref(path, request, runtime)
        if file_path is None or not file_path.exists() or not file_path.is_file():
            return Response(status_code=404)
        return FileResponse(file_path, headers={"Cache-Control": "no-store"})

    @publish_api(
        rt,
        namespace="mdx",
        operation_id="mdx.files.write",
        path="/api/mdx/files/{path:path}",
        methods=("POST",),
        query=_REF_QUERY,
        body={"type": "bytes", "description": "Complete replacement sidecar content"},
        local_only=True,
    )
    async def save_mdx_file(path: str, request):
        """Atomically replace a sidecar file relative to an MDX document."""
        if not _is_local_request(request):
            return Response("Forbidden", status_code=403)
        if not _edits_enabled():
            return Response("Editing disabled: unset VYASA_MDX_READONLY", status_code=403)
        file_path = _resolve_ref(path, request, runtime)
        if file_path is None:
            return Response(status_code=404)
        from .excalidraw_routes import browser_autosave_conflicts
        if browser_autosave_conflicts(file_path, request):
            return Response("Stale Excalidraw autosave", status_code=409)
        _atomic_write_bytes(file_path, await request.body())
        revision = file_path.stat().st_mtime_ns
        return Response(
            f'{{"ok": true, "revision": "{revision}"}}',
            media_type="application/json",
            headers={"Cache-Control": "no-store"},
        )


def register_mdx_events_routes(rt, runtime) -> None:
    @publish_api(
        rt,
        namespace="mdx",
        operation_id="mdx.events.subscribe",
        path="/api/mdx/events/{path:path}",
        query=_REF_QUERY,
    )
    def subscribe_events(path: str, request):
        """Push sidecar change events to an open page via Server-Sent Events."""
        file_path = _resolve_ref(path, request, runtime)
        if file_path is None:
            return Response(status_code=404)
        from ...live import sse_stream, watch_path

        return sse_stream(watch_path(file_path))


def _resolve_ref(path: str, request, runtime) -> Path | None:
    services = get_runtime_services()
    doc_slug = str(path or "").strip("/")
    doc_path = services.content_path_for_slug(doc_slug, ".md")
    if not doc_path or not doc_path.exists() or not doc_path.is_file():
        return None
    if runtime is not None and not runtime.can_read_post(doc_slug, request):
        return None
    ref = unquote(str(getattr(request, "query_params", {}).get("ref", "") or "").strip())
    if not ref or ref.startswith("/") or "://" in ref:
        return None
    if ref.startswith("."):
        candidate = (doc_path.parent / ref).resolve()
    else:
        candidate = services.content_path_for_slug(ref)
        if candidate is None:
            return None
        candidate = candidate.resolve()
    return candidate if _inside_content_roots(candidate, services.get_content_mounts()) else None


def _inside_content_roots(path: Path, mounts) -> bool:
    for _alias, root in mounts:
        try:
            path.relative_to(Path(root).resolve())
            return True
        except ValueError:
            continue
    return False


def _is_local_request(request) -> bool:
    host = getattr(getattr(request, "client", None), "host", "")
    return host in {"127.0.0.1", "::1", "localhost", ""}


def _readonly() -> bool:
    return os.getenv("VYASA_MDX_READONLY", "").strip().lower() in {"1", "true", "yes", "on"}


def _edits_enabled() -> bool:
    return not _readonly()


def _atomic_write_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(payload)
        os.replace(tmp_name, path)
    finally:
        try:
            os.unlink(tmp_name)
        except FileNotFoundError:
            pass
