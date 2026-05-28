from __future__ import annotations

import re
from pathlib import Path

from .config import get_config
from .helpers import (
    content_path_for_slug,
    content_root_and_relative,
    content_slug_for_path,
    content_url_for_slug,
    get_content_mounts,
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


def resolve_items_node_href(href, current_path):
    href = str(href or "").strip()
    if not href:
        return href
    if href.startswith(("#", "/", "//")) or re.match(r"^[a-zA-Z][\w+.-]*:", href):
        return href
    base, frag = href.split("#", 1) if "#" in href else (href, "")
    if not current_path:
        return href
    current_file = current_content_path(current_path)
    resolved = (current_file.parent / base).resolve() if current_file else None
    rel = slug_for_resolved_path(resolved, current_path, strip_suffix=not Path(base).suffix) if resolved else None
    if not rel:
        return href
    mapped = content_url_for_slug(rel)
    return f"{mapped}#{frag}" if frag else mapped


def normalize_items_model_hrefs(model, current_path):
    for bucket in ("groups", "tasks"):
        for node in model.get(bucket, []):
            if "href" in node:
                node["href"] = resolve_items_node_href(node.get("href"), current_path)


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
    config = {}
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
        if key in {"filter_attributes", "filter_whitelist", "filter_blacklist"}:
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
            config[key] = {}
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
                    config["color_by"][child_key] = clean(child_value)
                    index += 1
                    continue
                config["color_by"][child_key] = {}
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
                    config["color_by"][child_key][clean(value_key)] = clean(value_value)
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
