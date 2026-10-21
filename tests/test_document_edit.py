import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

from vyasa.document_pages import DocumentActionContext, resolve_document_actions
from vyasa.extensions import build_extension_runtime, set_extension_runtime
from vyasa.extensions_builtin.document_edit import EXTENSION
from vyasa.extensions_builtin.document_edit.api import (
    register_document_block_routes,
    register_document_preview_routes,
    register_document_source_routes,
)
from vyasa.config import reload_config
from vyasa.helpers import atomic_write_bytes

import pytest


@pytest.fixture(autouse=True)
def restore_global_config():
    """These tests chdir and write `.vyasa` files; put the global config back."""
    yield
    reload_config()


def _collect_routes(runtime=None):
    handlers = {}

    def rt(pattern, **kwargs):
        def keep(fn):
            handlers[(pattern, tuple(kwargs.get("methods", ("GET",))))] = fn
            return fn

        return keep

    register_document_source_routes(rt, runtime)
    register_document_preview_routes(rt, runtime)
    return handlers


def _request(*, host="127.0.0.1", body=b"", query=None):
    async def read_body():
        return body

    return SimpleNamespace(
        client=SimpleNamespace(host=host),
        body=read_body,
        query_params=query or {},
        scope={},
    )


def _payload(response):
    return json.loads(response.body.decode("utf-8"))


def _with_content_root(tmp_path, monkeypatch, *, edit=True):
    if edit:
        monkeypatch.setenv("VYASA_DOCUMENT_EDIT", "true")
    else:
        monkeypatch.delenv("VYASA_DOCUMENT_EDIT", raising=False)
    monkeypatch.chdir(tmp_path)
    reload_config()
    from vyasa import helpers

    monkeypatch.setattr(helpers, "content_path_for_slug", lambda slug, suffix="": tmp_path / f"{slug}{suffix}")
    from vyasa.extensions_builtin.document_edit import api

    monkeypatch.setattr(api, "content_path_for_slug", lambda slug, suffix="": tmp_path / f"{slug}{suffix}")


def test_edit_routes_are_published_on_documents_namespace():
    handlers = _collect_routes()

    assert ("/api/documents/source/{path:path}", ("GET",)) in handlers
    assert ("/api/documents/source/{path:path}", ("POST",)) in handlers
    assert ("/api/documents/preview/{path:path}", ("POST",)) in handlers


def test_extension_declares_its_route_prefixes():
    runtime = build_extension_runtime({})
    prefixes = {route["prefix"] for route in runtime.route_handlers}

    assert "/api/documents/source" in prefixes
    assert "/api/documents/preview" in prefixes
    assert EXTENSION.meta.id == "document_edit"


def test_read_returns_whole_file_including_frontmatter(tmp_path, monkeypatch):
    _with_content_root(tmp_path, monkeypatch)
    source = "---\ntitle: Notes\n---\n\n# Notes\n\nOne line.\n"
    (tmp_path / "notes.md").write_text(source, encoding="utf-8")

    handlers = _collect_routes()
    read = handlers[("/api/documents/source/{path:path}", ("GET",))]
    payload = _payload(read("notes", _request()))

    assert payload["source"] == source
    assert payload["editable"] is True
    assert payload["revision"] != "0"


def test_routes_refuse_a_document_that_is_not_markdown(tmp_path, monkeypatch):
    _with_content_root(tmp_path, monkeypatch)
    (tmp_path / "poster.pdf").write_bytes(b"%PDF-1.4\n")
    (tmp_path / "page.html").write_text("<h1>Page</h1>\n", encoding="utf-8")

    handlers = _collect_routes()
    read = handlers[("/api/documents/source/{path:path}", ("GET",))]
    save = handlers[("/api/documents/source/{path:path}", ("POST",))]

    assert read("poster", _request()).status_code == 404
    assert read("page", _request()).status_code == 404
    assert asyncio.run(save("poster", _request(body=b"hello"))).status_code == 404
    assert (tmp_path / "poster.pdf").read_bytes() == b"%PDF-1.4\n"


