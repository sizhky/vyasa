from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase, request_asset_bundle
from .render import render_cytograph_block


class CytographExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.assets.bundle(AssetBundle("cytograph.runtime", js=("/static/scripts.js",)))
        app.markdown.fence(
            "cytograph",
            lambda code, context, attrs: (
                request_asset_bundle("cytograph.runtime"),
                render_cytograph_block(code, context.current_path if context else None),
            )[1],
        )


EXTENSION = CytographExtension(
    ExtensionMeta(
        "cytograph",
        "render",
        ("cap:markdown:fence:cytograph", "bundle:cytograph.runtime"),
        requires=("cap:markdown_pipeline",),
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
