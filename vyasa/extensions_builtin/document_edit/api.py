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


def _render_fragments(texts: list[str], *, slug: str) -> dict:
    """Render markdown fragments the way the reading view does, sharing one asset collector.

    Reports the asset bundles the renders asked for alongside the HTML. A block
    type the page did not open with -- a first mermaid diagram, say -- needs its
    runtime fetched, and a `<script>` inside injected HTML never runs.
    """
    from ..markdown.renderer import _render_markdown_fragment
    from ...assets import asset_url
    from ...extensions import get_extension_runtime

    runtime = get_extension_runtime()
    collector = runtime.new_asset_collector() if runtime is not None else None
    htmls = [
        _render_markdown_fragment(strip_more_marker(text), current_path=slug, asset_collector=collector)
        for text in texts
    ]
    css: list[str] = []
    js: list[str] = []
    for name in (collector.requested if collector else ()):
        bundle = runtime.bundles.get(name) if runtime is not None else None
        if not bundle:
            continue
        css.extend(asset_url(href) for href in bundle.css)
        js.extend(asset_url(src) for src in bundle.js)
    return {"html": htmls, "css": css, "js": js}


def _render_body(text: str, *, slug: str, stem: str) -> dict:
    """Render whole-file text, frontmatter and title handled as the reading view does."""
    metadata, body = parse_frontmatter_text(text, source=slug)
    _title, render_content = resolve_markdown_title_text(metadata, body, stem)
    rendered = _render_fragments([render_content], slug=slug)
    return {**rendered, "html": rendered["html"][0]}


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


def register_document_block_routes(rt, runtime) -> None:
    @publish_api(
        rt,
        namespace="documents",
        operation_id="documents.blocks.preview",
        path="/api/documents/blocks/{path:path}",
        methods=("POST",),
        body={"blocks": "array<string>"},
    )
    async def preview_document_blocks(path: str, request):
        """Render each top-level block on its own, so the block editor can swap one at a time."""
        if _resolve_document(path, request, runtime) is None:
            return _json({"error": "not found"}, 404)
        try:
            blocks = json.loads((await request.body()).decode("utf-8", "replace")).get("blocks")
        except (ValueError, AttributeError):
            blocks = None
        if not isinstance(blocks, list) or not all(isinstance(block, str) for block in blocks):
            return _json({"error": "expected {\"blocks\": [string, ...]}"}, 400)
        rendered = _render_fragments(blocks, slug=str(path or "").strip("/"))
        return _json({"blocks": rendered["html"], "css": rendered["css"], "js": rendered["js"]})


def _revision(file_path: Path) -> str:
    return str(file_path.stat().st_mtime_ns)


def _section_text(source: str, heading: str) -> tuple[str, str]:
    """Body under ``heading`` (empty when the heading is missing) and its anchor."""
    from ...sections import section_span

    span = section_span(source, heading)
    if span is None:
        return "", ""
    start, end, anchor = span
    return source[start:end].strip("\n"), anchor


def _refresh_base(proposal, file_path: Path) -> None:
    """Follow the file when someone else wrote it after the proposal was made.

    A write elsewhere in the file only moves the revision. A write to this
    section becomes the new base and sets ``stale_base``: the diff then shows
    the proposal against what is on disk, never against a copy that is gone.
    """
    revision = _revision(file_path)
    if revision == proposal.base_revision:
        return
    current, anchor = _section_text(file_path.read_text(encoding="utf-8"), proposal.heading)
    if current != proposal.base:
        proposal.base = current
        proposal.stale_base = True
    proposal.anchor = anchor or proposal.anchor
    proposal.base_revision = revision


def _announce(slug: str, proposal_id: str) -> None:
    from ...core import publish_live_event

    publish_live_event("proposal", {"slug": slug, "id": proposal_id})


