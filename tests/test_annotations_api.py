import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from typing import cast

from vyasa.extensions_builtin.annotations.api import CallableAnnotationStore, register_annotations_routes
from vyasa.extensions_builtin.annotations.store import AnnotationRow, list_all_annotations, upsert_annotation
from vyasa.runtime_context import RuntimeAccess


class Request:
    def __init__(self, body: bytes = b""):
        self._body = body

    async def body(self) -> bytes:
        return self._body


def handlers_for(rows):
    handlers = {}

    def rt(path, methods):
        return lambda handler: handlers.update({(method, path): handler for method in methods}) or handler

    runtime = cast(RuntimeAccess, SimpleNamespace(
        config=SimpleNamespace(get_annotations_enabled=lambda: True, get_root_folder=lambda: Path("/site")),
        can_read_post=lambda path, request: path != "private",
        auth_for_request=lambda request: {"name": "Yeshwanth"},
    ))
    store = CallableAnnotationStore(lambda path: [], lambda: rows, lambda row: None, lambda annotation_id: False)
    register_annotations_routes(rt, runtime, store)
    return handlers


def row(path: str) -> AnnotationRow:
    return AnnotationRow(path, path, "", "quote", "", "", "{}", "comment", "author", "1", "1")


def test_all_annotations_filters_unreadable_documents():
    handler = handlers_for([row("public"), row("private")])[("GET", "/api/annotations")]

    response = asyncio.run(handler(Request()))

    assert [item["path"] for item in json.loads(response.body)] == ["public"]


def test_store_lists_all_annotations_by_path(tmp_path):
    cache = {"db": None, "tbl": None}
    upsert_annotation(tmp_path, cache, row("two"))
    upsert_annotation(tmp_path, cache, row("one"))

    assert [item.path for item in list_all_annotations(tmp_path, cache)] == ["one", "two"]


def test_export_replaces_one_deterministic_markdown_file(tmp_path, monkeypatch):
    monkeypatch.setattr("tempfile.tempdir", str(tmp_path))
    handler = handlers_for([])[("POST", "/api/annotations/export")]

    response = asyncio.run(handler(Request(b"annotations")))
    export_path = Path(json.loads(response.body)["path"])
    next_response = asyncio.run(handler(Request(b"updated")))
    next_path = Path(json.loads(next_response.body)["path"])

    assert export_path == next_path
    assert export_path.read_text() == "updated"
    assert export_path.parent == tmp_path
    assert len(list(tmp_path.glob("vyasa-annotations-*.md"))) == 1
