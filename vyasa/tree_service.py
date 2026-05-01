from pathlib import Path

from .content_tree import ContentTree


def get_tree_entries(folder: Path, root: Path, show_hidden: bool, excluded_dirs: set[str], allowed_suffixes: tuple[str, ...]) -> list[Path]:
    from .config import get_config
    from .helpers import get_content_mounts

    cfg = get_config()
    root = root.resolve()
    folder = folder.resolve()
    runtime_root = cfg.get_root_folder().resolve()
    runtime_mounts = get_content_mounts() if root == runtime_root else [("", root)]
    tree = ContentTree(
        root=root,
        show_hidden=show_hidden,
        excluded_dirs=excluded_dirs,
        allowed_suffixes=allowed_suffixes,
        mounts=runtime_mounts,
        ignore_primary_root=folder == root and root == runtime_root and cfg.get_ignore_cwd_as_root(),
    )
    return [entry.path for entry in tree.list_entries_for_path(folder)]
