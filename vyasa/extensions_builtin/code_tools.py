from __future__ import annotations

from ..extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase


class CodeToolsExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.assets.bundle(
            AssetBundle(
                "code_tools.runtime",
                js=(
                    "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js",
                    "/static/extensions/code_tools/code_tools.js",
                ),
            )
        )


EXTENSION = CodeToolsExtension(
    ExtensionMeta(
        "code_tools",
        "render",
        ("bundle:code_tools.runtime",),
        requires=("cap:markdown_pipeline",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
