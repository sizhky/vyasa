"""Content read backends: a uniform read surface over a content root.

A backend answers per-folder listing, blob reads, kind probes, and ref
metadata so that higher layers (ContentTree, page readers) never touch raw
filesystem or git internals. Two implementations exist: FilesystemBackend
(plain folders and working-tree disk mode) and GitBackend (bare mirrors /
non-current refs, read from the object store). See
docs/grill-sessions or the git-backed-docs design for the rationale.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Protocol, runtime_checkable

EntryKind = Literal["file", "dir"]


@dataclass(frozen=True)
class TreeItem:
    """One child of a folder, named relative to that folder."""

    name: str
    kind: EntryKind


@dataclass(frozen=True)
class RefInfo:
    """A selectable ref for the picker."""

    name: str
    kind: Literal["branch", "tag"]
    is_default: bool = False


@runtime_checkable
class ContentBackend(Protocol):
    """Read surface for one content root. `ref` is "" for the default ref;
    filesystem-disk backends ignore it entirely."""

    root_id: str

    def default_ref(self) -> str: ...
    def resolve_ref(self, ref: str) -> str | None: ...
    def list_refs(self) -> list[RefInfo]: ...
    def list_dir(self, rel: str, ref: str = "") -> list[TreeItem]: ...
    def read_bytes(self, rel: str, ref: str = "") -> bytes | None: ...
    def stat_kind(self, rel: str, ref: str = "") -> EntryKind | None: ...
    def mtime(self, rel: str = "", ref: str = "") -> float: ...


class FilesystemBackend:
    """Reads a content root directly from disk. Refs are meaningless here:
    every call serves the live tree. Used for plain folders and for a
    working clone's currently checked-out branch (disk mode)."""

    def __init__(self, root: Path, root_id: str = ""):
        self.root = Path(root).resolve()
        self.root_id = root_id

    def default_ref(self) -> str:
        return ""

    def resolve_ref(self, ref: str) -> str | None:
        return "" if not ref else None

    def list_refs(self) -> list[RefInfo]:
        return []

    def _safe(self, rel: str) -> Path | None:
        target = (self.root / rel).resolve() if rel else self.root
        try:
            target.relative_to(self.root)
        except ValueError:
            return None
        return target

    def list_dir(self, rel: str, ref: str = "") -> list[TreeItem]:
        folder = self._safe(rel)
        if folder is None or not folder.is_dir():
            return []
        try:
            children = sorted(folder.iterdir(), key=lambda p: p.name)
        except OSError:
            return []
        return [TreeItem(c.name, "dir" if c.is_dir() else "file") for c in children]

    def read_bytes(self, rel: str, ref: str = "") -> bytes | None:
        target = self._safe(rel)
        if target is None or not target.is_file():
            return None
        try:
            return target.read_bytes()
        except OSError:
            return None

    def stat_kind(self, rel: str, ref: str = "") -> EntryKind | None:
        target = self._safe(rel)
        if target is None or not target.exists():
            return None
        return "dir" if target.is_dir() else "file"

    def mtime(self, rel: str = "", ref: str = "") -> float:
        target = self._safe(rel)
        try:
            return target.stat().st_mtime if target else 0.0
        except OSError:
            return 0.0


_GIT_DIR_MODE = 0o040000


