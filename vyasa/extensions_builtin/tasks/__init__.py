from pathlib import Path
from types import SimpleNamespace

from fasthtml.common import Div, NotStr

from ...assets import bundle_asset_nodes
from ...document_pages import DocumentPage
from ...extensions import AssetBundle, DocumentType, ExtensionMeta, VyasaExtensionBase, request_asset_bundle
from ...helpers import content_slug_for_path
from .api import register_tasks_routes
from .render import render_tasks_block
from .api import _compile_schema_payload


class TasksExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.documents.document_type(DocumentType(".kg", "kg", "network"))
        app.documents.renderer("kg", render_kg_document)
        app.documents.static_renderer("kg", render_static_kg_document)
        app.routes.add("/api/tasks", register_tasks_routes)
        app.assets.bundle(AssetBundle(
            "tasks.runtime",
            css=("/static/extensions/tasks/tasks.css",),
            js=("/static/extensions/tasks/tasks.js",),
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
    model, _graph = _compile_schema_payload(schema_path, fallback)
    return str(model.get("title") or model.get("graph_id") or Path(fallback).name)


def render_kg_document(context):
    schema_path = _kg_schema_path(context.document.path)
    title = _kg_title(schema_path, context.path)
    request_asset_bundle("tasks.runtime")
    content = Div(
        context.breadcrumbs,
        NotStr(render_tasks_block(_kg_block(schema_path), context.path, "items")),
    )
    return DocumentPage(
        title,
        context.path,
        content,
        file_path=str(schema_path),
        show_toc=False,
        full_width=True,
        no_scroll=True,
        extra_head_nodes=bundle_asset_nodes(("tasks.runtime",)),
    ).render(
        context.layout, htmx=context.htmx, blog_title=context.blog_title, auth=context.auth
    )


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
