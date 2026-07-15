import asyncio
import json
from pathlib import Path
import sqlite3
from types import SimpleNamespace
from typing import cast

from vyasa.extensions import StorageNamespace, build_extension_runtime
from vyasa.extensions_builtin.feedback.api import _heading_path, _normalized_offsets, register_feedback_routes
from vyasa.extensions_builtin.feedback.cli import feedback_command, format_toon, request_json, resolve_document_url
from vyasa.extensions_builtin.feedback.store import FeedbackStore, PresenceRegistry, event_payload
from vyasa.extensions_builtin.markdown.renderer import from_md
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
        render_markdown=lambda content, **kwargs: from_md(content, **kwargs),
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


def test_feedback_store_closes_sqlite_connections(tmp_path):
    store = FeedbackStore(tmp_path)

    with store._connect() as connection:
        connection.execute("SELECT 1").fetchone()

    try:
        connection.execute("SELECT 1").fetchone()
    except sqlite3.ProgrammingError:
        pass
    else:
        raise AssertionError("feedback sqlite connection stayed open")


def test_feedback_store_keeps_replies_out_of_agent_poll_filter(tmp_path):
    store = FeedbackStore(tmp_path)
    store.append(event_id="reply", document="plan", kind="reply", payload={"message": "Done"})
    feedback = store.append(event_id="note", document="plan", kind="feedback", payload={"comment": "Change it"})

    events = store.after("plan", 0, kinds=("feedback",))

    assert [event_payload(event)["id"] for event in events] == [feedback.id]


def test_storage_namespace_assigns_path_and_preserves_legacy_database(tmp_path):
    legacy = tmp_path / ".vyasa-feedback.db"
    legacy.write_bytes(b"existing")
    namespace = StorageNamespace("feedback", tmp_path / ".vyasa-storage" / "feedback", tmp_path)

    assigned = namespace.file("feedback.db", legacy_name=legacy.name)

    assert assigned == legacy
    assert assigned.read_bytes() == b"existing"
    legacy.unlink()
    assert namespace.file("feedback.db", legacy_name=legacy.name) == (
        tmp_path / ".vyasa-storage" / "feedback" / "feedback.db"
    )


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
            "snapshot": {"selected": "Generalize the loop.", "dom": "<main>large</main>"},
        })))
        created_payload = json.loads(created.body)
        assert created.status_code == 201
        assert created_payload["presence"] == "waiting"
        assert created_payload["event"]["target"]["locator"]["heading_path"] == ["Plan"]
        assert created_payload["event"]["snapshot"]["source_selected"] == "Generalize the loop."
        assert "dom" not in created_payload["event"]["snapshot"]

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

        response = asyncio.run(reply("plan", FakeRequest({"message": "Updated", "ack_cursor": cursor, "refresh": True})))
        reply_event = json.loads(response.body)["event"]
        assert response.status_code == 201
        assert store.recent("plan")[-1].payload["message"] == "Updated"
        assert store.recent("plan")[-1].payload["action"] == "refresh"
        assert reply_event["action"] == "refresh"
        assert store.recent("plan")[-1].payload["message_html"]
    finally:
        set_runtime_services(None)


def test_feedback_reply_renders_with_vyasa_markdown(tmp_path):
    set_runtime_services({"content_path_for_slug": lambda slug, suffix="": tmp_path / f"{slug}{suffix}"})
    try:
        handlers, store, _ = feedback_handlers(tmp_path)
        reply = handlers[("POST", "/api/feedback/reply/{path:path}")]
        session = handlers[("GET", "/api/feedback/session/{path:path}")]

        response = asyncio.run(reply("plan", FakeRequest({
            "message": "**bold**\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n$$\nx=1\n$$",
        })))
        event = json.loads(response.body)["event"]
        state = json.loads(asyncio.run(session("plan", FakeRequest())).body)

        assert response.status_code == 201
        assert "<strong>bold</strong>" in event["message_html"]
        assert "vyasa-table-scroll" in event["message_html"]
        assert "$$\nx=1\n$$" in event["message_html"]
        assert state["events"][0]["message_html"] == event["message_html"]
        assert store.recent("plan")[-1].payload["message_html"] == event["message_html"]
    finally:
        set_runtime_services(None)


def test_feedback_poll_times_out_without_idle_waiting_status(tmp_path):
    handlers, _, _ = feedback_handlers(tmp_path)
    poll = handlers[("GET", "/api/feedback/poll/{path:path}")]

    timed_out = asyncio.run(poll("plan", FakeRequest(query={"after": "0", "timeout": "0"})))
    payload = json.loads(timed_out.body)

    assert payload["status"] == "timeout"
    assert payload["events"] == []


def test_feedback_poll_wakes_when_feedback_arrives(tmp_path):
    document = tmp_path / "plan.md"
    document.write_text("# Plan\n\nGeneralize the loop.\n", encoding="utf-8")
    set_runtime_services({"content_path_for_slug": lambda slug, suffix="": tmp_path / f"{slug}{suffix}"})
    try:
        handlers, _, _ = feedback_handlers(tmp_path)
        create = handlers[("POST", "/api/feedback/submit/{path:path}")]
        poll = handlers[("GET", "/api/feedback/poll/{path:path}")]

        async def run_poll_then_submit():
            pending = asyncio.create_task(poll("plan", FakeRequest(query={"after": "0", "timeout": "2"})))
            await asyncio.sleep(0.01)
            await create("plan", FakeRequest({"comment": "Clarify", "surface": "markdown"}))
            return await pending

        payload = json.loads(asyncio.run(run_poll_then_submit()).body)

        assert payload["status"] == "feedback"
        assert payload["events"][0]["comment"] == "Clarify"
    finally:
        set_runtime_services(None)


def test_feedback_poll_cancellation_returns_client_closed_status(tmp_path):
    handlers, _, presence = feedback_handlers(tmp_path)
    poll = handlers[("GET", "/api/feedback/poll/{path:path}")]

    async def run_and_cancel():
        pending = asyncio.create_task(poll("plan", FakeRequest(query={"after": "0", "timeout": "30"})))
        await asyncio.sleep(0.01)
        pending.cancel()
        return await pending

    cancelled = asyncio.run(run_and_cancel())
    payload = json.loads(cancelled.body)

    assert cancelled.status_code == 499
    assert payload["status"] == "cancelled"
    assert presence.is_listening("plan") is False


def test_feedback_reply_then_poll_reuses_one_cli_call(monkeypatch, capsys):
    calls = []

    def fake_request_json(url, *, method="GET", payload=None, timeout=60):
        calls.append((url, method, payload, timeout))
        if method == "POST":
            return {"ok": True, "ack_cursor": 7}
        return {"status": "feedback", "cursor": 8, "events": []}

    monkeypatch.setattr("vyasa.extensions_builtin.feedback.cli.request_json", fake_request_json)

    assert feedback_command(["reply", "plan", "--message", "Done", "--ack", "7", "--refresh", "--then-poll", "--timeout", "12"]) == 0

    assert calls[0][1] == "POST"
    assert calls[0][2]["refresh"] is True
    assert calls[1][0].endswith("/api/feedback/poll/plan?timeout=12.0&after=7")
    assert calls[1][3] == 22.0
    assert "status: \"feedback\"" in capsys.readouterr().out


def test_feedback_bundle_contains_browser_interfaces():
    static_dir = Path(__file__).parents[1] / "vyasa" / "extensions_builtin" / "feedback" / "static"

    assert {path.name for path in static_dir.iterdir()} >= {
        "feedback.js",
        "lavish-capture.js",
        "review_targets.js",
    }
