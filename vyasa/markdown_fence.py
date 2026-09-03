from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from .config import get_config
from .helpers import (
    content_path_for_slug,
    content_root_and_relative,
    content_slug_for_path,
    content_url_for_slug,
    get_content_mounts,
    relative_content_directory,
)


def get_root_folder():
    return get_config().get_root_folder()


def current_content_path(current_path):
    parts = Path(str(current_path).strip("/")).parts
    aliases = {alias for alias, _ in get_content_mounts() if alias}
    if parts and parts[0] in aliases:
        return content_path_for_slug(current_path)
    return (get_root_folder().resolve() / current_path).resolve()


def current_content_root_and_relative(current_path):
    parts = Path(str(current_path).strip("/")).parts
    aliases = {alias for alias, _ in get_content_mounts() if alias}
    if parts and parts[0] in aliases:
        return content_root_and_relative(current_path)
    return get_root_folder(), Path(current_path)


def slug_for_resolved_path(resolved, current_path, strip_suffix=True):
    parts = Path(str(current_path).strip("/")).parts
    aliases = {alias for alias, _ in get_content_mounts() if alias}
    if parts and parts[0] in aliases:
        return content_slug_for_path(resolved, strip_suffix=strip_suffix)
    try:
        rel = resolved.relative_to(get_root_folder().resolve())
    except ValueError:
        return None
    return rel.with_suffix("").as_posix() if strip_suffix else rel.as_posix()


FENCE_DATA_SUFFIXES = frozenset({".json", ".yaml", ".yml", ".csv"})


def resolve_fence_data_path(src, current_path, suffixes=FENCE_DATA_SUFFIXES) -> Path:
    """Resolve a fence `src=` against the current document, confined to its root.

    A fence body is author-supplied text, so the resolved path must stay under
    the content root that serves the document and must carry a known data
    suffix. Raises ValueError with a message the author can act on.
    """
    candidate = str(src or "").strip()
    if not candidate:
        raise ValueError("src is empty")
    if "://" in candidate or candidate.startswith(("/", "~")):
        raise ValueError("src must be a path relative to the document")
    if Path(candidate).suffix.lower() not in suffixes:
        raise ValueError(f"src must end in {', '.join(sorted(suffixes))}")
    if not current_path:
        raise ValueError("src needs a document path")
    root = Path(current_content_root_and_relative(current_path)[0]).resolve()
    resolved = (current_content_path(current_path).parent / candidate).resolve()
    if not resolved.is_relative_to(root):
        raise ValueError("src escapes the content root")
    if not resolved.is_file():
        raise ValueError(f"src not found: {candidate}")
    return resolved


def resolve_items_node_href(href: object, current_path: object, code_source: str = "") -> str:
    """Map one relative link inside an items model onto a content route.

    `code_source` is the pack's fallback folder for code files. The pack folder
    is tried first, so a file that sits beside the pack keeps working; the
    fallback runs only when that path holds no file.
    """
    href = str(href or "").strip()
    if not href:
        return href
    if href.startswith(("#", "/", "//")) or re.match(r"^[a-zA-Z][\w+.-]*:", href):
        return href
    base, frag = href.split("#", 1) if "#" in href else (href, "")
    # A code link carries its symbol in the query. Keep the query out of the
    # path, or the route encodes the `?` and the preview loses the symbol.
    base, query = base.split("?", 1) if "?" in base else (base, "")
    if not current_path or not base:
        return href
    current_file = current_content_path(current_path)
    current_dir = relative_content_directory(current_file)
    resolved = (current_dir / base).resolve() if current_dir else None
    if resolved is not None and code_source and not resolved.exists():
        candidate = (current_dir / code_source / base).resolve()
        if candidate.exists():
            resolved = candidate
    rel = slug_for_resolved_path(resolved, current_path, strip_suffix=not Path(base).suffix) if resolved else None
    if not rel:
        return href
    mapped = content_url_for_slug(rel)
    return f"{mapped}{f'?{query}' if query else ''}{f'#{frag}' if frag else ''}"


def resolve_items_inline_links(value: object, current_path: object, code_source: str = "") -> str:
    text = str(value or "")
    return re.sub(
        r"\[([^\]]+)\]\(([^)\s]+)\)",
        lambda match: f"[{match.group(1)}]({resolve_items_node_href(match.group(2), current_path, code_source)})",
        text,
    )


@lru_cache(maxsize=256)
def _pack_code_source(schema_path: str, stamp: float) -> str:
    """Read `code_source` from one `kg.schema`, cached by the file's mtime."""
    from .extensions_builtin.tasks.items_pack import read_schema

    try:
        return str(read_schema(Path(schema_path)).code_source or "").strip()
    except Exception:
        return ""


def items_code_source(model: dict[str, Any]) -> str:
    """Fallback folder for the code links inside one items model.

    Empty when the model has no KG pack, or when the pack sets no
    `code_source` in its `@sources` block.

    Pros: the pack states the path once, so every node link stays short.
    Cons: the schema is read again whenever it changes on disk.
    """
    schema = str((model or {}).get("kg_schema") or "").strip()
    if not schema:
        return ""
    try:
        stamp = Path(schema).stat().st_mtime
    except OSError:
        return ""
    return _pack_code_source(schema, stamp)


