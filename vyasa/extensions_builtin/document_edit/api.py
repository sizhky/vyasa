"""Read, preview, and save the markdown source of a document.

The editor holds the whole file, frontmatter included, so reading and writing
are the same text and nothing has to be re-attached on save. Preview and save
both render through ``from_md``, so the editor never shows a second renderer.
"""

from __future__ import annotations

import json
from pathlib import Path

from starlette.responses import Response

from ...helpers import (
    atomic_write_bytes,
    content_path_for_slug,
    is_local_request,
    parse_frontmatter_text,
    resolve_markdown_title_text,
    strip_more_marker,
)
from ...api_catalog import publish_api

_JSON_HEADERS = {"Cache-Control": "no-store"}


def edits_enabled() -> bool:
    """Off unless the `document_edit` flag, `VYASA_DOCUMENT_EDIT`, or `--edit` says so."""
    from ...config import get_config

    return get_config().get_document_edit()


def _json(payload: dict, status_code: int = 200) -> Response:
    return Response(json.dumps(payload), status_code=status_code, media_type="application/json", headers=_JSON_HEADERS)


def _resolve_document(path: str, request, runtime) -> Path | None:
    """The on-disk ``.md`` file for a slug, or None when it is not editable.

    Git-ref documents never reach here: they have no working-tree file, so
    ``content_path_for_slug`` either misses or points at the checked-out copy,
    and the toggle is not offered for them in the first place.
    """
    slug = str(path or "").strip("/")
    if not slug:
        return None
    file_path = content_path_for_slug(slug, ".md")
    if not file_path or not file_path.exists() or not file_path.is_file():
        return None
    if runtime is not None and not runtime.can_read_post(slug, request):
        return None
    return file_path


def _render_body(text: str, *, slug: str, stem: str) -> dict:
    """Render file text the same way the reading view does.

    Reports the asset bundles the render asked for alongside the HTML. A block
    type the page did not open with -- a first mermaid diagram, say -- needs its
    runtime fetched, and a `<script>` inside injected HTML never runs.
    """
    from ..markdown.renderer import _render_markdown_fragment
    from ...assets import asset_url
    from ...extensions import get_extension_runtime

    metadata, body = parse_frontmatter_text(text, source=slug)
    _title, render_content = resolve_markdown_title_text(metadata, body, stem)
    runtime = get_extension_runtime()
    collector = runtime.new_asset_collector() if runtime is not None else None
    html = _render_markdown_fragment(
        strip_more_marker(render_content), current_path=slug, asset_collector=collector
    )
    css: list[str] = []
    js: list[str] = []
    for name in (collector.requested if collector else ()):
        bundle = runtime.bundles.get(name) if runtime is not None else None
        if not bundle:
            continue
        css.extend(asset_url(href) for href in bundle.css)
        js.extend(asset_url(src) for src in bundle.js)
    return {"html": html, "css": css, "js": js}


def register_document_source_routes(rt, runtime) -> None:
    @publish_api(
        rt,
        namespace="documents",
        operation_id="documents.source.read",
        path="/api/documents/source/{path:path}",
    )
    def read_document_source(path: str, request):
        """Return the full markdown source of a document, frontmatter included."""
        file_path = _resolve_document(path, request, runtime)
        if file_path is None:
            return _json({"error": "not found"}, 404)
        return _json(
            {
                "source": file_path.read_text(encoding="utf-8"),
                "revision": str(file_path.stat().st_mtime_ns),
                "editable": edits_enabled() and is_local_request(request),
            }
        )

    @publish_api(
        rt,
        namespace="documents",
        operation_id="documents.source.write",
        path="/api/documents/source/{path:path}",
        methods=("POST",),
        body={"type": "bytes", "description": "Complete replacement markdown source"},
        local_only=True,
    )
    async def save_document_source(path: str, request):
        """Replace a document's markdown in one step and return it rendered."""
        if not is_local_request(request):
            return _json({"error": "forbidden"}, 403)
        if not edits_enabled():
            return _json({"error": "Editing is off. Start Vyasa with --edit to turn it on."}, 403)
        file_path = _resolve_document(path, request, runtime)
        if file_path is None:
            return _json({"error": "not found"}, 404)
        expected = str(request.query_params.get("revision", "") or "").strip()
        current = str(file_path.stat().st_mtime_ns)
        if expected and expected != current:
            return _json({"error": "The file changed on disk. Reload before saving."}, 409)
        text = (await request.body()).decode("utf-8", "replace")
        atomic_write_bytes(file_path, text.encode("utf-8"))
        slug = str(path or "").strip("/")
        return _json(
            {
                "ok": True,
                "revision": str(file_path.stat().st_mtime_ns),
                **_render_body(text, slug=slug, stem=file_path.stem),
            }
        )


def register_document_preview_routes(rt, runtime) -> None:
    @publish_api(
        rt,
        namespace="documents",
        operation_id="documents.source.preview",
        path="/api/documents/preview/{path:path}",
        methods=("POST",),
        body={"type": "bytes", "description": "Markdown source to render without saving"},
    )
    async def preview_document_source(path: str, request):
        """Render unsaved markdown so the editor can show it in place."""
        file_path = _resolve_document(path, request, runtime)
        if file_path is None:
            return _json({"error": "not found"}, 404)
        text = (await request.body()).decode("utf-8", "replace")
        return _json(_render_body(text, slug=str(path or "").strip("/"), stem=file_path.stem))