class GitBackend:
    """Reads a content root from a git object store (a bare mirror or any
    repo dir), decoupled from whatever the working tree has checked out.
    `ref` may be a branch, tag, or commit sha; "" resolves the repo's HEAD."""

    def __init__(self, git_dir: Path, root_id: str = ""):
        from dulwich.repo import Repo

        self._repo = Repo(str(git_dir))
        self.root_id = root_id

    def default_ref(self) -> str:
        try:
            target = self._repo.refs.follow(b"HEAD")[0][-1]
            return target.decode().removeprefix("refs/heads/")
        except (KeyError, IndexError):
            return ""

    def resolve_ref(self, ref: str) -> str | None:
        name = ref or "HEAD"
        refs = self._repo.refs
        for candidate in (name, f"refs/heads/{name}", f"refs/tags/{name}"):
            try:
                sha = refs[candidate.encode()]
            except KeyError:
                continue
            return self._peel(sha).decode()
        raw = name.encode()
        if len(raw) == 40 and raw in self._repo.object_store:
            return self._peel(raw).decode()
        return None

    def _peel(self, sha: bytes) -> bytes:
        """Follow annotated tags down to the commit they point at."""
        obj = self._repo.get_object(sha)
        while obj.type_name == b"tag":
            obj = self._repo.get_object(obj.object[1])
        return obj.id

    def list_refs(self) -> list[RefInfo]:
        default = self.default_ref()
        out: list[RefInfo] = []
        for raw, kind, prefix in (
            (b"refs/heads/", "branch", "refs/heads/"),
            (b"refs/tags/", "tag", "refs/tags/"),
        ):
            for full in self._repo.refs.keys(base=raw):
                name = full.decode()
                out.append(RefInfo(name, kind, kind == "branch" and name == default))
        return out

    def _tree_at(self, ref: str):
        sha = self.resolve_ref(ref)
        if sha is None:
            return None
        return self._repo.get_object(self._repo.get_object(sha.encode()).tree)

    def _lookup(self, rel: str, ref: str):
        """Return (mode, sha) for rel under ref, or None."""
        from dulwich.object_store import tree_lookup_path

        tree = self._tree_at(ref)
        if tree is None:
            return None
        if not rel:
            return (_GIT_DIR_MODE, tree.id)
        try:
            return tree_lookup_path(self._repo.get_object, tree.id, rel.encode())
        except KeyError:
            return None

    def list_dir(self, rel: str, ref: str = "") -> list[TreeItem]:
        found = self._lookup(rel, ref)
        if found is None or found[0] != _GIT_DIR_MODE:
            return []
        tree = self._repo.get_object(found[1])
        items = [
            TreeItem(name.decode(), "dir" if mode == _GIT_DIR_MODE else "file")
            for name, mode, _ in tree.items()
        ]
        return sorted(items, key=lambda t: t.name)

    def read_bytes(self, rel: str, ref: str = "") -> bytes | None:
        found = self._lookup(rel, ref)
        if found is None or found[0] == _GIT_DIR_MODE:
            return None
        return self._repo.get_object(found[1]).data

    def stat_kind(self, rel: str, ref: str = "") -> EntryKind | None:
        found = self._lookup(rel, ref)
        if found is None:
            return None
        return "dir" if found[0] == _GIT_DIR_MODE else "file"

    def mtime(self, rel: str = "", ref: str = "") -> float:
        sha = self.resolve_ref(ref)
        if sha is None:
            return 0.0
        try:
            return float(self._repo.get_object(sha.encode()).commit_time)
        except (KeyError, AttributeError):
            return 0.0


RootKind = Literal["plain", "bare", "clone"]


@dataclass(frozen=True)
class RootClass:
    """How a content root is stored, decided once per root.

    plain  -> not a git repo; serve disk.
    bare   -> object store only; serve git.
    clone  -> working tree + objects; serve disk for the checked-out branch,
              git for any other ref.
    """

    kind: RootKind
    path: Path
    git_dir: Path | None = None
    current_branch: str | None = None  # checked-out branch of a clone; None if detached


def classify_root(path: Path) -> RootClass:
    """Classify a content root using dulwich, never shelling out to git."""
    from dulwich.errors import NotGitRepository
    from dulwich.repo import Repo

    path = Path(path).resolve()
    try:
        repo = Repo(str(path))
    except NotGitRepository:
        return RootClass("plain", path)
    try:
        if repo.bare:
            return RootClass("bare", path, git_dir=path)
        branch = None
        try:
            head = repo.refs.follow(b"HEAD")[0][-1]
            if head.startswith(b"refs/heads/"):
                branch = head.decode().removeprefix("refs/heads/")
        except (KeyError, IndexError):
            branch = None  # detached HEAD
        return RootClass("clone", path, git_dir=Path(repo.controldir()), current_branch=branch)
    finally:
        repo.close()


def backend_for(rc: RootClass, ref: str = "", root_id: str = "") -> tuple[ContentBackend, bool]:
    """Pick the backend for a (root, ref) pair. Returns (backend, disk_mode);
    disk_mode is True only when a working tree is served and uncommitted
    edits can exist."""
    if rc.kind == "plain":
        return FilesystemBackend(rc.path, root_id), True
    if rc.kind == "bare":
        return GitBackend(rc.git_dir, root_id), False
    serves_working_tree = rc.current_branch is not None and ref in ("", rc.current_branch)
    if serves_working_tree:
        return FilesystemBackend(rc.path, root_id), True
    return GitBackend(rc.git_dir, root_id), False