def test_save_writes_the_file_and_returns_rendered_html(tmp_path, monkeypatch):
    set_extension_runtime(build_extension_runtime({}))
    _with_content_root(tmp_path, monkeypatch)
    target = tmp_path / "notes.md"
    target.write_text("# Old\n", encoding="utf-8")

    handlers = _collect_routes()
    save = handlers[("/api/documents/source/{path:path}", ("POST",))]
    response = asyncio.run(save("notes", _request(body=b"# New\n\nFresh text.\n")))
    payload = _payload(response)

    assert payload["ok"] is True
    assert target.read_text(encoding="utf-8") == "# New\n\nFresh text.\n"
    assert "Fresh text." in payload["html"]


def test_save_rejects_a_stale_revision(tmp_path, monkeypatch):
    _with_content_root(tmp_path, monkeypatch)
    (tmp_path / "notes.md").write_text("# Old\n", encoding="utf-8")

    handlers = _collect_routes()
    save = handlers[("/api/documents/source/{path:path}", ("POST",))]
    response = asyncio.run(save("notes", _request(body=b"# New\n", query={"revision": "1"})))

    assert response.status_code == 409
    assert (tmp_path / "notes.md").read_text(encoding="utf-8") == "# Old\n"


def test_save_refuses_a_remote_client(tmp_path, monkeypatch):
    _with_content_root(tmp_path, monkeypatch)
    (tmp_path / "notes.md").write_text("# Old\n", encoding="utf-8")

    handlers = _collect_routes()
    save = handlers[("/api/documents/source/{path:path}", ("POST",))]
    response = asyncio.run(save("notes", _request(host="10.0.0.4", body=b"# New\n")))

    assert response.status_code == 403
    assert (tmp_path / "notes.md").read_text(encoding="utf-8") == "# Old\n"


def test_editing_is_off_unless_a_gate_turns_it_on(tmp_path, monkeypatch):
    _with_content_root(tmp_path, monkeypatch, edit=False)
    (tmp_path / "notes.md").write_text("# Old\n", encoding="utf-8")

    handlers = _collect_routes()
    save = handlers[("/api/documents/source/{path:path}", ("POST",))]
    response = asyncio.run(save("notes", _request(body=b"# New\n")))

    assert response.status_code == 403
    assert (tmp_path / "notes.md").read_text(encoding="utf-8") == "# Old\n"


def test_preview_renders_without_touching_the_file(tmp_path, monkeypatch):
    set_extension_runtime(build_extension_runtime({}))
    _with_content_root(tmp_path, monkeypatch)
    target = tmp_path / "notes.md"
    target.write_text("# Old\n", encoding="utf-8")

    handlers = _collect_routes()
    preview = handlers[("/api/documents/preview/{path:path}", ("POST",))]
    payload = _payload(asyncio.run(preview("notes", _request(body=b"# Draft\n\nNot saved.\n"))))

    assert "Not saved." in payload["html"]
    assert target.read_text(encoding="utf-8") == "# Old\n"


def test_preview_reports_the_bundles_a_mermaid_block_needs(tmp_path, monkeypatch):
    set_extension_runtime(build_extension_runtime({}))
    _with_content_root(tmp_path, monkeypatch)
    (tmp_path / "notes.md").write_text("# Old\n", encoding="utf-8")

    handlers = _collect_routes()
    preview = handlers[("/api/documents/preview/{path:path}", ("POST",))]
    plain = _payload(asyncio.run(preview("notes", _request(body=b"# Just text\n"))))
    diagram = _payload(
        asyncio.run(preview("notes", _request(body=b"# Chart\n\n```mermaid\ngraph TD;\nA-->B;\n```\n")))
    )

    # A block type the page did not open with needs its runtime named, or the
    # browser has no way to fetch it: a script inside injected HTML never runs.
    assert not any("mermaid" in url for url in plain["js"])
    assert any("mermaid" in url for url in diagram["js"])


def _rendered_actions(**kwargs):
    actions, _aux = resolve_document_actions(DocumentActionContext(**kwargs))
    return "".join(str(node) for node in actions)


def test_toggle_appears_for_a_file_and_not_for_a_git_ref(monkeypatch):
    monkeypatch.setenv("VYASA_DOCUMENT_EDIT", "true")
    reload_config()
    set_extension_runtime(build_extension_runtime({}))
    on_disk = _rendered_actions(title="Notes", current_path="notes", raw_content="# Notes\n", file_path="/tmp/notes.md")
    from_ref = _rendered_actions(title="Notes", current_path="notes", raw_content="# Notes\n")

    assert 'data-vyasa-edit-document="notes"' in on_disk
    assert "data-vyasa-edit-document" not in from_ref


