from __future__ import annotations

import os
import re
import tomllib
from datetime import datetime
from functools import lru_cache
from pathlib import Path
import frontmatter
from loguru import logger

_DEFAULT_ABBREVIATIONS = [
    "acl", "adb", "admin", "aes", "ai", "aop", "api", "apis", "arn", "aws",
    "b2b", "b2c", "bi", "bom", "bpm", "cdn", "ceo", "ci", "cidr", "ciso",
    "cli", "cmo", "cms", "coo", "cpu", "crm", "cron", "csp", "css", "csv",
    "cto", "cve", "dag", "db", "ddos", "dns", "dto", "e2e", "eda", "erp",
    "etl", "faq", "gcp", "git", "gpu", "grpc", "hld", "html", "http", "https",
    "iac", "iam", "ide", "ingress", "ios", "jwt", "json", "k8s", "kanban",
    "kafka", "kpi", "lambda", "ldap", "lld", "llm", "mcp", "mfa", "ml",
    "mvp", "nat", "nlp", "nosql", "oauth", "ocr", "okta", "okr", "olap",
    "oltp", "oncall", "openid", "otp", "pdf", "php", "pii", "pkce", "poc",
    "postgres", "prd", "promql", "qa", "rag", "ram", "rbac", "rest", "rfc",
    "roi", "rpc", "rsa", "rtfm", "saas", "sdk", "seo", "sftp", "sla", "sli",
    "slo", "smtp", "snyk", "soap", "soc", "sop", "sso", "ssl", "sql", "sre",
    "ssh", "tcp", "tds", "tls", "todo", "udp", "ui", "url", "usb", "ux",
    "vpc", "vpn", "waf", "webhook", "wiki", "xml", "yaml", "yml",
]


def _merge_abbreviations(*groups):
    merged = []
    seen = set()
    for group in groups:
        for item in group or []:
            word = str(item).strip()
            if not word:
                continue
            lowered = word.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            merged.append(word)
    return merged


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

def _safe_child(base: Path, relative: str | Path) -> Path | None:
    base = base.resolve()
    target = (base / relative).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        return None
    return target

def get_content_mounts() -> list[tuple[str, Path]]:
    """Return primary and configured content roots as URL slug mounts."""
    from .config import get_config

    cfg = get_config()
    primary = cfg.get_root_folder().resolve()
    ignore_primary = cfg.get_ignore_cwd_as_root()
    mounts = [] if ignore_primary else [("", primary)]
    reserved = set()
    if not ignore_primary:
        try:
            for item in primary.iterdir():
                reserved.add(item.name)
                if item.is_file():
                    reserved.add(item.stem)
        except OSError:
            pass
    aliases = set(reserved)
    for root in cfg.get_vyasa_roots():
        alias = root.name
        if not alias or alias in aliases:
            continue
        aliases.add(alias)
        mounts.append((alias, root.resolve()))
    return mounts

def content_root_and_relative(slug: str | Path) -> tuple[Path | None, Path]:
    parts = Path(str(slug).strip("/")).parts
    mounts = get_content_mounts()
    for alias, root in mounts:
        if parts and parts[0] == alias:
            return root, Path(*parts[1:]) if len(parts) > 1 else Path()
    if mounts and mounts[0][0] == "":
        return mounts[0][1], Path(*parts) if parts else Path()
    return None, Path(*parts) if parts else Path()

def content_path_for_slug(slug: str | Path, suffix: str = "") -> Path | None:
    root, relative = content_root_and_relative(slug)
    if root is None:
        return None
    return _safe_child(root, f"{relative.as_posix()}{suffix}")

def content_slug_for_path(path: Path, strip_suffix: bool = True) -> str | None:
    resolved = path.resolve()
    for alias, root in get_content_mounts():
        try:
            rel = resolved.relative_to(root.resolve())
        except ValueError:
            continue
        if strip_suffix:
            rel = rel.with_suffix("")
        return (Path(alias) / rel).as_posix() if alias else rel.as_posix()
    return None

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

def split_heading_text_and_id(text: str) -> tuple[str, str | None]:
    cleaned = (text or "").strip()
    match = re.match(r"^(.*?)\s*\{\s*#([A-Za-z][\w\-:.]*)\s*\}\s*$", cleaned)
    if not match:
        return cleaned, None
    return match.group(1).strip(), match.group(2).strip()

def resolve_heading_anchor(text: str, counts: dict[str, int]) -> tuple[str, str]:
    heading_text, explicit_id = split_heading_text_and_id(text)
    if explicit_id:
        return heading_text, explicit_id
    return heading_text, _unique_anchor(text_to_anchor(heading_text), counts)

