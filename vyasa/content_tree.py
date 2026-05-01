from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Literal, Protocol

from .helpers import (
    _effective_abbreviations,
    _effective_ignore_list,
    _effective_include_list,
    _should_include_folder,
    content_slug_for_path,
    content_url_for_slug,
    find_folder_note_file,
    get_content_mounts,
    get_post_title,
    get_vyasa_config,
    iter_visible_files,
    order_vyasa_entries,
    should_exclude_dir,
    slug_to_title,
)
from .tree_file_rendering import resolve_tree_title

ContentKind = Literal["folder", "markdown", "tree", "pdf", "excalidraw"]


class VisibilityPolicy(Protocol):
    def can_read(self, route: str, roles: list[str] | None = None) -> bool: ...


@dataclass(frozen=True)
class AllowAllVisibility:
    def can_read(self, route: str, roles: list[str] | None = None) -> bool:
        return True


@dataclass(frozen=True)
class CallableVisibility:
    is_allowed: Callable[[str, list[str], object], bool]
    rules: object = None

    def can_read(self, route: str, roles: list[str] | None = None) -> bool:
        return self.is_allowed(route, roles or [], self.rules)


@dataclass(frozen=True)
class ContentEntry:
    slug: str
    path: Path
    kind: ContentKind
    title: str
    route: str
    visible: bool = True
    has_folder_note: bool = False


@dataclass(frozen=True)
class ResolvedDocument:
    slug: str
    path: Path
    kind: ContentKind
    route: str
    folder_note: Path | None = None


