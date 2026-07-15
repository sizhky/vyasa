from __future__ import annotations

import asyncio
import json
from pathlib import Path
import re
import time
from typing import cast
from uuid import uuid4

from fasthtml.common import to_xml
from starlette.responses import Response

from ...api_catalog import publish_api
from ...runtime_context import RuntimeAccess
from ...runtime_services import get_runtime_services
from .store import FeedbackStore, PresenceRegistry, event_payload


MAX_COMMENT_CHARS = 8_000
MAX_CONTEXT_BYTES = 48_000
DEFAULT_POLL_TIMEOUT_SECONDS = 30 * 60
MAX_POLL_TIMEOUT_SECONDS = 60 * 60
POLL_FALLBACK_CHECK_SECONDS = 5.0


def _json(payload: dict, status_code: int = 200) -> Response:
    return Response(
        json.dumps(payload, separators=(",", ":")),
        status_code=status_code,
        media_type="application/json",
        headers={"Cache-Control": "no-store"},
    )


def _document(path: str) -> str:
    return str(path or "").strip("/")


def _source_path(document: str) -> Path | None:
    services = get_runtime_services()
    candidates = (".md", ".html", ".htm", ".pdf", ".tree", ".json")
    direct = services.content_path_for_slug(document)
    if direct and (direct.is_file() or (direct.is_dir() and direct.suffix.lower() == ".kg")):
        return direct
    for suffix in candidates:
        candidate = services.content_path_for_slug(document, suffix)
        if candidate and candidate.is_file():
            return candidate
    return None


def _revision(document: str) -> str:
    source = _source_path(document)
    if source is None:
        return "missing"
    try:
        stat = source.stat()
    except OSError:
        return "missing"
    return f"file:{stat.st_mtime_ns}:{stat.st_size}"


def _normalized_offsets(source: str, quote: str) -> tuple[int, int] | None:
    normalized: list[str] = []
    offsets: list[int] = []
    in_space = False
    for index, char in enumerate(source):
        if char.isspace():
            if in_space:
                continue
            char = " "
            in_space = True
        else:
            in_space = False
        normalized.append(char)
        offsets.append(index)
    needle = re.sub(r"\s+", " ", quote).strip()
    start = "".join(normalized).find(needle)
    if start < 0 or not needle:
        return None
    end_index = min(start + len(needle) - 1, len(offsets) - 1)
    return offsets[start], offsets[end_index] + 1


def _heading_path(source: str, offset: int) -> list[str]:
    stack: list[tuple[int, str]] = []
    consumed = 0
    for line in source.splitlines(keepends=True):
        if consumed > offset:
            break
        match = re.match(r"^(#{1,6})\s+(.+?)\s*$", line)
        if match:
            level = len(match.group(1))
            stack = [item for item in stack if item[0] < level]
            stack.append((level, re.sub(r"[*_`]+", "", match.group(2)).strip()))
        consumed += len(line)
    return [title for _, title in stack]


def _enrich_source_context(document: str, surface: str, target: dict, snapshot: dict) -> tuple[dict, dict]:
    source_path = _source_path(document)
    quote = str(target.get("quote") or snapshot.get("selected") or "")
    if surface not in {"markdown", "mdx"} or not source_path or source_path.suffix.lower() != ".md" or not quote:
        return target, snapshot
    try:
        source = source_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return target, snapshot
    found = _normalized_offsets(source, quote)
    if found is None:
        return target, snapshot
    start, end = found
    locator = dict(target.get("locator") or {})
    locator.update({"source_start": start, "source_end": end, "heading_path": _heading_path(source, start)})
    target = {**target, "locator": locator}
    snapshot = {
        **snapshot,
        "source_before": source[max(0, start - 800):start],
        "source_selected": source[start:end],
        "source_after": source[end:end + 800],
    }
    return target, snapshot


def _compact_snapshot(snapshot: dict) -> dict:
    """Keep agent payload token-light; DOM can be fetched separately when needed."""
    compact = {
        key: value
        for key, value in snapshot.items()
        if key != "dom" and value not in ("", None, [], {})
    }
    if "selected" in compact:
        compact["selected"] = str(compact["selected"])[:4_000]
    return compact


