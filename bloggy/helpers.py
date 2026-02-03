from __future__ import annotations

import re
import tomllib
from functools import lru_cache
from pathlib import Path
import frontmatter
from loguru import logger

def slug_to_title(s: str, abbreviations=None) -> str:
    abbreviations = abbreviations or []
    abbrev_set = {str(word).strip().lower() for word in abbreviations if str(word).strip()}
    words = s.replace('-', ' ').replace('_', ' ').split()
    titled = []
    for word in words:
        lowered = word.lower()
        if lowered in abbrev_set:
            titled.append(word.upper())
        elif word.isupper():
            titled.append(word)
        else:
            titled.append(word[0].upper() + word[1:])
    return ' '.join(titled)

def _strip_inline_markdown(text: str) -> str:
    cleaned = text or ""
    cleaned = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', cleaned)
    cleaned = re.sub(r'\[([^\]]+)\]\[[^\]]*\]', r'\1', cleaned)
    cleaned = re.sub(r'`([^`]+)`', r'\1', cleaned)
    cleaned = re.sub(r'\*\*([^*]+)\*\*', r'\1', cleaned)
    cleaned = re.sub(r'__([^_]+)__', r'\1', cleaned)
    cleaned = re.sub(r'\*([^*]+)\*', r'\1', cleaned)
    cleaned = re.sub(r'_([^_]+)_', r'\1', cleaned)
    cleaned = re.sub(r'~~([^~]+)~~', r'\1', cleaned)
    return cleaned

def _plain_text_from_html(text: str) -> str:
    import html
    cleaned = re.sub(r'<[^>]+>', '', text or "")
    return html.unescape(cleaned)

def text_to_anchor(text: str) -> str:
    """Convert text to anchor slug"""
    cleaned = _strip_inline_markdown(text)
    cleaned = _plain_text_from_html(cleaned)
    return re.sub(r'[^\w\s-]', '', cleaned.lower()).replace(' ', '-')

def _unique_anchor(base: str, counts: dict[str, int]) -> str:
    if not base:
        base = "section"
    current = counts.get(base, 0) + 1
    counts[base] = current
    return base if current == 1 else f"{base}-{current}"

_frontmatter_cache: dict[str, tuple[float, tuple[dict, str]]] = {}

def parse_frontmatter(file_path: str | Path):
    """Parse frontmatter from a markdown file with caching"""
    import time
    start_time = time.time()

    file_path = Path(file_path)
    cache_key = str(file_path)
    mtime = file_path.stat().st_mtime

    if cache_key in _frontmatter_cache:
        cached_mtime, cached_data = _frontmatter_cache[cache_key]
        if cached_mtime == mtime:
            elapsed = (time.time() - start_time) * 1000
            logger.debug(f"[DEBUG] parse_frontmatter CACHE HIT for {file_path.name} ({elapsed:.2f}ms)")
            return cached_data

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            post = frontmatter.load(f)
            result = (post.metadata, post.content)
            _frontmatter_cache[cache_key] = (mtime, result)
            elapsed = (time.time() - start_time) * 1000
            logger.debug(f"[DEBUG] parse_frontmatter READ FILE {file_path.name} ({elapsed:.2f}ms)")
            return result
    except Exception as e:
        print(f"Error parsing frontmatter from {file_path}: {e}")
        return {}, open(file_path).read()

def get_post_title(file_path: str | Path, abbreviations=None) -> str:
    """Get post title from frontmatter or filename"""
    metadata, _ = parse_frontmatter(file_path)
    file_path = Path(file_path)
    return metadata.get('title', slug_to_title(file_path.stem, abbreviations=abbreviations))

@lru_cache(maxsize=128)
def _cached_bloggy_config(path_str: str, mtime: float):
    path = Path(path_str)
    try:
        with path.open("rb") as f:
            return tomllib.load(f)
    except Exception:
        return {}

