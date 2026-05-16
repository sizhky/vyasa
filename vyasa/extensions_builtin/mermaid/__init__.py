from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase, request_asset_bundle
from .render import render_mermaid_block


class MermaidExtension(VyasaExtensionBase):
    def register(self, app) -> None:
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
        ("cap:markdown:fence:mermaid", "bundle:mermaid.runtime"),
        requires=("cap:markdown_pipeline",),
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