def _presence(document: str, store: FeedbackStore, presence: PresenceRegistry) -> str:
    if presence.is_listening(document):
        return "listening"
    if store.delivered_cursor(document) > store.acknowledged_cursor(document):
        return "working"
    return "waiting"


def _delivered_event(event, current_revision: str) -> dict:
    payload = event_payload(event)
    captured_revision = str(payload.get("revision") or "")
    payload["stale"] = bool(captured_revision and captured_revision != current_revision)
    return payload


def _event_summary(event, runtime: RuntimeAccess, document: str) -> dict:
    payload = event_payload(event)
    if payload.get("kind") == "reply" and payload.get("message") and not payload.get("message_html"):
        payload["message_html"] = _render_reply_html(str(payload["message"]), document, runtime)
    keys = ("cursor", "id", "kind", "created_at", "comment", "message", "message_html", "action", "author", "revision", "surface")
    return {key: payload[key] for key in keys if key in payload}


def _parse_object(raw: bytes) -> dict | None:
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _context_size(payload: dict) -> int:
    return len(json.dumps({"target": payload.get("target"), "snapshot": payload.get("snapshot")}).encode("utf-8"))


def _render_reply_html(message: str, document: str, runtime: RuntimeAccess) -> str:
    try:
        rendered = runtime.render_markdown(
            message,
            current_path=document,
            emit_bundle_nodes=False,
            apply_class_mods=True,
        )
        return to_xml(rendered)
    except Exception:
        return ""