def test_toggle_is_hidden_when_no_gate_is_on(tmp_path, monkeypatch):
    monkeypatch.delenv("VYASA_DOCUMENT_EDIT", raising=False)
    monkeypatch.chdir(tmp_path)
    reload_config()
    set_extension_runtime(build_extension_runtime({}))

    assert "data-vyasa-edit-document" not in _rendered_actions(
        title="Notes", current_path="notes", raw_content="# Notes\n", file_path="/tmp/notes.md"
    )


def test_each_gate_turns_editing_on_by_itself(tmp_path, monkeypatch):
    from vyasa.config import get_config

    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("VYASA_DOCUMENT_EDIT", raising=False)
    assert reload_config().get_document_edit() is False

    monkeypatch.setenv("VYASA_DOCUMENT_EDIT", "true")
    assert reload_config().get_document_edit() is True

    monkeypatch.delenv("VYASA_DOCUMENT_EDIT", raising=False)
    (tmp_path / ".vyasa").write_text("document_edit = true\n", encoding="utf-8")
    assert reload_config().get_document_edit() is True
    assert get_config().get_document_edit() is True


def test_atomic_write_replaces_content_in_one_step(tmp_path):
    target = tmp_path / "deep" / "notes.md"
    atomic_write_bytes(target, b"first\n")
    atomic_write_bytes(target, b"second\n")

    assert target.read_text(encoding="utf-8") == "second\n"
    assert list(tmp_path.joinpath("deep").glob("*.tmp")) == []


def test_blocks_render_one_html_per_block_with_shared_bundles(tmp_path, monkeypatch):
    set_extension_runtime(build_extension_runtime({}))
    _with_content_root(tmp_path, monkeypatch)
    target = tmp_path / "notes.md"
    target.write_text("# Old\n", encoding="utf-8")

    handlers = {}

    def rt(pattern, **kwargs):
        return lambda fn: handlers.setdefault(pattern, fn)

    register_document_block_routes(rt, None)
    blocks = handlers["/api/documents/blocks/{path:path}"]
    body = json.dumps({"blocks": ["# Kept heading", "| a |\n|---|\n| 1 |", "```mermaid\ngraph TD;\nA-->B;\n```"]})
    payload = _payload(asyncio.run(blocks("notes", _request(body=body.encode()))))

    # A leading `# ` block stays a heading: only whole-file renders drop the title.
    assert len(payload["blocks"]) == 3
    assert "<h1" in payload["blocks"][0]
    assert "<table" in payload["blocks"][1]
    assert any("mermaid" in url for url in payload["js"])
    assert target.read_text(encoding="utf-8") == "# Old\n"


def test_blocks_reject_a_body_that_is_not_a_list_of_strings(tmp_path, monkeypatch):
    _with_content_root(tmp_path, monkeypatch)
    (tmp_path / "notes.md").write_text("# Old\n", encoding="utf-8")
    handlers = {}
    register_document_block_routes(lambda pattern, **kw: (lambda fn: handlers.setdefault(pattern, fn)), None)
    blocks = handlers["/api/documents/blocks/{path:path}"]

    assert asyncio.run(blocks("notes", _request(body=b'{"blocks": [1]}'))).status_code == 400
    assert asyncio.run(blocks("notes", _request(body=b"not json"))).status_code == 400


def _proposal_routes():
    from vyasa.extensions_builtin.document_edit.api import register_document_proposal_routes
    from vyasa.extensions_builtin.document_edit.proposals import STORE

    STORE._items.clear()
    handlers = {}

    def rt(pattern, **kwargs):
        def keep(fn):
            handlers[(pattern, tuple(kwargs.get("methods", ("GET",))))] = fn
            return fn

        return keep

    register_document_proposal_routes(rt, None)
    write = handlers[("/api/documents/proposals/{path:path}", ("POST",))]
    listing = handlers[("/api/documents/proposals/{path:path}", ("GET",))]
    resolve = handlers[("/api/document-proposals/{proposal_id}/{action}", ("POST",))]
    return write, listing, resolve


