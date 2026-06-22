from pathlib import Path
from types import SimpleNamespace

from fasthtml.common import A, Div, H1, Iframe, Span, to_xml

from ..document_pages import PAGE_TITLE_CLS, DocumentPage, action_icon
from ..extensions import DocumentType, ExtensionMeta, VyasaExtensionBase
from ..helpers import content_url_for_slug


class HtmlViewerExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.documents.document_type(DocumentType(".html", "html", "code"))
        app.documents.renderer("html", render_html_document)
        app.documents.static_renderer("html", render_static_html_document)


def _title(path, abbreviations, slug_to_title):
    return f"{slug_to_title(Path(path).stem, abbreviations=abbreviations)} (HTML)"


def _frame(**attrs):
    return Iframe(
        title="HTML document",
        cls="w-full h-[calc(100vh-14rem)] rounded-lg border border-slate-200 dark:border-slate-700 bg-white",
        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts",
        **attrs,
    )


def _popout(src):
    return A(
        action_icon("external-link"),
        Span("Open standalone", cls="text-sm font-medium"),
        href=src,
        target="_blank",
        rel="noopener",
        hx_boost="false",
        data_tooltip="Open raw HTML in a new tab",
        aria_label="Open raw HTML in a new tab",
        cls="vyasa-page-action-button vyasa-page-action-tooltip inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm",
    )


def render_html_document(context):
    title = _title(context.path, context.abbreviations, context.slug_to_title)
    src = content_url_for_slug(context.path, suffix=".html")
    content = Div(
        context.breadcrumbs,
        Div(
            H1(title, cls=PAGE_TITLE_CLS),
            _popout(src),
            cls="flex items-center justify-between gap-3 mb-6",
        ),
        _frame(src=src),
    )
    return DocumentPage(title, context.path, content, file_path=str(context.document.path), show_toc=False).render(
        context.layout, htmx=context.htmx, blog_title=context.blog_title, auth=context.auth
    )


def render_static_html_document(context):
    title = _title(context.doc_file, context.abbreviations, context.slug_to_title)
    source = context.doc_file.read_text(encoding="utf-8")
    content = _frame(srcdoc=source)
    return SimpleNamespace(title=title, raw_content="", toc_items=None, content_html=to_xml(content))


EXTENSION = HtmlViewerExtension(
    ExtensionMeta(
        "html_viewer",
        "render",
        ("cap:document_type:html",),
        requires=("slot:layout",),
        scope_disable=True,
    )
)
META = EXTENSION.meta
