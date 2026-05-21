from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase
from .routes import register_link_preview_routes


class LinkPreviewExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.assets.bundle(
            AssetBundle(
                "link_preview.runtime",
                css=("/static/extensions/link_preview/link_preview.css",),
                js=("/static/extensions/link_preview/link_preview.js",),
            )
        )
        app.routes.add("/preview/link", register_link_preview_routes)


EXTENSION = LinkPreviewExtension(
    ExtensionMeta(
        "link_preview",
        "render",
        ("bundle:link_preview.runtime",),
        requires=("cap:markdown_pipeline",),
        route_prefixes=("/preview/link",),
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
