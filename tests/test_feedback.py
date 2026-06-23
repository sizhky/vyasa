import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from typing import cast

from vyasa.extensions import build_extension_runtime
from vyasa.extensions_builtin.feedback.api import _heading_path, _normalized_offsets, register_feedback_routes
from vyasa.extensions_builtin.feedback.cli import format_toon, request_json, resolve_document_url
from vyasa.extensions_builtin.feedback.store import FeedbackStore, PresenceRegistry, event_payload
from vyasa.runtime_services import set_runtime_services
from vyasa.runtime_context import RuntimeAccess


class FakeRequest:
    def __init__(self, payload=None, query=None):
        self._payload = payload
        self.query_params = query or {}

    async def body(self):
        return json.dumps(self._payload).encode("utf-8")


def feedback_handlers(tmp_path):
    handlers = {}

    def rt(path, methods):
        def register(handler):
            for method in methods:
                handlers[(method, path)] = handler
            return handler
        return register

    runtime = cast(RuntimeAccess, SimpleNamespace(
        can_read_post=lambda path, request: True,
        auth_for_request=lambda request: {"name": "Yeshwanth"},
    ))
    store = FeedbackStore(tmp_path)
    presence = PresenceRegistry()
    register_feedback_routes(rt, runtime, store=store, presence=presence)
    return handlers, store, presence


def test_feedback_store_replays_until_monotonic_ack(tmp_path):
    store = FeedbackStore(tmp_path)
    first = store.append(event_id="one", document="plan", kind="feedback", payload={"comment": "First"})
    second = store.append(event_id="two", document="plan", kind="feedback", payload={"comment": "Second"})

    assert [event.id for event in store.after("plan", 0)] == ["one", "two"]
    assert store.acknowledge("plan", second.cursor) == second.cursor
    assert store.acknowledge("plan", 999_999) == second.cursor
    assert store.acknowledge("plan", first.cursor) == second.cursor
    assert store.after("plan", store.acknowledged_cursor("plan")) == []
    assert store.mark_delivered("plan", second.cursor) == second.cursor
    assert store.delivered_cursor("plan") == second.cursor


def test_feedback_store_keeps_replies_out_of_agent_poll_filter(tmp_path):
    store = FeedbackStore(tmp_path)
    store.append(event_id="reply", document="plan", kind="reply", payload={"message": "Done"})
    feedback = store.append(event_id="note", document="plan", kind="feedback", payload={"comment": "Change it"})

    events = store.after("plan", 0, kinds=("feedback",))

    assert [event_payload(event)["id"] for event in events] == [feedback.id]


def test_presence_tracks_nested_pollers():
    presence = PresenceRegistry()

    with presence.polling("plan"):
        assert presence.is_listening("plan") is True
        with presence.polling("plan"):
            assert presence.is_listening("plan") is True
        assert presence.is_listening("plan") is True

    assert presence.is_listening("plan") is False


def test_source_range_normalizes_whitespace_and_reports_heading_path():
    source = "# Plan\n\n## Transport\n\nGeneralize   the loop, not the anchor.\n"
    found = _normalized_offsets(source, "Generalize the loop, not the anchor.")

    assert found is not None
    start, end = found
    assert source[start:end] == "Generalize   the loop, not the anchor."
    assert _heading_path(source, start) == ["Plan", "Transport"]


def test_cli_resolves_post_url_and_git_ref():
    base, document, original = resolve_document_url(
        "http://127.0.0.1:5001/posts/docs/plan?ref=feature/review",
        "http://ignored",
    )

    assert base == "http://127.0.0.1:5001"
    assert document == "docs@feature:review/plan"
    assert original.endswith("?ref=feature/review")


def test_toon_output_keeps_context_but_flattens_event_rows():
    rendered = format_toon({
        "status": "feedback",
        "cursor": 3,
        "events": [{
            "cursor": 3,
            "id": "abc",
            "surface": "markdown",
            "comment": "Tighten this",
            "revision": "sha256:x",
            "created_at": "now",
            "target": {"kind": "text-range"},
        }],
    })

    assert "events[1]{cursor,id,surface,comment,revision,created_at}:" in rendered
    assert '3,"abc","markdown","Tighten this","sha256:x","now"' in rendered
    assert 'target: {"kind":"text-range"}' in rendered


def test_feedback_get_does_not_claim_an_empty_json_body(monkeypatch):
    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self):
            return b'{"ok":true}'

    def open_request(request, timeout):
        assert timeout == 60
        assert request.get_method() == "GET"
        assert request.data is None
        assert request.get_header("Content-type") is None
        return FakeResponse()

    monkeypatch.setattr("vyasa.extensions_builtin.feedback.cli.urlopen", open_request)

    assert request_json("http://vyasa.test/api/feedback/session/plan") == {"ok": True}


