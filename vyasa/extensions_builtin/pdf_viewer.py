from pathlib import Path
from types import SimpleNamespace

from fasthtml.common import A, Button, Div, H1, NotStr, P, to_xml

from ..document_pages import PAGE_TITLE_CLS, DocumentPage
from ..extensions import DocumentType, ExtensionMeta, VyasaExtensionBase
from ..helpers import content_url_for_slug


class PdfViewerExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.documents.document_type(DocumentType(".pdf", "pdf", "file"))
        app.documents.renderer("pdf", render_pdf_document)
        app.documents.static_renderer("pdf", render_static_pdf_document)


def render_pdf_document(context):
    title = f"{context.slug_to_title(Path(context.path).name, abbreviations=context.abbreviations)} (PDF)"
    pdf_src = content_url_for_slug(context.path, suffix=".pdf")
    content = Div(
        context.breadcrumbs,
        Div(
            H1(title, cls=PAGE_TITLE_CLS),
            Button(
                "Focus PDF",
                cls="pdf-focus-toggle inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                type="button",
                data_pdf_focus_toggle="true",
                data_pdf_focus_label="Focus PDF",
                data_pdf_exit_label="Exit focus",
                aria_pressed="false",
            ),
            cls="flex items-center justify-between gap-4 flex-wrap mb-6",
        ),
        NotStr(
            f'<object data="{pdf_src}" type="application/pdf" class="pdf-viewer w-full h-[calc(100vh-14rem)] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"><p class="p-4 text-sm text-slate-600 dark:text-slate-300">PDF preview not available. <a href="{pdf_src}" class="text-blue-600 hover:underline">Download PDF</a>.</p></object>'
        ),
    )
    return DocumentPage(title, context.path, content, file_path=str(context.document.path), show_toc=False).render(
        context.layout,
        htmx=context.htmx,
        blog_title=context.blog_title,
        auth=context.auth,
    )


def render_static_pdf_document(context):
    title = f"{context.slug_to_title(context.doc_file.stem, abbreviations=context.abbreviations)} (PDF)"
    output_pdf = context.output_dir / "posts" / context.relative_path
    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    output_pdf.write_bytes(context.doc_file.read_bytes())
    pdf_href = content_url_for_slug(context.relative_path.with_suffix("").as_posix(), suffix=".pdf")
    content = Div(
        P(
            "PDF file: ",
            A(context.relative_path.as_posix(), href=pdf_href, cls="text-blue-600 hover:underline"),
            cls="text-sm text-slate-600 dark:text-slate-300 mb-4",
        ),
        NotStr(
            f'<object data="{pdf_href}" type="application/pdf" class="pdf-viewer w-full h-[calc(100vh-14rem)] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"><p class="p-4 text-sm text-slate-600 dark:text-slate-300">PDF preview not available. <a href="{pdf_href}" class="text-blue-600 hover:underline">Download PDF</a>.</p></object>'
        ),
    )
    return SimpleNamespace(title=title, raw_content="", toc_items=None, content_html=to_xml(content))


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
