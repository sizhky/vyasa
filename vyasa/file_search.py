from dataclasses import dataclass
from pathlib import Path

from .helpers import _effective_ignore_list, _effective_include_list, _should_include_folder, iter_visible_files
from .search_service import normalize_search_text, parse_search_query


@dataclass(frozen=True)
class FileSearchRecord:
    path: Path
    slug: str
    display: str
    basename: str
    normalized_path: str
    normalized_basename: str


_CACHE = {}


def _slug_for_path(path: Path, root: Path, alias: str, strip_suffix=True):
    try:
        rel = path.resolve().relative_to(root.resolve())
    except ValueError:
        return None
    if strip_suffix:
        rel = rel.with_suffix("")
    return (Path(alias) / rel).as_posix() if alias else rel.as_posix()


def _normalize_file_search_text(text: str):
    return normalize_search_text((text or "").replace("/", " "))


def _root_stamp(root: Path) -> tuple[str, float]:
    try:
        return str(root.resolve()), root.stat().st_mtime
    except OSError:
        return str(root), 0


def _cache_key(roots, suffixes, show_hidden):
    return (
        tuple((alias, *_root_stamp(root)) for alias, root in roots),
        tuple(suffixes),
        bool(show_hidden),
    )


def get_file_search_index(roots, suffixes, show_hidden=False):
    key = _cache_key(roots, suffixes, show_hidden)
    cached = _CACHE.get(key)
    if cached is not None:
        return cached
    records = []
    for alias, root in roots:
        ignore_list = _effective_ignore_list(root)
        include_list = _effective_include_list(root)
        for item in iter_visible_files(root, suffixes, show_hidden):
            rel_parts = item.relative_to(root).parts
            if ".vyasa" in rel_parts:
                continue
            if any(not _should_include_folder(part, include_list, ignore_list) for part in rel_parts[:-1]):
                continue
            slug = _slug_for_path(item, root, alias)
            if not slug:
                continue
            display = _slug_for_path(item, root, alias, strip_suffix=False) if item.suffix == ".pdf" else slug
            records.append(FileSearchRecord(item, slug, display, item.name, _normalize_file_search_text(display), _normalize_file_search_text(item.name)))
    _CACHE[key] = tuple(records)
    return _CACHE[key]


def _fuzzy_score(needle: str, haystack: str):
    if not needle:
        return None
    if needle == haystack:
        return 0
    if haystack.startswith(needle):
        return 10 + len(haystack)
    pos, gaps = -1, 0
    for char in needle:
        found = haystack.find(char, pos + 1)
        if found < 0:
            return None
        gaps += found - pos - 1
        pos = found
    return 100 + gaps + len(haystack)


def search_file_records(query, roots, suffixes, show_hidden=False, limit=40):
    trimmed = (query or "").strip()
    if not trimmed:
        return (), ""
    regex, regex_error = parse_search_query(trimmed)
    records = get_file_search_index(roots, suffixes, show_hidden)
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
