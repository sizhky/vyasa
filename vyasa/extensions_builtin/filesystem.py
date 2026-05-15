from ..extensions import ExtensionMeta, VyasaExtensionBase


class FilesystemExtension(VyasaExtensionBase):
    pass


EXTENSION = FilesystemExtension(
    ExtensionMeta(
        "filesystem",
        "content_source",
        ("cap:content_source:filesystem",),
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
