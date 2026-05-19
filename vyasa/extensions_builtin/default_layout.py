from ..extensions import ExtensionMeta, VyasaExtensionBase
from ..runtime_services import get_runtime_services


def _layout_provider(*args, **kwargs):
    from ..layout_page import render_page_frame

    services = get_runtime_services()
    htmx = kwargs.pop("htmx")
    frame = services.default_page_frame(*args, **kwargs)
    return render_page_frame(frame, htmx=htmx, deps=services.default_page_frame_deps())


class DefaultLayoutExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.layout.slot("layout", _layout_provider)


EXTENSION = DefaultLayoutExtension(ExtensionMeta("default_layout", "layout", ("slot:layout",)))
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
