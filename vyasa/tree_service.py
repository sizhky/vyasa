from pathlib import Path

from .helpers import (
    _effective_ignore_list,
    _effective_include_list,
    _should_include_folder,
    find_folder_note_file,
    get_content_mounts,
    get_vyasa_config,
    order_vyasa_entries,
    should_exclude_dir,
)


def get_tree_entries(folder: Path, root: Path, show_hidden: bool, excluded_dirs: set[str], allowed_suffixes: tuple[str, ...]) -> list[Path]:
    from .config import get_config

    ignore_primary_root = folder == root and get_config().get_ignore_cwd_as_root()
    index_file = None
    if folder == root and not ignore_primary_root:
        for stem in ("index", "readme"):
            for candidate in root.iterdir():
                if candidate.is_file() and candidate.suffix == ".md" and candidate.stem.lower() == stem:
                    index_file = candidate
                    break
            if index_file:
                break
    folder_note = find_folder_note_file(folder)
    ignore_list = _effective_ignore_list(root, folder)
    include_list = _effective_include_list(root, folder)
    entries = []
    for item in [] if ignore_primary_root else folder.iterdir():
        if item.name == ".vyasa":
            continue
        if item.is_dir():
            if should_exclude_dir(item.name, excluded_dirs) or (not show_hidden and item.name.startswith(".")):
                continue
            if _should_include_folder(item.name, include_list, ignore_list):
                entries.append(item)
        elif item.suffix in allowed_suffixes:
            if (folder_note and item.resolve() == folder_note.resolve()) or (index_file and item.resolve() == index_file.resolve()):
                continue
            entries.append(item)
    if folder == root:
        reserved = {item.name for item in entries} | {item.stem for item in entries if item.is_file()}
        for alias, mounted_root in get_content_mounts():
            if alias not in reserved:
                entries.append(mounted_root)
    return order_vyasa_entries(entries, get_vyasa_config(folder))
