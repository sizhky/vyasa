from ..extensions import ExtensionMeta, VyasaExtensionBase


def _error_provider(htmx=None, auth=None):
    from .. import core

    return core._default_not_found(htmx=htmx, auth=auth)


class DefaultErrorsExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.layout.slot("error_pages", _error_provider)


EXTENSION = DefaultErrorsExtension(
    ExtensionMeta(
        "default_errors",
        "errors",
        ("slot:error_pages",),
        requires=("slot:layout",),
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
