from pathlib import Path
import json
import time
from types import SimpleNamespace

from fasthtml.common import Div, NotStr
from loguru import logger

from ...assets import bundle_asset_nodes
from ...document_pages import DocumentPage
from ...extensions import AssetBundle, DocumentType, ExtensionMeta, VyasaExtensionBase, request_asset_bundle
from ...helpers import content_slug_for_path
from .api import register_tasks_routes
from .items_pack import read_schema
from .render import render_tasks_block


class TasksExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.documents.document_type(DocumentType(".kg", "kg", "network"))
        app.documents.renderer("kg", render_kg_document)
        app.documents.static_renderer("kg", render_static_kg_document)
        app.routes.add("/api/tasks", register_tasks_routes)
        app.assets.bundle(AssetBundle(
            "tasks.runtime",
            css=("/static/markdown.css", "/static/extensions/tasks/tasks.css"),
            js=("/static/extensions/tasks/tasks_probe.js", "/static/extensions/tasks/tasks.js"),
        ))
        app.assets.page(_page_bundles)
        items_handler = lambda code, context, attrs: (
            request_asset_bundle("tasks.runtime"),
            render_tasks_block(code, context.current_path if context else None, "items"),
        )[1]
        tasks_handler = lambda code, context, attrs: (
            request_asset_bundle("tasks.runtime"),
            render_tasks_block(code, context.current_path if context else None, "tasks"),
        )[1]
        app.markdown.fence("items", items_handler)
        app.markdown.fence("tasks", tasks_handler)


def _kg_schema_path(pack_path: Path) -> Path:
    return pack_path / "kg.schema"


def _kg_block(schema_path: Path) -> str:
    return f"---\nitems_schema: {schema_path}\nstandalone: true\nwidth: 100%\ndefault_open_depth: -1\n---\n"


def _kg_title(schema_path: Path, fallback: str) -> str:
    try:
        graph = read_schema(schema_path).graph
        if graph.get("title"):
            return graph["title"]
        if graph.get("id"):
            return graph["id"]
    except (OSError, ValueError):
        pass
    return Path(fallback).name


def _kg_perf_enabled(context) -> bool:
    request = getattr(context, "request", None)
    query_params = getattr(request, "query_params", {}) if request is not None else {}
    return "tasks_perf" in query_params or "tasks_debug" in query_params


def _kg_perf_logger(context):
    if not _kg_perf_enabled(context):
        return lambda _phase, **_payload: None
    started = time.perf_counter()
    phase_started = started

    def log_phase(phase: str, **payload):
        nonlocal phase_started
        now = time.perf_counter()
        event = {
            "path": getattr(context, "path", ""),
            "phase": phase,
            "phase_ms": round((now - phase_started) * 1000, 2),
            "total_ms": round((now - started) * 1000, 2),
            **payload,
        }
        phase_started = now
        logger.info("[tasks_perf][kg-render] " + json.dumps(event, default=str, separators=(",", ":")))

    return log_phase


def render_kg_document(context):
    log_phase = _kg_perf_logger(context)
    schema_path = _kg_schema_path(context.document.path)
    log_phase("schema_path", schema_path=str(schema_path))
    title = _kg_title(schema_path, context.path)
    log_phase("title", title=title)
    request_asset_bundle("tasks.runtime")
    log_phase("request_asset_bundle")
    block = render_tasks_block(_kg_block(schema_path), context.path, "items")
    log_phase("render_tasks_block", block_bytes=len(block.encode("utf-8", "replace")))
    content = Div(
        context.breadcrumbs,
        NotStr(block),
    )
    log_phase("content_nodes")
    page = DocumentPage(
        title,
        context.path,
        content,
        file_path=str(schema_path),
        show_toc=False,
        full_width=True,
        no_scroll=True,
        extra_head_nodes=bundle_asset_nodes(("tasks.runtime",)),
    )
    log_phase("document_page")
    rendered = page.render(context.layout, htmx=context.htmx, blog_title=context.blog_title, auth=context.auth)
    log_phase("document_page_render")
    return rendered


def render_static_kg_document(context):
    schema_path = _kg_schema_path(context.doc_file)
    slug = content_slug_for_path(context.doc_file) or str(context.relative_path)
    title = _kg_title(schema_path, slug)
    request_asset_bundle("tasks.runtime")
    content = render_tasks_block(_kg_block(schema_path), slug, "items")
    return SimpleNamespace(title=title, raw_content=schema_path.read_text(encoding="utf-8"), toc_items=None, content_html=content)


def _page_bundles(context):
    return ("tasks.runtime",) if context.get("mode") == "static" else ()


EXTENSION = TasksExtension(
    ExtensionMeta(
        "tasks",
        "render",
        ("cap:markdown:fence:items", "cap:markdown:fence:tasks", "bundle:tasks.runtime", "cap:route:tasks", "cap:document_type:kg"),
        requires=("cap:markdown_pipeline",),
        route_prefixes=("/api/tasks",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