def test_feedback_extension_loads_shared_bundle_for_runtime_pages():
    runtime = build_extension_runtime({})
    provider = next(
        provider for provider in runtime.page_asset_providers
        if provider({"mode": "runtime", "current_path": "plan"}) == ("feedback.runtime",)
    )

    assert provider({"mode": "static", "current_path": "plan"}) == ()
    assert runtime.bundles["feedback.runtime"].static_dir == Path(__file__).parents[1] / "vyasa" / "extensions_builtin" / "feedback" / "static"
    assert len(runtime.shell_main_attr_providers) >= 2


def test_feedback_api_queues_polls_acknowledges_and_replies(tmp_path):
    document = tmp_path / "plan.md"
    document.write_text("# Plan\n\nGeneralize the loop.\n", encoding="utf-8")
    set_runtime_services({"content_path_for_slug": lambda slug, suffix="": tmp_path / f"{slug}{suffix}"})
    try:
        handlers, store, _ = feedback_handlers(tmp_path)
        create = handlers[("POST", "/api/feedback/submit/{path:path}")]
        poll = handlers[("GET", "/api/feedback/poll/{path:path}")]
        ack = handlers[("POST", "/api/feedback/ack/{path:path}")]
        reply = handlers[("POST", "/api/feedback/reply/{path:path}")]

        created = asyncio.run(create("plan", FakeRequest({
            "comment": "Clarify this",
            "surface": "markdown",
            "target": {"kind": "text-range", "quote": "Generalize the loop."},
            "snapshot": {"selected": "Generalize the loop."},
        })))
        created_payload = json.loads(created.body)
        assert created.status_code == 201
        assert created_payload["presence"] == "waiting"
        assert created_payload["event"]["target"]["locator"]["heading_path"] == ["Plan"]
        assert created_payload["event"]["snapshot"]["source_selected"] == "Generalize the loop."

        delivered = asyncio.run(poll("plan", FakeRequest(query={"after": "0", "timeout": "0"})))
        delivered_payload = json.loads(delivered.body)
        cursor = delivered_payload["cursor"]
        assert delivered_payload["status"] == "feedback"
        assert delivered_payload["events"][0]["stale"] is False

        document.write_text("# Plan\n\nChanged.\n", encoding="utf-8")
        stale_payload = json.loads(asyncio.run(poll("plan", FakeRequest(query={"after": "0", "timeout": "0"}))).body)
        assert stale_payload["events"][0]["stale"] is True

        acknowledged = asyncio.run(ack("plan", FakeRequest({"cursor": cursor})))
        assert json.loads(acknowledged.body)["ack_cursor"] == cursor

        response = asyncio.run(reply("plan", FakeRequest({"message": "Updated", "ack_cursor": cursor})))
        assert response.status_code == 201
        assert store.recent("plan")[-1].payload["message"] == "Updated"
    finally:
        set_runtime_services(None)


def test_feedback_review_lifts_lavish_capture_and_conversation_contract():
    capture = (
        Path(__file__).parents[1]
        / "vyasa" / "extensions_builtin" / "feedback" / "static" / "lavish-capture.js"
    ).read_text(encoding="utf-8")
    client = (
        Path(__file__).parents[1]
        / "vyasa" / "extensions_builtin" / "feedback" / "static" / "feedback.js"
    ).read_text(encoding="utf-8")

    assert "showAnnotationCard" in capture
    assert "textSelectionContext" in capture
    assert "const selected = new Map()" in capture
    assert 'type: "element-group"' in capture
    assert "additive: event.shiftKey" in capture
    assert "Shift-click to add" in capture
    assert "window.__vyasaShortcutsSuspended = annotationMode" in capture
    assert 'type: "knowledge-graph-selection"' in capture
    assert 'pointerCarrier?.dataset.vyasaReviewPointerTarget' in capture
    assert "carrier.querySelector('.react-flow__node[data-id=" in capture
    assert "selected.set(selectionKey(target, c)" in capture
    assert 'el.closest?.("[data-vyasa-review-targets]")' in capture
    assert 'window.addEventListener("keydown", suspendPageShortcuts, true)' in capture
    assert "sidebar.addEventListener('keydown'" in client
    assert "vyasa-floating-bubble vyasa-feedback-launcher" in client
    assert "floatingActions().prepend(launcher)" in client
    assert "vyasa-feedback-icon" in client
    assert "launcher.setAttribute('aria-keyshortcuts', 'R')" in client
    assert "event.key.toLowerCase() !== 'r'" in client
    assert "event.composedPath().some" in client
    assert "Annotate Mode" in client
    assert "data-annotation-mode" in client
    assert "setAnnotationMode(annotationEnabled)" in client
    assert "&& annotationEnabled" in client
    assert 'document.addEventListener(\n    "mouseover"' in capture
    assert "lavish:queuePrompt" in client
    assert "lavish:requestSnapshot" in client
    assert "Copy listener command" in client
    assert "Conversation" in client
    assert "vyasa-feedback-sidebar" in client
    assert "renderMarkdown(event.message || '')" in client
    assert "safeHref" in client
    assert "body.textContent = event.comment || ''" in client
    assert "const message = { type: 'lavish:setAnnotationMode', enabled }" in client
    assert "window.postMessage(message, '*')" in client
