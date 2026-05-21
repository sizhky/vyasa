from pathlib import Path
from types import SimpleNamespace

from fasthtml.common import Div, NotStr

from ..document_pages import DocumentPage
from ..extensions import DocumentType, ExtensionMeta, VyasaExtensionBase
from ..tree_tables import parse_tree_table, render_tree_table_html


class TreeTableExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.documents.document_type(DocumentType(".tree", "tree", "table"))
        app.documents.renderer("tree", render_tree_document)
        app.documents.static_renderer("tree", render_static_tree_document)


def render_tree_document(context):
    tree_data = parse_tree_table(context.document.path)
    title = tree_data["sheet"] or context.slug_to_title(Path(context.path).name, abbreviations=context.abbreviations)
    content = Div(context.breadcrumbs, NotStr(render_tree_table_html(context.document.path)))
    return DocumentPage(title, context.path, content, file_path=str(context.document.path), show_toc=False).render(
        context.layout,
        htmx=context.htmx,
        blog_title=context.blog_title,
        auth=context.auth,
    )


def render_static_tree_document(context):
    title = parse_tree_table(context.doc_file)["sheet"] or context.slug_to_title(
        context.doc_file.stem,
        abbreviations=context.abbreviations,
    )
    return SimpleNamespace(
        title=title,
        raw_content=context.doc_file.read_text(encoding="utf-8"),
        toc_items=None,
        content_html=render_tree_table_html(context.doc_file, include_heading=False),
    )


EXTENSION = TreeTableExtension(
    ExtensionMeta(
        "tree_table",
        "render",
        ("cap:document_type:tree",),
        requires=("slot:layout",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
