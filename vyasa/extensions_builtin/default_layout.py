from ..extensions import ExtensionMeta, VyasaExtensionBase


def _layout_provider(*args, **kwargs):
    from .. import core

    return core._default_layout(*args, **kwargs)


class DefaultLayoutExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.layout.slot("layout", _layout_provider)


EXTENSION = DefaultLayoutExtension(ExtensionMeta("default_layout", "layout", ("slot:layout",)))
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
