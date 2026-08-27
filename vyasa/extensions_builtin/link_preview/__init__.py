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
        app.markdown.preprocessor(preprocess_code_references)
        app.routes.static_build("cap:static_verify:code_references", verify_code_references)
        app.routes.add("/preview/link", register_link_preview_routes)


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
