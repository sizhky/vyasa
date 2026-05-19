from ...document_pages import DocumentActionItem, present_button
from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase
from ...runtime_services import get_runtime_services


class SlidesExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.assets.bundle(
            AssetBundle(
                "slides.runtime",
                css=("/static/extensions/slides/present.css",),
                js=("/static/extensions/slides/present.js",),
            )
        )
        app.assets.page(_page_bundles)
        app.routes.add("/slides", _register_slides_route)
        app.layout.mode("slide", _slide_renderer)
        app.documents.action(_present_document_action)


def _slide_renderer(path: str, htmx, request):
    from ... import content_routes

    services = get_runtime_services()
    return content_routes.render_slide_deck(
        path,
        htmx,
        request,
        get_root_folder=services.get_root_folder,
        not_found=services.not_found,
        get_roles_from_auth=services.get_roles_from_auth,
        rbac_rules=services.rbac_rules(),
        rbac_cfg=services.rbac_cfg(),
        google_oauth_cfg=services.google_oauth_cfg(),
        coerce_list=services.coerce_list,
        is_allowed=services.is_allowed,
        parse_frontmatter=services.parse_frontmatter,
        resolve_markdown_title=services.resolve_markdown_title,
        slug_to_title=services.slug_to_title,
        effective_abbreviations=services.effective_abbreviations,
        from_md=services.from_md,
        layout=services.layout,
    )


def _register_slides_route(rt, runtime):
    @rt("/slides/{path:path}")
    def slide_deck(path: str, htmx, request):
        return _slide_renderer(path, htmx, request)


def _present_document_action(context):
    if not context.current_path:
        return None
    return DocumentActionItem(
        id="slides.present",
        node=present_button(context.current_path),
        order=20,
    )


def _page_bundles(context):
    return ("slides.runtime",) if context.get("slide_mode") else ()


EXTENSION = SlidesExtension(
    ExtensionMeta(
        "slides",
        "route",
        ("cap:route:slides", "cap:layout:mode:slide", "bundle:slides.runtime"),
        requires=("slot:layout", "cap:markdown_pipeline",),
        route_prefixes=("/slides",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
