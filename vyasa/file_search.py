from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path

from .helpers import _effective_ignore_list, _effective_include_list, _should_include_folder, content_slug_for_path, document_kind_for_suffix, iter_visible_files, should_exclude_dir
from .search_service import normalize_search_text, parse_search_query


@dataclass(frozen=True)
class FileSearchRecord:
    path: Path
    slug: str
    display: str
    basename: str
    normalized_path: str
    normalized_basename: str


class _BoundedCache(OrderedDict):
    """LRU dict for built search indexes. OID-keyed entries are immortal (a
    commit's tree never changes), so without a bound, browsing many refs in
    prod would grow this without limit. Cap it and evict least-recently-used."""

    def __init__(self, maxsize=256):
        super().__init__()
        self._maxsize = maxsize

    def get(self, key, default=None):
        if key in self:
            self.move_to_end(key)
            return self[key]
        return default

    def set(self, key, value):
        self[key] = value
        self.move_to_end(key)
        while len(self) > self._maxsize:
            self.popitem(last=False)


_CACHE = _BoundedCache()


def _slug_for_path(path: Path, root: Path, alias: str, strip_suffix=True):
    slug = content_slug_for_path(path, strip_suffix=strip_suffix)
    if slug is not None and not isinstance(path, Path):
        return slug
    try:
        rel = path.resolve().relative_to(root.resolve())
    except ValueError:
        return None
    if strip_suffix:
        rel = rel.with_suffix("")
    return (Path(alias) / rel).as_posix() if alias else rel.as_posix()


def _normalize_file_search_text(text: str):
    return normalize_search_text((text or "").replace("/", " "))


def _root_stamp(root: Path) -> tuple[str, str | float]:
    """Identity of a root for cache keying. Git-ref roots stamp by the commit
    OID (content-addressed: same OID => byte-identical tree, no rescan); disk
    roots fall back to mtime since they have no immutable fingerprint."""
    if not isinstance(root, Path):
        try:
            return str(root.slug), (root.content_oid or root.stat().st_mtime)
        except Exception:
            return str(root), 0
    try:
        return str(root.resolve()), root.stat().st_mtime
    except OSError:
        return str(root), 0


def _cache_key(roots, suffixes, show_hidden, exclude_paths):
    return (
        tuple((alias, *_root_stamp(root)) for alias, root in roots),
        tuple(suffixes),
        bool(show_hidden),
        tuple(sorted(str(p) for p in exclude_paths)),
    )


def get_file_search_index(roots, suffixes, show_hidden=False, exclude_paths=()):
    key = _cache_key(roots, suffixes, show_hidden, exclude_paths)
    cached = _CACHE.get(key)
    if cached is not None:
        return cached
    records = []
    for alias, root in roots:
        virtual_root = not isinstance(root, Path)
        ignore_list = [] if virtual_root else _effective_ignore_list(root)
        include_list = [] if virtual_root else _effective_include_list(root)
        for item in _iter_search_files(root, suffixes, show_hidden, exclude_paths):
            rel_parts = tuple(str(getattr(item, "rel", "")).split("/")) if virtual_root else item.relative_to(root).parts
            if ".vyasa" in rel_parts:
                continue
            if any(not _should_include_folder(part, include_list, ignore_list) for part in rel_parts[:-1]):
                continue
            slug = _slug_for_path(item, root, alias)
            if not slug:
                continue
            display = (_slug_for_path(item, root, alias, strip_suffix=False) or slug) if document_kind_for_suffix(item.suffix) != "markdown" else slug
            records.append(FileSearchRecord(item, slug, display, item.name, _normalize_file_search_text(display), _normalize_file_search_text(item.name)))
    result = tuple(records)
    _CACHE.set(key, result)
    return result


def _iter_search_files(root, suffixes, show_hidden=False, exclude_paths=()):
    if isinstance(root, Path):
        yield from iter_visible_files(root, suffixes, show_hidden, exclude_paths)
        return
    stack = [root]
    while stack:
        folder = stack.pop()
        for item in folder.iterdir():
            if item.is_dir():
                if item.name == ".vyasa":
                    continue
                if should_exclude_dir(item.name, set()) or (not show_hidden and item.name.startswith(".")):
                    continue
                stack.append(item)
            elif item.suffix.lower() in suffixes:
                yield item


def _place_tokens(needle: str, haystack: str):
    """First index at which the whitespace tokens of `needle` all occur as
    in-order contiguous substrings of `haystack`, or None if any is absent.

    This is what makes "ws 011" match the literal `ws` and `011` runs in a
    name rather than scattering letters across `work`/`streams`/the date."""
    cursor, first = 0, None
    for token in needle.split():
        idx = haystack.find(token, cursor)
        if idx < 0:
            return None
        first = idx if first is None else first
        cursor = idx + len(token)
    return first


def _fuzzy_score(needle: str, haystack: str):
    """Lower is better. Tiers, best to worst: exact match, whole-string prefix,
    every query word present as a contiguous substring (in order), then a
    subsequence fallback whose penalty rewards matches on word boundaries
    (so 'ar' favours 'api routes' over 'shared')."""
    if not needle:
        return None
    if needle == haystack:
        return 0
    if haystack.startswith(needle):
        return 10 + len(haystack)
    first = _place_tokens(needle, haystack)
    if first is not None:
        return 20 + first + len(haystack)
    pos, gaps, boundary_hits = -1, 0, 0
    for char in needle:
        if char == " ":
            continue
        found = haystack.find(char, pos + 1)
        if found < 0:
            return None
        gaps += found - pos - 1
        if found == 0 or haystack[found - 1] == " ":
            boundary_hits += 1
        pos = found
    return 100 + gaps + len(haystack) - boundary_hits * 5


def search_file_records(query, roots, suffixes, show_hidden=False, limit=40, exclude_paths=()):
    trimmed = (query or "").strip()
    if not trimmed:
        return (), ""
    regex, regex_error = parse_search_query(trimmed)
    records = get_file_search_index(roots, suffixes, show_hidden, exclude_paths)
    if regex:
        return tuple(record.path for record in records if regex.search(record.display))[:limit], regex_error
    needle = _normalize_file_search_text(trimmed)
    scored = []
    for record in records:
        score = _fuzzy_score(needle, record.normalized_basename)
        if score is None:
            score = _fuzzy_score(needle, record.normalized_path)
            if score is not None:
                score += 50
        if score is not None:
            scored.append((score, record.display, record.path))
    scored.sort(key=lambda item: (item[0], item[1]))
    return tuple(item[2] for item in scored[:limit]), regex_error