def _unique_anchor(base: str, counts: dict[str, int]) -> str:
    if not base:
        base = "section"
    current = counts.get(base, 0) + 1
    counts[base] = current
    return base if current == 1 else f"{base}-{current}"

_frontmatter_cache: dict[str, tuple[float, tuple[dict, str]]] = {}

def _recover_simple_frontmatter(text: str) -> dict:
    match = re.match(r"^(---|\+\+\+)\s*\n(.*?)\n\1\s*\n?", text, re.DOTALL)
    if not match:
        return {}
    recovered = {}
    for line in match.group(2).splitlines():
        if not line or line[:1].isspace() or ":" not in line:
            continue
        key, value = line.split(":", 1)
        key, value = key.strip(), value.strip()
        if not key or not value or value[0] in "[{":
            continue
        recovered[key] = value.strip("'\"")
    return recovered

def _strip_leading_frontmatter_block(text: str) -> str:
    return re.sub(r"^(---|\+\+\+)\s*\n.*?\n\1\s*\n?", "", text, count=1, flags=re.DOTALL)

def should_exclude_dir(name: str, excluded: set[str]) -> bool:
    """Exclude exact matches plus common derived names like .venv.bak."""
    if name in excluded:
        return True
    prefixes = (".venv", "venv", "node_modules", ".git", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", "dist", "build", ".cache")
    return any(name == prefix or name.startswith(prefix + ".") for prefix in prefixes)

def parse_frontmatter(file_path: str | Path):
    """Parse frontmatter from a markdown file with caching"""
    import time
    start_time = time.time()

    file_path = Path(file_path)
    cache_key = str(file_path)
    try:
        mtime = file_path.stat().st_mtime
    except OSError:
        return {}, ""

    if cache_key in _frontmatter_cache:
        cached_mtime, cached_data = _frontmatter_cache[cache_key]
        if cached_mtime == mtime:
            elapsed = (time.time() - start_time) * 1000
            logger.debug(f"[DEBUG] parse_frontmatter CACHE HIT for {file_path.name} ({elapsed:.2f}ms)")
            return cached_data

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()
            if not text.startswith(('---\n', '---\r\n', '+++\n', '+++\r\n')):
                result = ({}, text)
                _frontmatter_cache[cache_key] = (mtime, result)
                elapsed = (time.time() - start_time) * 1000
                logger.debug(f"[DEBUG] parse_frontmatter SKIP NO FRONTMATTER {file_path.name} ({elapsed:.2f}ms)")
                return result
            post = frontmatter.loads(text)
            result = (post.metadata, post.content)
            _frontmatter_cache[cache_key] = (mtime, result)
            elapsed = (time.time() - start_time) * 1000
            logger.debug(f"[DEBUG] parse_frontmatter READ FILE {file_path.name} ({elapsed:.2f}ms)")
            return result
    except UnicodeDecodeError as e:
        logger.warning("Skipping non-UTF8 markdown file {}: {}", file_path, e)
        result = ({}, "")
        _frontmatter_cache[cache_key] = (mtime, result)
        return result
    except Exception as e:
        logger.warning("Error parsing frontmatter from {}: {}", file_path, e)
        try:
            text = file_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return {}, ""
        recovered = _recover_simple_frontmatter(text)
        recovered["__frontmatter_error__"] = {
            "message": str(e),
            "file": str(file_path),
        }
        result = (recovered, _strip_leading_frontmatter_block(text))
        _frontmatter_cache[cache_key] = (mtime, result)
        return result

def resolve_markdown_title(file_path: str | Path, abbreviations=None) -> tuple[str, str]:
    """Get effective title and body, preferring frontmatter title, then first H1, then slug."""
    metadata, raw_content = parse_frontmatter(file_path)
    file_path = Path(file_path)
    explicit_title = metadata.get("title")
    if explicit_title:
        return explicit_title, raw_content

    match = re.match(r"^\s*#\s+(.+?)\s*$\n?", raw_content or "", re.MULTILINE)
    if match:
        title = _plain_text_from_html(_strip_inline_markdown(match.group(1).strip()))
        body = (raw_content[:match.start()] + raw_content[match.end():]).lstrip("\n")
        return title, body

    return slug_to_title(file_path.stem, abbreviations=abbreviations), raw_content

_MORE_MARKER_RE = re.compile(r"^\s*<!--\s*more\s*-->\s*$", re.MULTILINE)


def strip_more_marker(text: str) -> str:
    return _MORE_MARKER_RE.sub("", text or "")

def preview_markdown(text: str, max_blocks: int = 5) -> str:
    text = text or ""
    marker = _MORE_MARKER_RE.search(text)
    if marker:
        return text[:marker.start()].rstrip()
    blocks = [block.strip() for block in re.split(r"\n\s*\n", text) if block.strip()]
    return "\n\n".join(blocks[:max_blocks])

def get_post_title(file_path: str | Path, abbreviations=None) -> str:
    """Get post title from frontmatter or filename"""
    title, _ = resolve_markdown_title(file_path, abbreviations=abbreviations)
    return title

def estimate_read_time_minutes(text: str, words_per_minute: int = 200) -> int:
    cleaned = re.sub(r"```.*?```", " ", text or "", flags=re.DOTALL)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    cleaned = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", cleaned)
    cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", cleaned)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    words = re.findall(r"\b[\w'-]+\b", cleaned)
    return max(1, (len(words) + words_per_minute - 1) // words_per_minute)


def format_last_modified_label(file_path: str | Path) -> str | None:
    try:
        modified_at = datetime.fromtimestamp(Path(file_path).stat().st_mtime)
    except OSError:
        return None
    return f"Updated {modified_at.strftime('%b %d, %Y')}"

def get_adjacent_posts(root: Path, current_path: str | Path, abbreviations=None):
    current_rel = Path(current_path)
    if current_rel.suffix != ".md":
        current_rel = current_rel.with_suffix(".md")
    current_file = root / current_rel
    if not current_file.exists():
        return None, None
    folder = current_file.parent
    index_file = None
    if folder == root:
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
    excluded = set()
    for item in folder.iterdir():
        if item.name == ".vyasa":
            continue
        if item.is_dir():
            if should_exclude_dir(item.name, excluded) or item.name.startswith("."):
                continue
            if _should_include_folder(item.name, include_list, ignore_list):
                entries.append(item)
        elif item.suffix == ".md":
            if item.name.startswith("."):
                continue
            if (folder_note and item.resolve() == folder_note.resolve()) or (index_file and item.resolve() == index_file.resolve()):
                continue
            entries.append(item)
    siblings = [item for item in order_vyasa_entries(entries, get_vyasa_config(folder)) if item.is_file() and item.suffix == ".md"]
    try:
        idx = siblings.index(current_file)
    except ValueError:
        return None, None

    def _item(path: Path):
        rel = path.relative_to(root).with_suffix("")
        return {
            "title": get_post_title(path, abbreviations=abbreviations),
            "href": f"/posts/{rel.as_posix()}",
            "static_href": f"/posts/{rel.as_posix()}.html",
        }

    prev_item = _item(siblings[idx - 1]) if idx > 0 else None
    next_item = _item(siblings[idx + 1]) if idx < len(siblings) - 1 else None
    return prev_item, next_item

def iter_visible_files(root: Path, suffixes: tuple[str, ...], include_hidden: bool = False):
    """Yield files while pruning hidden and excluded directories before descent."""
    from .config import get_config

    root = root.resolve()
    excluded = set(get_config().get_reload_excludes())
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [
            name for name in dirnames
            if (include_hidden or not name.startswith(".")) and not should_exclude_dir(name, excluded)
        ]
        for filename in filenames:
            if not include_hidden and filename.startswith("."):
                continue
            if not filename.endswith(suffixes):
                continue
            yield Path(dirpath) / filename

@lru_cache(maxsize=128)
def _cached_vyasa_config(path_str: str, mtime: float):
    path = Path(path_str)
    try:
        with path.open("rb") as f:
            return tomllib.load(f)
    except Exception:
        return {}

def _normalize_vyasa_config(parsed):
    config = {
        "order": [],
        "sort": "name_asc",
        "folders_first": True,
        "folders_always_first": False,
        "layout_max_width": None,
        "abbreviations": None,
        "ignore": [],
        "include": [],
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

    ignore = parsed.get("ignore")
    if isinstance(ignore, (list, tuple, set)):
        config["ignore"] = [str(item).strip() for item in ignore if str(item).strip()]
    elif isinstance(ignore, str):
        parts = [part.strip() for part in ignore.split(",")]
        config["ignore"] = [part for part in parts if part]

    include = parsed.get("include")
    if isinstance(include, (list, tuple, set)):
        config["include"] = [str(item).strip() for item in include if str(item).strip()]
    elif isinstance(include, str):
        parts = [part.strip() for part in include.split(",")]
        config["include"] = [part for part in parts if part]

    return config

def _effective_abbreviations(root: Path, folder: Path | None = None):
    root_config = get_vyasa_config(root)
    root_abbrevs = _merge_abbreviations(_DEFAULT_ABBREVIATIONS, root_config.get("abbreviations") or [])
    if folder is None or folder == root:
        return root_abbrevs
    current = folder
    while True:
        folder_config = get_vyasa_config(current)
        folder_abbrevs = folder_config.get("abbreviations")
        if folder_abbrevs is not None:
            return _merge_abbreviations(_DEFAULT_ABBREVIATIONS, folder_abbrevs)
        if current == root:
            return root_abbrevs
        if root not in current.parents:
            return root_abbrevs
        current = current.parent

def _effective_ignore_list(root: Path, folder: Path | None = None):
    """Get the effective ignore list for a folder (inherits from root)."""
    root_config = get_vyasa_config(root)
    root_ignore = root_config.get("ignore") or []
    if folder is None or folder == root:
        return root_ignore
    folder_config = get_vyasa_config(folder)
    folder_ignore = folder_config.get("ignore")
    return folder_ignore if folder_ignore is not None else root_ignore

def _effective_include_list(root: Path, folder: Path | None = None):
    """Get the effective include list for a folder (inherits from root)."""
    root_config = get_vyasa_config(root)
    root_include = root_config.get("include") or []
    if folder is None or folder == root:
        return root_include
    folder_config = get_vyasa_config(folder)
    folder_include = folder_config.get("include")
    return folder_include if folder_include is not None else root_include

def _should_include_folder(folder_name: str, include_list: list, ignore_list: list) -> bool:
    """Check if a folder should be included based on include/ignore lists.
    
    Logic:
    - If in ignore list: exclude
    - If include list is empty: include (no whitelist defined)
    - If include list is defined: only include if in the list
    """
    if folder_name in ignore_list:
        return False
    if not include_list:
        return True
    return folder_name in include_list

def get_vyasa_config(folder: Path):
    vyasa_path = folder / ".vyasa"
    if not vyasa_path.exists():
        return _normalize_vyasa_config({})
    try:
        mtime = vyasa_path.stat().st_mtime
    except OSError:
        return _normalize_vyasa_config({})
    parsed = _cached_vyasa_config(str(vyasa_path), mtime)
    config = _normalize_vyasa_config(parsed)
    logger.debug("[DEBUG] .vyasa config for {}: order={} sort={} folders_first={}", folder, config.get("order"), config.get("sort"), config.get("folders_first"))
    return config

def order_vyasa_entries(entries, config):
    if not entries:
        return []

    order_list = [name.strip().rstrip("/") for name in config.get("order", []) if str(name).strip()]
    if not order_list:
        sorted_entries = _sort_vyasa_entries(entries, config.get("sort"), config.get("folders_first", True))
        if config.get("folders_always_first"):
            sorted_entries = _group_folders_first(sorted_entries)
        logger.debug("[DEBUG] .vyasa order empty; sorted entries: {}", [item.name for item in sorted_entries])
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
    remaining_sorted = _sort_vyasa_entries(
        remaining,
        config.get("sort"),
        config.get("folders_first", True)
    )
    combined = ordered + remaining_sorted
    if config.get("folders_always_first"):
        combined = _group_folders_first(combined)
    logger.debug("[DEBUG] .vyasa ordered={} remaining={}", [item.name for item in ordered], [item.name for item in remaining_sorted])
    return combined

def _group_folders_first(entries):
    folders = [item for item in entries if item.is_dir()]
    files = [item for item in entries if not item.is_dir()]
    return folders + files

def _sort_vyasa_entries(entries, sort_method, folders_first):
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

def list_vyasa_posts(root: Path, include_hidden: bool = False) -> list[dict]:
    """List all posts in the blog root (md + tree + pdf)."""
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
        if path.suffix.lower() not in {".md", ".tree", ".pdf"}:
            continue

        rel = Path(*rel_parts)
        slug = rel.with_suffix("").as_posix()
        if path.suffix.lower() == ".md":
            title = get_post_title(path, abbreviations=abbreviations)
            kind = "md"
        elif path.suffix.lower() == ".tree":
            title = slug_to_title(rel.stem, abbreviations=abbreviations)
            kind = "tree"
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

def list_vyasa_entries(root: Path, relative: str = ".", include_hidden: bool = False) -> dict:
    """List immediate entries (folders + md/tree/pdf files) under a relative path."""
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
        if item.suffix.lower() not in {".md", ".tree", ".pdf"}:
            continue
        rel = item.relative_to(root)
        slug = rel.with_suffix("").as_posix()
        if item.suffix.lower() == ".md":
            title = get_post_title(item, abbreviations=abbreviations)
            kind = "md"
        elif item.suffix.lower() == ".tree":
            title = slug_to_title(rel.stem, abbreviations=abbreviations)
            kind = "tree"
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
