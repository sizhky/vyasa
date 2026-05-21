from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase, request_asset_bundle
from .render import render_d2_block


class D2Extension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.assets.bundle(AssetBundle("d2.runtime", js=("/static/extensions/d2/d2.js",)))
        app.markdown.fence(
            "d2",
            lambda code, context, attrs: (
                request_asset_bundle("d2.runtime"),
                render_d2_block(code),
            )[1],
        )


EXTENSION = D2Extension(
    ExtensionMeta(
        "d2",
        "render",
        ("cap:markdown:fence:d2", "bundle:d2.runtime"),
        requires=("cap:markdown_pipeline",),
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
