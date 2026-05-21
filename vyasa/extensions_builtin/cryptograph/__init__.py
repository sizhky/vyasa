from ...extensions import ExtensionMeta, VyasaExtensionBase
from .render import render_cryptograph_block


class CryptographExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.markdown.fence("cryptograph", lambda code, context, attrs: render_cryptograph_block(code))


EXTENSION = CryptographExtension(
    ExtensionMeta(
        "cryptograph",
        "render",
        ("cap:markdown:fence:cryptograph",),
        requires=("cap:markdown_pipeline",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
