from ..extensions import ExtensionMeta, VyasaExtensionBase


def _layout_provider(*args, **kwargs):
    from .. import core
    from ..layout_page import render_page_frame

    htmx = kwargs.pop("htmx")
    frame = core.default_page_frame(*args, **kwargs)
    return render_page_frame(frame, htmx=htmx, deps=core._default_page_frame_deps())


class DefaultLayoutExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.layout.slot("layout", _layout_provider)


EXTENSION = DefaultLayoutExtension(ExtensionMeta("default_layout", "layout", ("slot:layout",)))
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
