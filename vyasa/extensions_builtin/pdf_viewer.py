from ..extensions import ExtensionMeta, VyasaExtensionBase


class PdfViewerExtension(VyasaExtensionBase):
    pass


EXTENSION = PdfViewerExtension(
    ExtensionMeta(
        "pdf_viewer",
        "render",
        ("cap:document_type:pdf",),
        requires=("slot:layout",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