def _normalize_bloggy_config(parsed):
    config = {
        "order": [],
        "sort": "name_asc",
        "folders_first": True,
        "folders_always_first": False,
        "layout_max_width": None,
        "abbreviations": None,
    }
    if not isinstance(parsed, dict):
        return config

    order = parsed.get("order")
    if order is not None:
        if isinstance(order, (list, tuple)):
            config["order"] = [str(item).strip() for item in order if str(item).strip()]
        else:
            config["order"] = []

    sort = parsed.get("sort")
    if isinstance(sort, str) and sort in ("name_asc", "name_desc", "mtime_asc", "mtime_desc"):
        config["sort"] = sort

    folders_first = parsed.get("folders_first")
    if isinstance(folders_first, bool):
        config["folders_first"] = folders_first
    elif isinstance(folders_first, str):
        lowered = folders_first.lower()
        if lowered in ("true", "false"):
            config["folders_first"] = lowered == "true"

    folders_always_first = parsed.get("folders_always_first")
    if isinstance(folders_always_first, bool):
        config["folders_always_first"] = folders_always_first
    elif isinstance(folders_always_first, str):
        lowered = folders_always_first.lower()
        if lowered in ("true", "false"):
            config["folders_always_first"] = lowered == "true"

    for key in ("layout_max_width",):
        value = parsed.get(key)
        if isinstance(value, (int, float)):
            value = str(value)
        if isinstance(value, str):
            value = value.strip()
            config[key] = value if value else None

    abbreviations = parsed.get("abbreviations")
    if isinstance(abbreviations, (list, tuple, set)):
        config["abbreviations"] = [str(item).strip() for item in abbreviations if str(item).strip()]
    elif isinstance(abbreviations, str):
        parts = [part.strip() for part in abbreviations.split(",")]
        config["abbreviations"] = [part for part in parts if part]

    return config

def _effective_abbreviations(root: Path, folder: Path | None = None):
    root_config = get_bloggy_config(root)
    root_abbrevs = root_config.get("abbreviations") or []
    if folder is None or folder == root:
        return root_abbrevs
    folder_config = get_bloggy_config(folder)
    folder_abbrevs = folder_config.get("abbreviations")
    return folder_abbrevs if folder_abbrevs is not None else root_abbrevs

def get_bloggy_config(folder: Path):
    bloggy_path = folder / ".bloggy"
    if not bloggy_path.exists():
        return _normalize_bloggy_config({})
    try:
        mtime = bloggy_path.stat().st_mtime
    except OSError:
        return _normalize_bloggy_config({})
    parsed = _cached_bloggy_config(str(bloggy_path), mtime)
    config = _normalize_bloggy_config(parsed)
    logger.debug(
        "[DEBUG] .bloggy config for %s: order=%s sort=%s folders_first=%s",
        folder,
        config.get("order"),
        config.get("sort"),
        config.get("folders_first"),
    )
    return config

def order_bloggy_entries(entries, config):
    if not entries:
        return []

    order_list = [name.strip().rstrip("/") for name in config.get("order", []) if str(name).strip()]
    if not order_list:
        sorted_entries = _sort_bloggy_entries(entries, config.get("sort"), config.get("folders_first", True))
        if config.get("folders_always_first"):
            sorted_entries = _group_folders_first(sorted_entries)
        logger.debug(
            "[DEBUG] .bloggy order empty; sorted entries: %s",
            [item.name for item in sorted_entries],
        )
        return sorted_entries

    exact_map = {}
    stem_map = {}
    for item in entries:
        exact_map.setdefault(item.name, item)
        if item.suffix == ".md":
            stem_map.setdefault(item.stem, item)

    ordered = []
    used = set()
    for name in order_list:
        if name in exact_map:
            item = exact_map[name]
        elif name in stem_map:
            item = stem_map[name]
        else:
            item = None
        if item and item not in used:
            ordered.append(item)
            used.add(item)

    remaining = [item for item in entries if item not in used]
    remaining_sorted = _sort_bloggy_entries(
        remaining,
        config.get("sort"),
        config.get("folders_first", True)
    )
    combined = ordered + remaining_sorted
    if config.get("folders_always_first"):
        combined = _group_folders_first(combined)
    logger.debug(
        "[DEBUG] .bloggy ordered=%s remaining=%s",
        [item.name for item in ordered],
        [item.name for item in remaining_sorted],
    )
    return combined

