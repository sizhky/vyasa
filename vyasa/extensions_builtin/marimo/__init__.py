from ...extensions import DocumentType, ExtensionMeta, VyasaExtensionBase
from .render import is_marimo_path, render_marimo_document, render_static_marimo_document


class MarimoExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.documents.kind_resolver("marimo", "flask-conical", is_marimo_path)
        app.documents.renderer("marimo", render_marimo_document)
        app.documents.static_renderer("marimo", render_static_marimo_document)


EXTENSION = MarimoExtension(
    ExtensionMeta(
        "marimo",
        "render",
        ("cap:document_type:marimo",),
        requires=("slot:layout", "cap:markdown_pipeline"),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