def register_feedback_routes(
    rt,
    runtime: RuntimeAccess,
    *,
    store: FeedbackStore,
    presence: PresenceRegistry,
) -> None:
    wake_condition = asyncio.Condition()

    async def wake_pollers() -> None:
        async with wake_condition:
            wake_condition.notify_all()

    async def wait_for_feedback(deadline: float) -> None:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return
        async with wake_condition:
            try:
                await asyncio.wait_for(
                    wake_condition.wait(),
                    timeout=min(remaining, POLL_FALLBACK_CHECK_SECONDS),
                )
            except asyncio.TimeoutError:
                return

    @publish_api(
        rt,
        namespace="feedback",
        operation_id="feedback.session.read",
        path="/api/feedback/session/{path:path}",
        methods=("GET",),
    )
    async def read_feedback(path: str, request):
        """Read recent feedback/replies and current listener state for one Vyasa document."""
        document = _document(path)
        if not document or not runtime.can_read_post(document, request):
            return Response("Forbidden", status_code=403)
        return _json({
            "document": document,
            "revision": _revision(document),
            "presence": _presence(document, store, presence),
            "ack_cursor": store.acknowledged_cursor(document),
            "events": [_event_summary(event, runtime, document) for event in store.recent(document)],
        })

    @publish_api(
        rt,
        namespace="feedback",
        operation_id="feedback.create",
        path="/api/feedback/submit/{path:path}",
        methods=("POST",),
        body={"comment": "string", "surface": "string", "target": "object", "snapshot": "object"},
    )
    async def create_feedback(path: str, request):
        """Queue one context-rich feedback packet and wake an agent polling this document URL."""
        document = _document(path)
        if not document or not runtime.can_read_post(document, request):
            return Response("Forbidden", status_code=403)
        payload = _parse_object(await request.body())
        if payload is None:
            return _json({"error": "Expected JSON object"}, 400)
        comment = str(payload.get("comment") or "").strip()
        if not comment or len(comment) > MAX_COMMENT_CHARS:
            return _json({"error": f"comment must contain 1-{MAX_COMMENT_CHARS} characters"}, 400)
        if _context_size(payload) > MAX_CONTEXT_BYTES:
            return _json({"error": "target and snapshot are too large"}, 413)
        surface = str(payload.get("surface") or "document")[:64]
        target = cast(dict, payload.get("target")) if isinstance(payload.get("target"), dict) else {}
        snapshot = cast(dict, payload.get("snapshot")) if isinstance(payload.get("snapshot"), dict) else {}
        snapshot = _compact_snapshot(snapshot)
        target, snapshot = _enrich_source_context(document, surface, target, snapshot)
        event = store.append(
            event_id=uuid4().hex,
            document=document,
            kind="feedback",
            payload={
                "url": str(payload.get("url") or f"/posts/{document}")[:2048],
                "revision": _revision(document),
                "surface": surface,
                "target": target,
                "snapshot": snapshot,
                "comment": comment,
                "author": runtime.auth_for_request(request).get("name") or "anonymous",
            },
        )
        await wake_pollers()
        return _json({"ok": True, "event": event_payload(event), "presence": _presence(document, store, presence)}, 201)

    @publish_api(
        rt,
        namespace="feedback",
        operation_id="feedback.poll",
        path="/api/feedback/poll/{path:path}",
        methods=("GET",),
        query=("after", "timeout"),
    )
    async def poll_feedback(path: str, request):
        """Long-poll queued feedback after a cursor; omitted after resumes from last acknowledgement."""
        document = _document(path)
        if not document or not runtime.can_read_post(document, request):
            return Response("Forbidden", status_code=403)
        try:
            after = max(0, int(request.query_params.get("after", store.acknowledged_cursor(document))))
            timeout = max(0.0, min(float(request.query_params.get("timeout", DEFAULT_POLL_TIMEOUT_SECONDS)), MAX_POLL_TIMEOUT_SECONDS))
        except (TypeError, ValueError):
            return _json({"error": "after and timeout must be numbers"}, 400)
        deadline = time.monotonic() + timeout
        try:
            with presence.polling(document):
                while True:
                    events = store.after(document, after, kinds=("feedback",))
                    if events:
                        current_revision = _revision(document)
                        store.mark_delivered(document, events[-1].cursor)
                        return _json({
                            "document": document,
                            "status": "feedback",
                            "after": after,
                            "cursor": events[-1].cursor,
                            "current_revision": current_revision,
                            "events": [_delivered_event(event, current_revision) for event in events],
                        })
                    if time.monotonic() >= deadline:
                        return _json({"document": document, "status": "timeout", "after": after, "cursor": after, "events": []})
                    await wait_for_feedback(deadline)
        except asyncio.CancelledError:
            return _json({"document": document, "status": "cancelled", "after": after, "cursor": after, "events": []}, 499)

    @publish_api(
        rt,
        namespace="feedback",
        operation_id="feedback.acknowledge",
        path="/api/feedback/ack/{path:path}",
        methods=("POST",),
        body={"cursor": "integer"},
    )
    async def acknowledge_feedback(path: str, request):
        """Advance the durable consumed cursor after an agent safely receives feedback."""
        document = _document(path)
        if not document or not runtime.can_read_post(document, request):
            return Response("Forbidden", status_code=403)
        payload = _parse_object(await request.body())
        try:
            cursor = int(cast(int | str, (payload or {}).get("cursor")))
        except (TypeError, ValueError):
            return _json({"error": "cursor must be an integer"}, 400)
        return _json({"ok": True, "ack_cursor": store.acknowledge(document, cursor)})

    @publish_api(
        rt,
        namespace="feedback",
        operation_id="feedback.reply",
        path="/api/feedback/reply/{path:path}",
        methods=("POST",),
        body={"message": "string", "ack_cursor": "integer?", "refresh": "boolean?"},
    )
    async def reply_feedback(path: str, request):
        """Publish an agent response into the document and optionally acknowledge consumed feedback."""
        document = _document(path)
        if not document or not runtime.can_read_post(document, request):
            return Response("Forbidden", status_code=403)
        payload = _parse_object(await request.body())
        message = str((payload or {}).get("message") or "").strip()
        if not message or len(message) > MAX_COMMENT_CHARS:
            return _json({"error": f"message must contain 1-{MAX_COMMENT_CHARS} characters"}, 400)
        ack_cursor = (payload or {}).get("ack_cursor")
        if ack_cursor is not None:
            try:
                store.acknowledge(document, int(ack_cursor))
            except (TypeError, ValueError):
                return _json({"error": "ack_cursor must be an integer"}, 400)
        reply_payload = {"message": message, "message_html": _render_reply_html(message, document, runtime), "revision": _revision(document)}
        if bool((payload or {}).get("refresh")):
            reply_payload["action"] = "refresh"
        event = store.append(
            event_id=uuid4().hex,
            document=document,
            kind="reply",
            payload=reply_payload,
        )
        return _json({"ok": True, "event": event_payload(event), "ack_cursor": store.acknowledged_cursor(document)}, 201)