def items_link_base_path(model: dict[str, Any], current_path: object) -> object:
    """Content path that relative links inside an items model resolve against.

    A KG pack owns its links, so the same pack renders the same links from the
    `.kg` page and from every document that references it. A model without a
    pack keeps the referring document path.
    """
    schema = str((model or {}).get("kg_schema") or "").strip()
    if not schema:
        return current_path
    return content_slug_for_path(Path(schema).parent) or current_path


def normalize_items_model_hrefs(model: dict[str, Any], current_path: object, code_source: str = "") -> None:
    for bucket in ("groups", "tasks"):
        for node in model.get(bucket, []):
            if "href" in node:
                node["href"] = resolve_items_node_href(node.get("href"), current_path, code_source)
            if "label" in node:
                node["label"] = resolve_items_inline_links(node.get("label"), current_path, code_source)
    for collection in ("projection_models", "viewer_models"):
        for entry in (model.get(collection) or {}).values():
            nested = entry.get("model") if isinstance(entry, dict) else None
            if isinstance(nested, dict):
                normalize_items_model_hrefs(nested, current_path, code_source)


def escape_attr(value):
    if value is None:
        return None
    return (
        str(value)
        .replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def split_fence_frontmatter(code):
    code = code.lstrip()

    def clean(value):
        return value.strip().strip('"').strip("'")

    def parse_string_list(value):
        stripped = value.strip()
        if not stripped:
            return []
        if stripped.startswith("[") and stripped.endswith("]"):
            inner = stripped[1:-1].strip()
            if not inner:
                return []
            return [clean(part) for part in inner.split(",") if part.strip()]
        return [clean(part) for part in stripped.split(",") if part.strip()]

    frontmatter_match = re.match(r"^---\s*\n(.*?)\n---\s*\n", code, re.DOTALL)
    if not frontmatter_match:
        return {}, code
    config: dict[str, Any] = {}
    lines = frontmatter_match.group(1).splitlines()
    index = 0
    while index < len(lines):
        raw_line = lines[index]
        if not raw_line.strip():
            index += 1
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        line = raw_line.strip()
        if ":" not in line:
            index += 1
            continue
        key, value = line.split(":", 1)
        key = clean(key)
        value = value.strip()
        if key in {"filter_attributes", "filter_whitelist", "filter_blacklist", "card_states"}:
            if value:
                config[key] = parse_string_list(value)
                index += 1
                continue
            values = []
            index += 1
            while index < len(lines):
                child_raw = lines[index]
                if not child_raw.strip():
                    index += 1
                    continue
                child_indent = len(child_raw) - len(child_raw.lstrip(" "))
                if child_indent <= indent:
                    break
                child_line = child_raw.strip()
                if child_line.startswith("- "):
                    values.append(clean(child_line[2:]))
                index += 1
            config[key] = values
            continue
        if key == "color_by":
            if value:
                config[key] = clean(value)
                index += 1
                continue
            color_by: dict[str, Any] = {}
            config[key] = color_by
            index += 1
            while index < len(lines):
                child_raw = lines[index]
                if not child_raw.strip():
                    index += 1
                    continue
                child_indent = len(child_raw) - len(child_raw.lstrip(" "))
                if child_indent <= indent:
                    break
                child_line = child_raw.strip()
                if ":" not in child_line:
                    index += 1
                    continue
                child_key, child_value = child_line.split(":", 1)
                child_key = clean(child_key)
                child_value = child_value.strip()
                if child_value:
                    color_by[child_key] = clean(child_value)
                    index += 1
                    continue
                color_by[child_key] = {}
                index += 1
                while index < len(lines):
                    value_raw = lines[index]
                    if not value_raw.strip():
                        index += 1
                        continue
                    value_indent = len(value_raw) - len(value_raw.lstrip(" "))
                    if value_indent <= child_indent:
                        break
                    value_line = value_raw.strip()
                    if ":" not in value_line:
                        index += 1
                        continue
                    value_key, value_value = value_line.split(":", 1)
                    color_by[child_key][clean(value_key)] = clean(value_value)
                    index += 1
            continue
        if key == "color_palette":
            config[key] = {}
            if value:
                config["color_by"] = clean(value)
            index += 1
            while index < len(lines):
                child_raw = lines[index]
                if not child_raw.strip():
                    index += 1
                    continue
                child_indent = len(child_raw) - len(child_raw.lstrip(" "))
                if child_indent <= indent:
                    break
                child_line = child_raw.strip()
                if ":" not in child_line:
                    index += 1
                    continue
                child_key, child_value = child_line.split(":", 1)
                config[key][clean(child_key)] = clean(child_value)
                index += 1
            continue
        if key == "edge_color_palette":
            config[key] = {}
            if value:
                config["edge_color_by"] = clean(value)
            index += 1
            while index < len(lines):
                child_raw = lines[index]
                if not child_raw.strip():
                    index += 1
                    continue
                child_indent = len(child_raw) - len(child_raw.lstrip(" "))
                if child_indent <= indent:
                    break
                child_line = child_raw.strip()
                if ":" not in child_line:
                    index += 1
                    continue
                child_key, child_value = child_line.split(":", 1)
                config[key][clean(child_key)] = clean(child_value)
                index += 1
            continue
        config[key] = clean(value)
        index += 1
    return config, code[frontmatter_match.end():]
