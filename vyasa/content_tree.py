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
    document_kind_for_suffix,
    document_kind_for_path,
    document_title_for_path,
    enabled_document_suffixes,
    find_folder_note_file,
    get_content_mounts,
    get_ref_content_mounts,
    get_post_title,
    get_vyasa_config,
    iter_visible_files,
    order_vyasa_entries,
    should_exclude_dir,
    slug_to_title,
)
ContentKind = Literal["folder", "markdown", "html", "pdf", "tree", "kg"]


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
        allowed_suffixes: tuple[str, ...] | None = None,
        visibility: VisibilityPolicy | None = None,
        mounts: list[tuple[str, Path]] | None = None,
        ignore_primary_root: bool = False,
    ):
        self.root = Path(root).resolve()
        self.show_hidden = show_hidden
        self.excluded_dirs = excluded_dirs or set()
        self.allowed_suffixes = allowed_suffixes or enabled_document_suffixes()
        self.visibility = visibility or AllowAllVisibility()
        self.mounts = mounts
        self.ignore_primary_root = ignore_primary_root

    @classmethod
    def from_runtime(
        cls,
        *,
        visibility: VisibilityPolicy | None = None,
        allowed_suffixes: tuple[str, ...] | None = None,
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
        for suffix in self.allowed_suffixes:
            path = (
                self._path_for_slug(clean_slug)
                if Path(clean_slug).suffix.lower() == suffix
                else self._path_for_slug(clean_slug, suffix)
            )
            if path and path.exists() and self._is_document_path(path):
                kind = document_kind_for_path(path)
                if not kind:
                    continue
                doc_slug = self._slug_for_path(path)
                return ResolvedDocument(doc_slug or clean_slug, path, kind, content_url_for_slug(doc_slug or clean_slug, prefix="/posts"))
        folder_path = self._path_for_slug(clean_slug)
        if folder_path and folder_path.exists() and folder_path.is_dir():
            note = self.find_folder_note(clean_slug)
            if note:
                note_slug = self._slug_for_path(note)
                if note_slug:
                    return ResolvedDocument(note_slug, note, document_kind_for_path(note) or "markdown", content_url_for_slug(note_slug), folder_note=note)
            return ResolvedDocument(clean_slug, folder_path, "folder", content_url_for_slug(clean_slug))
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
            if item.is_dir() and (should_exclude_dir(item.name, self.excluded_dirs) or (not self.show_hidden and item.name.startswith("."))):
                continue
            if self._is_document_path(item):
                entries.append(item)
            elif item.is_dir():
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
        if path.is_dir() and not self._is_document_path(path):
            slug = self._slug_for_path(path, strip_suffix=False) or path.name
            title = slug_to_title(path.name, abbreviations=_effective_abbreviations(self.root, path.parent))
            route = content_url_for_slug(slug)
            has_note = bool(find_folder_note_file(path))
            return ContentEntry(slug, path, "folder", title, route, True, has_note)
        slug = self._slug_for_path(path) or path.with_suffix("").name
        kind = document_kind_for_path(path)
        if not kind:
            raise ValueError(f"unsupported document suffix: {path.suffix}")
        route = content_url_for_slug(slug, prefix="/posts")
        visible = self.visibility.can_read(route, roles)
        return ContentEntry(slug, path, kind, self._title_for_file(path, kind), route, visible, False)

    def _is_document_path(self, path: Path) -> bool:
        if path.suffix.lower() not in self.allowed_suffixes:
            return False
        if path.is_dir():
            return path.suffix == ".kg" and (path / "kg.schema").is_file()
        return path.is_file()

    def _title_for_file(self, path: Path, kind: ContentKind) -> str:
        return document_title_for_path(path, abbreviations=_effective_abbreviations(self.root, path.parent))

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
                if not (resolved.is_dir() and rel.suffix.lower() == ".kg"):
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


@dataclass(frozen=True)
class RefDocument:
    """A markdown document read from a git ref (object store, not disk).

    `found` is False when the path is absent on the ref, which drives the
    soft "not present on <ref>" view instead of a hard 404."""

    root_id: str
    ref: str
    slug: str
    relative: str
    found: bool
    metadata: dict
    body: str
    title: str
    sha: str | None = None
    kind: ContentKind = "markdown"
    vpath: object | None = None  # VirtualPath to the resolved blob (any kind)


def _git_folder_note(backend, rel: str, ref: str) -> str | None:
    """Folder-note rule mirrored from find_folder_note_file, over a git tree:
    index.md, then readme.md, then <foldername>.md."""
    if backend.stat_kind(rel, ref) != "dir":
        return None
    names = {item.name.lower(): item.name for item in backend.list_dir(rel, ref) if item.kind == "file"}
    folder_name = (rel.rsplit("/", 1)[-1] if rel else "").lower()
    for stem in ("index.md", "readme.md", f"{folder_name}.md"):
        if stem in names:
            child = names[stem]
            return f"{rel}/{child}" if rel else child
    return None


def resolve_ref_blob(slug: str, suffix: str = "", *, ref_override: str = "") -> bytes | None:
    """Raw bytes for a slug (+optional suffix) when it is served from a git
    ref's object store; None when disk-served, so callers fall back to a
    FileResponse. Powers ref-aware serving of pdf/html/images/assets."""
    from .content_backend import backend_for, classify_root
    from .helpers import content_location

    root_id, root_path, ref, relative = content_location(slug, ref_override=ref_override)
    if root_path is None:
        return None
    backend, disk_mode = backend_for(classify_root(root_path), ref, root_id)
    if disk_mode:
        return None
    rel = f"{relative.as_posix()}{suffix}" if relative.as_posix() != "." else suffix.lstrip("/")
    return backend.read_bytes(rel, ref)


def ref_root_vpath(root_id: str, ref: str):
    """A VirtualPath at the root of `root_id` for `ref`, or None when the
    root is disk-served (caller should use the normal disk tree)."""
    from .content_backend import VirtualPath, backend_for, classify_root
    from .helpers import get_ref_content_mounts

    root_path = next((root for alias, root in get_ref_content_mounts() if alias == root_id), None)
    if root_path is None:
        return None
    backend, disk_mode = backend_for(classify_root(root_path), ref, root_id)
    if disk_mode:
        return None
    return VirtualPath(backend, ref, root_id, "", "dir", display_name=root_id)


def ref_nav_entries(folder, root, show_hidden, excluded_dirs):
    """nav-entry source over a git ref: immediate children of `folder` as
    VirtualPaths, drop-in for the disk get_nav_entries. Ordering and .vyasa
    tuning do not apply at a ref; entries come back name-sorted."""
    from .helpers import should_exclude_dir

    entries = []
    for child in folder.iterdir():
        if child.is_dir() and not _is_kg_pack(child):
            if should_exclude_dir(child.name, excluded_dirs) or (not show_hidden and child.name.startswith(".")):
                continue
            entries.append(child)
        elif child.suffix.lower() in enabled_document_suffixes():
            entries.append(child)
    return entries


def _is_kg_pack(vpath) -> bool:
    return vpath.suffix.lower() == ".kg" and (vpath / "kg.schema").exists()


def _resolve_ref_blob_rel(backend, rel: str, ref: str) -> tuple[str, ContentKind] | None:
    """Find the blob for `rel` on `ref` and its kind, trying each enabled
    suffix and the folder-note rule. None when nothing matches."""
    from .helpers import document_kind_for_suffix

    if "." in rel.rsplit("/", 1)[-1]:
        suffix = rel[rel.rindex("."):].lower()
        kind = document_kind_for_suffix(suffix)
        if kind and backend.stat_kind(rel, ref) == "file":
            return rel, kind
    for suffix in enabled_document_suffixes():
        candidate = f"{rel}{suffix}"
        if backend.stat_kind(candidate, ref) == "file":
            return candidate, document_kind_for_suffix(suffix) or "markdown"
    note = _git_folder_note(backend, rel, ref)
    if note:
        return note, "markdown"
    return None


def resolve_ref_document(slug: str, *, ref_override: str = "") -> RefDocument | None:
    """Resolve a slug to a document of any kind read from a git ref.

    Returns None when the slug maps to no root or to a disk-served backend
    (plain folder, or a working clone on its current branch) — the caller
    then uses the normal disk pipeline. Returns a RefDocument (possibly with
    found=False) only when content is served from the git object store. For
    markdown, body/title/metadata are populated; other kinds carry a vpath
    the caller hands to the kind's document renderer."""
    from .content_backend import VirtualPath, backend_for, classify_root
    from .helpers import (
        content_location,
        parse_frontmatter_text,
        resolve_markdown_title_text,
        slug_to_title,
    )

    root_id, root_path, ref, relative = content_location(slug, ref_override=ref_override)
    if root_path is None:
        return None
    backend, disk_mode = backend_for(classify_root(root_path), ref, root_id)
    if disk_mode:
        return None  # working tree / plain folder -> normal disk pipeline

    rel = relative.as_posix() if relative.as_posix() != "." else ""
    sha = backend.resolve_ref(ref)
    if sha is None:
        # The ref does not resolve to a real commit, so this is not a git-ref
        # request (e.g. a ?ref= query param another feature uses for its own
        # purpose). Fall back to the disk pipeline rather than a soft 404.
        return None
    found = _resolve_ref_blob_rel(backend, rel, ref)
    if found is None:
        stem = (rel.rsplit("/", 1)[-1] or root_id)
        return RefDocument(root_id, ref, slug, f"{rel}.md", False, {}, "", slug_to_title(stem), sha)
    blob_rel, kind = found
    vpath = VirtualPath(backend, ref, root_id, blob_rel, "file")
    stem = blob_rel.rsplit("/", 1)[-1]
    if "." in stem:
        stem = stem[: stem.rindex(".")]
    if kind != "markdown":
        return RefDocument(root_id, ref, slug, blob_rel, True, {}, "", slug_to_title(stem), sha, kind, vpath)
    data = backend.read_bytes(blob_rel, ref)
    metadata, raw = parse_frontmatter_text((data or b"").decode("utf-8", "replace"), source=slug)
    title, body = resolve_markdown_title_text(metadata, raw, stem)
    return RefDocument(root_id, ref, slug, blob_rel, True, metadata, body, title, sha, "markdown", vpath)


# Backwards-compatible alias: markdown was the first kind supported.
resolve_ref_markdown = resolve_ref_document
