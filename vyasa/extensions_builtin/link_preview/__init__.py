from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase


class LinkPreviewExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        from .code_reference_build import verify_code_references
        from .code_reference_markdown import preprocess_code_references
        from .routes import register_link_preview_routes

        app.assets.bundle(
            AssetBundle(
                "link_preview.runtime",
                css=(
                    "/static/extensions/link_preview/link_preview.css",
                    "/static/extensions/link_preview/code_reference.css",
                ),
                js=("/static/extensions/link_preview/link_preview.js",),
                depends_on=("code_tools.runtime",),
            )
        )
        app.assets.page(_page_bundles)
        app.navigation.sidebar_row_decorator(_preview_sidebar_row)
        app.markdown.preprocessor(preprocess_code_references)
        app.routes.static_build("cap:static_verify:code_references", verify_code_references)
        app.routes.add("/preview/link", register_link_preview_routes)


def _page_bundles(context):
    return ("link_preview.runtime",) if context.get("show_sidebar") else ()


def _preview_sidebar_row(node, *, slug=None, title="", context="tree"):
    attrs = getattr(node, "attrs", None)
    if attrs is not None and attrs.get("href"):
        attrs["data-vyasa-link-preview"] = "true"
    return node


EXTENSION = LinkPreviewExtension(
    ExtensionMeta(
        "link_preview",
        "render",
        ("bundle:link_preview.runtime", "cap:static_verify:code_references"),
        requires=("cap:markdown_pipeline", "bundle:code_tools.runtime"),
        route_prefixes=("/preview/link",),
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
