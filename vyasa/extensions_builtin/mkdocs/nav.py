"""MkDocs navigation model: the `nav:` tree, or the tree MkDocs derives from files.

Implements vyasa manual/mkdocs-compatibility.md#navigation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

MARKDOWN_SUFFIXES = (".md", ".markdown", ".mdown", ".mkdn", ".mkd")


@dataclass
class NavItem:
    """One nav entry. `kind` is page, section, or link; `path` is docs-relative for pages."""

    title: str | None
    kind: str
    path: str = ""
    url: str = ""
    children: list["NavItem"] = field(default_factory=list)
    missing: bool = False

    def pages(self) -> list["NavItem"]:
        """Leaf pages in nav order (depth-first)."""
        if self.kind == "page":
            return [self]
        return [page for child in self.children for page in child.pages()]

    def first_url_item(self) -> "NavItem | None":
        """First page or link found depth-first; a section tab links there."""
        if self.kind == "page":
            return None if self.missing else self
        if self.kind != "section" or self.path:
            return self
        for child in self.children:
            found = child.first_url_item()
            if found:
                return found
        return None


def dirname_to_title(name: str) -> str:
    """MkDocs section title for a directory.

    >>> dirname_to_title("api-ref")
    'Api ref'
    >>> dirname_to_title("APIRef")
    'APIRef'
    """
    title = name.replace("-", " ").replace("_", " ")
    return title.capitalize() if title.lower() == title else title


def _is_url(value: str) -> bool:
    parts = urlsplit(value)
    return bool(parts.scheme or parts.netloc)


def _leaf(title: str | None, value: str, docs_dir: Path) -> NavItem:
    value = str(value).strip()
    if _is_url(value):
        return NavItem(title or value, "link", url=value)
    lookup = value.lstrip("/")
    if value.startswith("/") and not (docs_dir / lookup).is_file():
        return NavItem(title or value, "link", url=value)
    return NavItem(title, "page", path=lookup, missing=not (docs_dir / lookup).is_file())


def parse_nav(raw, docs_dir: Path) -> list[NavItem]:
    """Translate the `nav:` YAML value into NavItems.

    >>> [(i.title, i.kind) for i in parse_nav(["a.md", {"Ext": "https://x.io"}, {"S": ["b.md"]}], Path("/tmp"))]
    [(None, 'page'), ('Ext', 'link'), ('S', 'section')]
    """
    items: list[NavItem] = []
    for entry in raw or []:
        if isinstance(entry, str):
            items.append(_leaf(None, entry, docs_dir))
            continue
        if not isinstance(entry, dict):
            continue
        for title, value in entry.items():
            title = None if title is None else str(title)
            if isinstance(value, list):
                items.append(NavItem(title, "section", children=parse_nav(value, docs_dir)))
            elif value is not None:
                items.append(_leaf(title, str(value), docs_dir))
    return items


def gitignore_matcher(patterns: str | list[str] | None):
    """Predicate for MkDocs `exclude_docs` / `not_in_nav` (gitignore syntax, docs-relative).

    Directories are passed with a trailing slash.

    >>> match = gitignore_matcher(["drafts/", "*.tmp.md", "/top.md", "!keep.tmp.md"])
    >>> [match(p) for p in ("drafts/", "a/b.tmp.md", "top.md", "a/top.md", "keep.tmp.md")]
    [True, True, True, False, False]
    """
    import fnmatch

    lines = patterns.splitlines() if isinstance(patterns, str) else list(patterns or [])
    rules = []
    for raw in lines:
        line = str(raw).strip()
        if not line or line.startswith("#"):
            continue
        negate = line.startswith("!")
        line = line[1:] if negate else line
        dir_only = line.endswith("/")
        line = line.rstrip("/")
        anchored = line.startswith("/") or "/" in line
        rules.append((negate, dir_only, anchored, line.lstrip("/")))

    def matches(rel: str) -> bool:
        is_dir = rel.endswith("/")
        path = rel.rstrip("/")
        result = False
        for negate, dir_only, anchored, pattern in rules:
            if dir_only and not is_dir:
                continue
            target = path if anchored else path.rsplit("/", 1)[-1]
            if fnmatch.fnmatchcase(target, pattern):
                result = not negate
        return result

    return matches


def _sort_key(path: Path) -> tuple:
    stem = path.stem.lower()
    return (stem not in {"index", "readme"}, path.name)


def derive_nav(docs_dir: Path, *, excluded=lambda rel: False, show_hidden: bool = False) -> list[NavItem]:
    """Nav MkDocs builds when `nav` is absent: index/README first, files, then subdirectories."""

    def walk(folder: Path) -> list[NavItem]:
        try:
            children = list(folder.iterdir())
        except OSError:
            return []
        visible = [c for c in children if show_hidden or not c.name.startswith(".")]
        files = sorted((c for c in visible if c.is_file() and c.suffix.lower() in MARKDOWN_SUFFIXES), key=_sort_key)
        stems = {f.stem.lower() for f in files}
        if "index" in stems:
            files = [f for f in files if f.stem.lower() != "readme"]
        items = [NavItem(None, "page", path=f.relative_to(docs_dir).as_posix()) for f in files if not excluded(f.relative_to(docs_dir).as_posix())]
        for sub in sorted((c for c in visible if c.is_dir()), key=lambda p: p.name):
            if excluded(sub.relative_to(docs_dir).as_posix() + "/"):
                continue
            nested = walk(sub)
            if nested:
                items.append(NavItem(dirname_to_title(sub.name), "section", children=nested))
        return items

    return walk(docs_dir)


def apply_indexes(items: list[NavItem]) -> list[NavItem]:
    """`navigation.indexes`: a section whose first child is index.md links to it.

    The section keeps its children minus the index page; `path` holds the index page.
    """
    for item in items:
        if item.kind != "section":
            continue
        apply_indexes(item.children)
        first = item.children[0] if item.children else None
        if first and first.kind == "page" and Path(first.path).stem.lower() in {"index", "readme"}:
            item.path = first.path
            item.children = item.children[1:]
    return items


def page_slug(path: str) -> str:
    """Vyasa slug for a docs-relative Markdown path.

    >>> page_slug("guide/setup.md")
    'guide/setup'
    """
    return re.sub(r"\.(md|markdown|mdown|mkdn|mkd)$", "", path, flags=re.IGNORECASE)


def flat_pages(items: list[NavItem]) -> list[NavItem]:
    """Every page (and section index page) in nav order; drives prev/next links."""
    pages: list[NavItem] = []
    for item in items:
        if item.kind == "page":
            pages.append(item)
        elif item.kind == "section":
            if item.path:
                pages.append(NavItem(item.title, "page", path=item.path))
            pages.extend(flat_pages(item.children))
    return pages


def contains_slug(item: NavItem, slug: str) -> bool:
    """True when `slug` is this item's page, its section index, or any descendant page."""
    if item.path and page_slug(item.path) == slug:
        return True
    return any(contains_slug(child, slug) for child in item.children)