class ContentTree:
    def __init__(
        self,
        *,
        root: Path,
        show_hidden: bool = False,
        excluded_dirs: set[str] | None = None,
        allowed_suffixes: tuple[str, ...] = (".md", ".tree", ".pdf", ".excalidraw"),
        visibility: VisibilityPolicy | None = None,
        mounts: list[tuple[str, Path]] | None = None,
        ignore_primary_root: bool = False,
    ):
        self.root = Path(root).resolve()
        self.show_hidden = show_hidden
        self.excluded_dirs = excluded_dirs or set()
        self.allowed_suffixes = allowed_suffixes
        self.visibility = visibility or AllowAllVisibility()
        self.mounts = mounts
        self.ignore_primary_root = ignore_primary_root

    @classmethod
    def from_runtime(
        cls,
        *,
        visibility: VisibilityPolicy | None = None,
        allowed_suffixes: tuple[str, ...] = (".md", ".tree", ".pdf", ".excalidraw"),
    ) -> "ContentTree":
        from .config import get_config

        cfg = get_config()
        return cls(
            root=cfg.get_root_folder(),
            show_hidden=cfg.get_show_hidden(),
            excluded_dirs=set(cfg.get_reload_excludes()),
            allowed_suffixes=allowed_suffixes,
            visibility=visibility,
            mounts=get_content_mounts(),
            ignore_primary_root=cfg.get_ignore_cwd_as_root(),
        )

    def list_entries(self, folder_slug: str | Path = "", depth: int = 1, roles: list[str] | None = None) -> list[ContentEntry]:
        folder = self._folder_for_slug(folder_slug)
        if folder is None:
            return []
        return [entry for entry in self._entries_for_folder(folder, roles=roles) if entry.visible]

    def list_entries_for_path(self, folder: Path, roles: list[str] | None = None) -> list[ContentEntry]:
        folder = Path(folder).resolve()
        if not folder.exists() or not folder.is_dir():
            return []
        return [entry for entry in self._entries_for_folder(folder, roles=roles) if entry.visible]

    def resolve_document(self, slug: str | Path) -> ResolvedDocument | None:
        clean_slug = str(slug).strip("/")
        folder_path = self._path_for_slug(clean_slug)
        if folder_path and folder_path.exists() and folder_path.is_dir():
            note = self.find_folder_note(clean_slug)
            if note:
                note_slug = self._slug_for_path(note)
                if note_slug:
                    return ResolvedDocument(note_slug, note, "markdown", content_url_for_slug(note_slug), folder_note=note)
            return ResolvedDocument(clean_slug, folder_path, "folder", content_url_for_slug(clean_slug))
        for suffix, kind in ((".md", "markdown"), (".tree", "tree"), (".pdf", "pdf"), (".excalidraw", "excalidraw")):
            path = self._path_for_slug(clean_slug, suffix)
            if path and path.exists():
                prefix = "/drawings" if suffix == ".excalidraw" else "/posts"
                return ResolvedDocument(clean_slug, path, kind, content_url_for_slug(clean_slug, prefix=prefix))
        return None

    def find_folder_note(self, folder_slug: str | Path = "") -> Path | None:
        folder = self._folder_for_slug(folder_slug)
        if not folder or not folder.is_dir():
            return None
        return find_folder_note_file(folder)

    def adjacent(self, slug: str | Path, roles: list[str] | None = None) -> tuple[ContentEntry | None, ContentEntry | None]:
        root, relative = self._root_and_relative_for_slug(slug)
        if root is None:
            return None, None
        current = (root / relative).with_suffix(".md")
        entries = [entry for entry in self._entries_for_folder(current.parent, roles=roles) if entry.kind == "markdown"]
        paths = [entry.path.resolve() for entry in entries]
        try:
            idx = paths.index(current.resolve())
        except ValueError:
            return None, None
        prev_entry = entries[idx - 1] if idx > 0 else None
        next_entry = entries[idx + 1] if idx < len(entries) - 1 else None
        return prev_entry, next_entry

    def fingerprint(self) -> float:
        mtimes: list[float] = []
        for _, root in self._mounts():
            for suffix in (*self.allowed_suffixes, ".vyasa"):
                mtimes.extend(p.stat().st_mtime for p in iter_visible_files(root, (suffix,), True))
        return max(mtimes, default=0)

    def _folder_for_slug(self, slug: str | Path) -> Path | None:
        clean_slug = str(slug).strip("/")
        if not clean_slug:
            return self.root
        root, relative = self._root_and_relative_for_slug(clean_slug)
        if root is None:
            return None
        folder = (root / relative).resolve()
        return folder if folder.exists() and folder.is_dir() else None

    def _entries_for_folder(self, folder: Path, roles: list[str] | None = None) -> list[ContentEntry]:
        try:
            paths = self._ordered_paths(folder)
        except (OSError, PermissionError):
            return []
        return [self._entry_for_path(path, roles=roles) for path in paths]

    def _ordered_paths(self, folder: Path) -> list[Path]:
        ignore_primary = folder.resolve() == self.root and self.ignore_primary_root
        entries: list[Path] = []
        index_file = self._root_index_file(folder) if folder.resolve() == self.root and not ignore_primary else None
        folder_note = find_folder_note_file(folder)
        ignore_list = _effective_ignore_list(self.root, folder)
        include_list = _effective_include_list(self.root, folder)
        for item in [] if ignore_primary else folder.iterdir():
            if item.name == ".vyasa":
                continue
            if folder.resolve() == self.root and item.is_dir() and item.name == self.root.name:
                continue
            if item.is_dir():
                if should_exclude_dir(item.name, self.excluded_dirs) or (not self.show_hidden and item.name.startswith(".")):
                    continue
                if _should_include_folder(item.name, include_list, ignore_list):
                    entries.append(item)
            elif item.suffix in self.allowed_suffixes:
                if (folder_note and item.resolve() == folder_note.resolve()) or (index_file and item.resolve() == index_file.resolve()):
                    continue
                entries.append(item)
        if folder.resolve() == self.root:
            self._append_mount_entries(entries)
        return order_vyasa_entries(entries, get_vyasa_config(folder))

    def _entry_for_path(self, path: Path, roles: list[str] | None = None) -> ContentEntry:
        if path.is_dir():
            slug = self._slug_for_path(path, strip_suffix=False) or path.name
            title = slug_to_title(path.name, abbreviations=_effective_abbreviations(self.root, path.parent))
            route = content_url_for_slug(slug)
            has_note = bool(find_folder_note_file(path))
            return ContentEntry(slug, path, "folder", title, route, True, has_note)
        slug = self._slug_for_path(path) or path.with_suffix("").name
        kind = {".md": "markdown", ".tree": "tree", ".pdf": "pdf", ".excalidraw": "excalidraw"}[path.suffix]
        route = content_url_for_slug(slug, prefix="/drawings" if kind == "excalidraw" else "/posts")
        visible = self.visibility.can_read(route, roles)
        return ContentEntry(slug, path, kind, self._title_for_file(path, kind), route, visible, False)

    def _title_for_file(self, path: Path, kind: ContentKind) -> str:
        abbreviations = _effective_abbreviations(self.root, path.parent)
        if kind == "markdown":
            return get_post_title(path, abbreviations=abbreviations)
        if kind == "tree":
            return f"{resolve_tree_title(path, abbreviations=abbreviations)[0]} (Tree)"
        if kind == "pdf":
            return f"{slug_to_title(path.stem, abbreviations=abbreviations)} (PDF)"
        if kind == "excalidraw":
            return f"{slug_to_title(path.stem, abbreviations=abbreviations)} (Excalidraw)"
        return slug_to_title(path.name, abbreviations=abbreviations)

    def _append_mount_entries(self, entries: list[Path]) -> None:
        reserved = {item.name for item in entries} | {item.stem for item in entries if item.is_file()}
        resolved_entries = {item.resolve() for item in entries if item.exists()}
        for alias, mounted_root in self._mounts():
            if alias and alias not in reserved and mounted_root.resolve() not in resolved_entries:
                entries.append(mounted_root)

    def _mounts(self) -> list[tuple[str, Path]]:
        if self.mounts is not None:
            return self.mounts
        return [("", self.root)]

    def _root_and_relative_for_slug(self, slug: str | Path) -> tuple[Path | None, Path]:
        parts = Path(str(slug).strip("/")).parts
        for alias, root in self._mounts():
            if alias and parts and parts[0] == alias:
                return root, Path(*parts[1:]) if len(parts) > 1 else Path()
        for alias, root in self._mounts():
            if not alias:
                return root, Path(*parts) if parts else Path()
        return None, Path(*parts) if parts else Path()

    def _path_for_slug(self, slug: str | Path, suffix: str = "") -> Path | None:
        root, relative = self._root_and_relative_for_slug(slug)
        if root is None:
            return None
        target = (root / f"{relative.as_posix()}{suffix}").resolve()
        try:
            target.relative_to(root.resolve())
        except ValueError:
            return None
        return target

    def _slug_for_path(self, path: Path, strip_suffix: bool = True) -> str | None:
        resolved = path.resolve()
        for alias, root in self._mounts():
            try:
                rel = resolved.relative_to(root.resolve())
            except ValueError:
                continue
            if strip_suffix:
                rel = rel.with_suffix("")
            return (Path(alias) / rel).as_posix() if alias else rel.as_posix()
        return content_slug_for_path(path, strip_suffix=strip_suffix)

    @staticmethod
    def _root_index_file(folder: Path) -> Path | None:
        for stem in ("index", "readme"):
            for candidate in folder.iterdir():
                if candidate.is_file() and candidate.suffix == ".md" and candidate.stem.lower() == stem:
                    return candidate
        return None