def _post(handler, *args, body):
    return _payload(asyncio.run(handler(*args, _request(body=json.dumps(body).encode()))))


def test_proposal_never_writes_until_accepted(tmp_path, monkeypatch):
    set_extension_runtime(build_extension_runtime({}))
    _with_content_root(tmp_path, monkeypatch)
    target = tmp_path / "notes.md"
    target.write_text("# T\n\n## Now\nthe quick brown fox\n\n## Log\nkeep\n", encoding="utf-8")
    write, listing, resolve = _proposal_routes()

    made = _post(write, "notes", body={"heading": "## Now", "text": "the slow brown fox jumps", "origin": "card 7"})

    assert target.read_text(encoding="utf-8").count("quick") == 1
    assert [h["kind"] for h in made["hunks"]] == ["replace", "insert"]
    assert 'data-vyasa-hunk="0">slow</ins>' in made["marked"]
    listed = _payload(listing("notes", _request()))
    assert [p["id"] for p in listed["proposals"]] == [made["id"]]


def test_accepting_one_hunk_writes_only_that_hunk(tmp_path, monkeypatch):
    set_extension_runtime(build_extension_runtime({}))
    _with_content_root(tmp_path, monkeypatch)
    target = tmp_path / "notes.md"
    target.write_text("# T\n\n## Now\nthe quick brown fox\n\n## Log\nkeep\n", encoding="utf-8")
    write, _listing, resolve = _proposal_routes()
    made = _post(write, "notes", body={"heading": "## Now", "text": "the slow brown fox jumps"})

    after = _post(resolve, made["id"], "accept", body={"hunks": [0]})

    assert target.read_text(encoding="utf-8") == "# T\n\n## Now\nthe slow brown fox\n\n## Log\nkeep\n"
    assert "slow" in after["html"]
    # What is left is the other hunk, now numbered against the new base.
    assert [h["kind"] for h in after["proposal"]["hunks"]] == ["insert"]
    rejected = _post(resolve, made["id"], "reject", body={})
    assert rejected["proposal"] is None
    assert "jumps" not in target.read_text(encoding="utf-8")


def test_a_streaming_proposal_shows_the_unreached_tail_as_pending(tmp_path, monkeypatch):
    set_extension_runtime(build_extension_runtime({}))
    _with_content_root(tmp_path, monkeypatch)
    (tmp_path / "notes.md").write_text("## Now\none two three\n", encoding="utf-8")
    write, _listing, resolve = _proposal_routes()

    made = _post(write, "notes", body={"heading": "## Now", "text": "one 2", "partial": True})

    assert 'class="vyasa-diff-pending">two three</span>' in made["marked"]
    assert asyncio.run(resolve(made["id"], "accept", _request(body=b"{}"))).status_code == 409
    done = _post(write, "notes", body={"id": made["id"], "text": "one 2 three"})
    assert "vyasa-diff-pending" not in done["marked"]


def test_a_write_to_the_section_elsewhere_rebases_and_flags_the_proposal(tmp_path, monkeypatch):
    set_extension_runtime(build_extension_runtime({}))
    _with_content_root(tmp_path, monkeypatch)
    target = tmp_path / "notes.md"
    target.write_text("## Now\nalpha\n", encoding="utf-8")
    write, listing, _resolve = _proposal_routes()
    _post(write, "notes", body={"heading": "## Now", "text": "beta"})

    atomic_write_bytes(target, b"## Now\ngamma\n")
    import os
    os.utime(target, ns=(target.stat().st_atime_ns, target.stat().st_mtime_ns + 1000))
    listed = _payload(listing("notes", _request()))["proposals"][0]

    assert listed["stale_base"] is True
    assert "gamma" in listed["marked"] and "beta" in listed["marked"]


def test_proposals_refuse_a_remote_client(tmp_path, monkeypatch):
    _with_content_root(tmp_path, monkeypatch)
    (tmp_path / "notes.md").write_text("## Now\nx\n", encoding="utf-8")
    write, _listing, _resolve = _proposal_routes()
    body = json.dumps({"heading": "## Now", "text": "y"}).encode()

    assert asyncio.run(write("notes", _request(host="10.0.0.9", body=body))).status_code == 403