def register_document_proposal_routes(rt, runtime, *, storage=None) -> None:
    from .proposals import STORE, Proposal

    STORE.open(storage.file("proposals.json") if storage is not None else None)

    @publish_api(
        rt,
        namespace="documents",
        operation_id="documents.proposals.list",
        path="/api/documents/proposals/{path:path}",
    )
    def list_document_proposals(path: str, request):
        """Pending proposals for a document, each diffed against the section on disk now."""
        file_path = _resolve_document(path, request, runtime)
        if file_path is None:
            return _json({"error": "not found"}, 404)
        slug = str(path or "").strip("/")
        proposals = STORE.for_slug(slug)
        for proposal in proposals:
            _refresh_base(proposal, file_path)
        return _json({"proposals": [proposal.to_json() for proposal in proposals]})

    @publish_api(
        rt,
        namespace="documents",
        operation_id="documents.proposals.write",
        path="/api/documents/proposals/{path:path}",
        methods=("POST",),
        body={"heading": "string", "text": "string", "partial": "boolean?", "origin": "string?", "id": "string?"},
        local_only=True,
    )
    async def write_document_proposal(path: str, request):
        """Propose new text for one section, or update a proposal while its text streams in.

        The first call snapshots the section as the base; later calls with ``id``
        replace the proposed text. Nothing is written to the file.
        """
        if not is_local_request(request):
            return _json({"error": "forbidden"}, 403)
        if not edits_enabled():
            return _json({"error": "Editing is off. Start Vyasa with --edit to turn it on."}, 403)
        file_path = _resolve_document(path, request, runtime)
        if file_path is None:
            return _json({"error": "not found"}, 404)
        try:
            body = json.loads((await request.body()).decode("utf-8", "replace"))
        except ValueError:
            body = None
        if not isinstance(body, dict) or not isinstance(body.get("text"), str):
            return _json({"error": 'expected {"heading": "## Name", "text": "..."}'}, 400)
        slug = str(path or "").strip("/")
        partial = bool(body.get("partial"))
        text = body["text"].lstrip("\n") if partial else body["text"].strip("\n")
        proposal = STORE.get(str(body.get("id") or ""))
        if proposal is not None:
            if proposal.slug != slug:
                return _json({"error": "proposal belongs to another document"}, 409)
            proposal.proposed, proposal.partial = text, partial
            STORE.save()
        else:
            heading = str(body.get("heading") or "").strip()
            if not heading.startswith("#"):
                return _json({"error": 'heading must be a markdown heading such as "## Now"'}, 400)
            try:
                base, anchor = _section_text(file_path.read_text(encoding="utf-8"), heading)
            except ValueError as error:
                return _json({"error": str(error)}, 400)
            proposal = STORE.add(
                Proposal(
                    id=STORE.new_id(),
                    slug=slug,
                    heading=heading,
                    anchor=anchor,
                    base=base,
                    base_revision=_revision(file_path),
                    proposed=text,
                    partial=partial,
                    origin=str(body.get("origin") or ""),
                )
            )
        _announce(slug, proposal.id)
        return _json(proposal.to_json())

    @publish_api(
        rt,
        namespace="documents",
        operation_id="documents.proposals.resolve",
        path="/api/document-proposals/{proposal_id}/{action}",
        methods=("POST",),
        body={"hunks": "array<integer>?"},
        local_only=True,
    )
    async def resolve_document_proposal(proposal_id: str, action: str, request):
        """Accept or reject some hunks (all when ``hunks`` is absent), or discard the proposal.

        Accepting writes the section with those hunks applied, against the
        revision the proposal was last diffed at, and returns the document
        rendered so the page can update without a reload.
        """
        from ...sections import replace_markdown_section
        from .proposals import merge

        if not is_local_request(request):
            return _json({"error": "forbidden"}, 403)
        if not edits_enabled():
            return _json({"error": "Editing is off. Start Vyasa with --edit to turn it on."}, 403)
        if action not in ("accept", "reject", "discard"):
            return _json({"error": "action must be accept, reject, or discard"}, 400)
        proposal = STORE.get(proposal_id)
        if proposal is None:
            return _json({"error": "not found"}, 404)
        file_path = _resolve_document(proposal.slug, request, runtime)
        if file_path is None:
            return _json({"error": "not found"}, 404)
        if action == "discard":
            STORE.drop(proposal.id)
            _announce(proposal.slug, proposal.id)
            return _json({"proposal": None})
        if proposal.partial:
            return _json({"error": "The agent is still writing this proposal."}, 409)
        try:
            body = json.loads((await request.body()).decode("utf-8", "replace") or "{}")
        except ValueError:
            body = {}
        _refresh_base(proposal, file_path)
        segments = proposal.segments()
        every = {s.hunk for s in segments if s.hunk is not None}
        asked = body.get("hunks") if isinstance(body, dict) else None
        chosen = every if asked is None else every & {int(h) for h in asked if isinstance(h, int)}
        rendered = {}
        if action == "accept":
            merged = merge(segments, chosen)
            source = file_path.read_text(encoding="utf-8")
            if _revision(file_path) != proposal.base_revision:
                return _json({"error": "The file changed on disk. Review the proposal again."}, 409)
            atomic_write_bytes(file_path, replace_markdown_section(source, proposal.heading, merged).encode("utf-8"))
            proposal.base, proposal.stale_base = merged, False
            proposal.base_revision = _revision(file_path)
            source = file_path.read_text(encoding="utf-8")
            proposal.anchor = _section_text(source, proposal.heading)[1] or proposal.anchor
            rendered = _render_body(source, slug=proposal.slug, stem=file_path.stem)
        else:
            proposal.proposed = merge(segments, every - chosen)
        done = proposal.base == proposal.proposed
        if done:
            STORE.drop(proposal.id)
        else:
            STORE.save()
        _announce(proposal.slug, proposal.id)
        return _json({"proposal": None if done else proposal.to_json(), **rendered})
