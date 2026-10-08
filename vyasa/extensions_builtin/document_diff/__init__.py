from fasthtml.common import Div, NotStr

from ...content_backend import owning_clone, staged_text, unstaged_paths
from ...document_pages import DocumentActionItem, DocumentPage, diff_button, document_header
from ...extensions import ExtensionMeta, VyasaExtensionBase
from ...helpers import content_path_for_slug
from ...runtime_services import get_runtime_services


class DocumentDiffExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.routes.add("/diff", _register_diff_route)
        app.documents.action(_diff_action)


def _unstaged(slug: str):
    """(file path, clone, repo-relative path) for a `.md` slug with unstaged changes, else None."""
    file_path = content_path_for_slug(slug, ".md")
    if file_path is None or not file_path.is_file():
        return None
    found = owning_clone(file_path)
    if found is None or found[1] not in unstaged_paths(found[0]):
        return None
    return (file_path, *found)


def _diff_action(context):
    """Offer the toggle only for an on-disk file whose working tree differs from the index.

    Git-ref pages leave ``file_path`` unset, so they never show it.
    """
    if not context.file_path or _unstaged(context.current_path) is None:
        return None
    return DocumentActionItem(id="documents.diff", node=diff_button(context.current_path), order=25)


def render_document_diff(path: str, htmx, request, runtime=None):
    from ..link_preview.code_reference_render import markdown_diff_html

    services = get_runtime_services()
    slug = str(path or "").strip("/")
    found = _unstaged(slug)
    if found is None or (runtime is not None and not runtime.can_read_post(slug, request)):
        return services.not_found(htmx, auth=request.scope.get("auth"))
    file_path, rc, rel = found
    after = file_path.read_text(encoding="utf-8")
    title, _content = services.resolve_markdown_title(file_path)
    body = markdown_diff_html(staged_text(rc, rel), after, slug)
    content = Div(
        document_header(title, after, actions=(diff_button(slug, active=True),), file_path=file_path),
        Div(NotStr(body), data_vyasa_document_body="true", cls="w-full"),
        cls="w-full",
    )
    page = DocumentPage(title, slug, content, file_path=str(file_path), toc_source="")
    return page.render(services.layout, htmx=htmx, blog_title=services.get_blog_title(), auth=request.scope.get("auth"))


def _register_diff_route(rt, runtime):
    @rt("/diff/{path:path}")
    def document_diff(path: str, htmx, request):
        return render_document_diff(path, htmx, request, runtime)


EXTENSION = DocumentDiffExtension(
    ExtensionMeta(
        "document_diff",
        "route",
        ("cap:route:document_diff", "cap:documents:action:diff"),
        requires=("slot:layout", "cap:markdown_pipeline", "bundle:link_preview.runtime"),
        route_prefixes=("/diff",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META", "render_document_diff"]
