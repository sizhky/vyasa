from ..extensions import ContentRootRequest, ExtensionMeta, VyasaExtensionBase


class FilesystemExtension(VyasaExtensionBase):
    def register(self, app):
        app.content_source.mount_provider(filesystem_mounts)
        app.content_source.root_resolver(resolve_content_root)


def filesystem_mounts():
    from ..helpers import _config_content_mounts

    return _config_content_mounts()


def resolve_content_root(request: ContentRootRequest):
    if request.ref:
        return None
    for alias, root in filesystem_mounts():
        if request.root_id == alias:
            return root
    return None


EXTENSION = FilesystemExtension(
    ExtensionMeta(
        "filesystem",
        "content_source",
        ("cap:content_source:filesystem",),
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
