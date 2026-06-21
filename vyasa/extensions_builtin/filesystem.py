from pathlib import Path

from ..config import get_config
from ..extensions import ContentRootRequest, ExtensionMeta, VyasaExtensionBase


class FilesystemExtension(VyasaExtensionBase):
    def register(self, app):
        app.content_source.mount_provider(filesystem_mounts)
        app.content_source.root_resolver(resolve_content_root)


def filesystem_mounts():
    cfg = get_config()
    primary = cfg.get_root_folder().resolve()
    ignore_primary = cfg.get_ignore_cwd_as_root()
    mounts = [] if ignore_primary else [("", primary)]
    reserved = set()
    if primary.exists() and not ignore_primary:
        try:
            entries = tuple(primary.iterdir())
        except OSError:
            entries = ()
        reserved = {item.name for item in entries} | {item.stem for item in entries if item.is_file()}
    seen = set(reserved)
    for root in cfg.get_vyasa_roots():
        alias = root.name
        if alias and alias not in seen:
            seen.add(alias)
            mounts.append((alias, Path(root).resolve()))
    for alias, path in cfg.get_git_mounts():
        if alias and alias not in seen:
            seen.add(alias)
            mounts.append((alias, path))
    return mounts


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
