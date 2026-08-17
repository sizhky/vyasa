from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase, request_asset_bundle
from .api import register_mermaid_routes
from .render import render_mermaid_block


class MermaidExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.routes.add("/api/mermaid", register_mermaid_routes)
        app.assets.bundle(AssetBundle("mermaid.runtime", css=("/static/extensions/mermaid/mermaid.css",), js=("/static/extensions/mermaid/mermaid.js",)))
        app.markdown.fence(
            "mermaid",
            lambda code, context, attrs: (
                request_asset_bundle("mermaid.runtime"),
                render_mermaid_block(code),
            )[1],
        )


EXTENSION = MermaidExtension(
    ExtensionMeta(
        "mermaid",
        "render",
        ("cap:markdown:fence:mermaid", "bundle:mermaid.runtime", "cap:route:mermaid"),
        requires=("cap:markdown_pipeline",),
        route_prefixes=("/api/mermaid",),
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
