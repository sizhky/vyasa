from __future__ import annotations

from ..extensions import ExtensionMeta, VyasaExtensionBase
from ..favicon import favicon_href


class DefaultFaviconExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.layout.favicon(_favicon_href)


def _favicon_href(root_folder):
    return favicon_href(root_folder)


EXTENSION = DefaultFaviconExtension(
    ExtensionMeta(
        "default_favicon",
        "render",
        ("cap:asset:favicon",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
