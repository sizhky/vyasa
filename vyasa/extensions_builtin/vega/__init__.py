"""Vega-Lite chart blocks.

Kept out of the visuals registry on purpose: a registry visual takes rows and
options, while a Vega-Lite block takes a whole grammar. Mixing the two would
make the registry's shared row grammar a lie.
"""

from __future__ import annotations

from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase, request_asset_bundle
from .render import collect_data_blocks, render_altair_block, render_altair_data_block, render_vega_block

BUNDLE = "vega.runtime"


class VegaExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.assets.bundle(
            AssetBundle(
                BUNDLE,
                css=("/static/extensions/vega/vega.css",),
                js=("/static/extensions/vega/vega.js",),
            )
        )

        def handler(code, context, attrs):
            request_asset_bundle(BUNDLE)
            return render_vega_block(code, attrs, getattr(context, "current_path", None))

        for name in ("vega", "vegalite", "vega-lite"):
            app.markdown.fence(name, handler)

        def altair_handler(code, context, attrs):
            request_asset_bundle(BUNDLE)
            return render_altair_block(
                code,
                attrs,
                getattr(context, "current_path", None),
                getattr(context, "extension_state", None),
            )

        for name in ("altair", "vega-altair"):
            app.markdown.fence(name, altair_handler)

        # The preprocessor captures `altair-data` blocks for the whole document
        # before any fence renders, so an `altair` block may precede its data.
        app.markdown.preprocessor(collect_data_blocks)

        def altair_data_handler(code, context, attrs):
            return render_altair_data_block(code, attrs, getattr(context, "current_path", None))

        app.markdown.fence("altair-data", altair_data_handler)


EXTENSION = VegaExtension(
    ExtensionMeta(
        "vega",
        "render",
        (
            "cap:markdown:fence:vega",
            "cap:markdown:fence:vegalite",
            "cap:markdown:fence:vega-lite",
            "cap:markdown:fence:altair",
            "cap:markdown:fence:vega-altair",
            "cap:markdown:fence:altair-data",
            f"bundle:{BUNDLE}",
        ),
        requires=("cap:markdown_pipeline",),
        description="Render Vega-Lite JSON specs, and Altair Python code, as charts.",
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