def _group_folders_first(entries):
    folders = [item for item in entries if item.is_dir()]
    files = [item for item in entries if not item.is_dir()]
    return folders + files

def _sort_bloggy_entries(entries, sort_method, folders_first):
    method = sort_method or "name_asc"
    reverse = method.endswith("desc")
    by_mtime = method.startswith("mtime")

    def sort_key(item):
        if by_mtime:
            try:
                return item.stat().st_mtime
            except OSError:
                return 0
        return item.name.lower()

    if folders_first:
        folders = [item for item in entries if item.is_dir()]
        files = [item for item in entries if not item.is_dir()]
        folders_sorted = sorted(folders, key=sort_key, reverse=reverse)
        files_sorted = sorted(files, key=sort_key, reverse=reverse)
        return folders_sorted + files_sorted

    return sorted(entries, key=sort_key, reverse=reverse)

def list_bloggy_posts(root: Path, include_hidden: bool = False) -> list[dict]:
    """List all posts in the blog root (md + pdf)."""
    root = root.resolve()
    root_parts = len(root.parts)
    posts: list[dict] = []
    abbreviations = _effective_abbreviations(root)

    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel_parts = path.parts[root_parts:]
        if not rel_parts:
            continue
        if not include_hidden and any(part.startswith(".") for part in rel_parts):
            continue
        if path.suffix.lower() not in {".md", ".pdf"}:
            continue

        rel = Path(*rel_parts)
        slug = rel.with_suffix("").as_posix()
        if path.suffix.lower() == ".md":
            title = get_post_title(path, abbreviations=abbreviations)
            kind = "md"
        else:
            title = slug_to_title(rel.stem, abbreviations=abbreviations)
            kind = "pdf"

        posts.append(
            {
                "path": slug,
                "title": title,
                "type": kind,
            }
        )

    return posts

def list_bloggy_entries(root: Path, relative: str = ".", include_hidden: bool = False) -> dict:
    """List immediate entries (folders + md/pdf files) under a relative path."""
    root = root.resolve()
    target = (root / relative).resolve()
    if target != root and root not in target.parents:
        return {"error": "Path escapes blog root"}
    if not target.exists() or not target.is_dir():
        return {"error": "Folder not found"}

    abbreviations = _effective_abbreviations(root, target)
    entries: list[dict] = []
    for item in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
        if not include_hidden and item.name.startswith("."):
            continue
        if item.is_dir():
            entries.append({"type": "folder", "path": item.relative_to(root).as_posix()})
            continue
        if item.suffix.lower() not in {".md", ".pdf"}:
            continue
        rel = item.relative_to(root)
        slug = rel.with_suffix("").as_posix()
        if item.suffix.lower() == ".md":
            title = get_post_title(item, abbreviations=abbreviations)
            kind = "md"
        else:
            title = slug_to_title(rel.stem, abbreviations=abbreviations)
            kind = "pdf"
        entries.append({"type": kind, "path": slug, "title": title})

    return {"path": target.relative_to(root).as_posix(), "entries": entries}

def find_folder_note_file(folder: Path) -> Path | None:
    """Return the preferred folder note file (index.md, readme.md, or foldername.md)."""
    try:
        folder_name = folder.name.lower()
        index_file = None
        readme_file = None
        named_file = None
        for item in folder.iterdir():
            if not item.is_file() or item.suffix.lower() != ".md":
                continue
            stem = item.stem.lower()
            if stem == "index":
                index_file = item
            elif stem == "readme":
                readme_file = item
            elif stem == folder_name:
                named_file = item
        return index_file or readme_file or named_file
    except OSError:
        return None
