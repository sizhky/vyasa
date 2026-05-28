from collections import defaultdict
from pathlib import Path
import json
import re
import secrets

from ...markdown_fence import current_content_path, get_root_folder
from .projections import attach_projection_models, normalize_projections


_STRING_DECODER = json.JSONDecoder()


def _extract_tasks_body(text: str) -> str:
    if "```tasks" in text:
        return text.split("```tasks", 1)[1].split("```", 1)[0]
    if "```items" in text:
        return text.split("```items", 1)[1].split("```", 1)[0]
    raise ValueError("No items payload found")


def _strip_fence_frontmatter(body: str) -> str:
    lines = body.splitlines()
    if not lines or lines[0].strip() != "---":
        return body
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return "\n".join(lines[index + 1:])
    return body


def _read_fence_frontmatter(body: str) -> tuple[dict, str]:
    lines = body.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, body
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() != "---":
            continue
        config: dict = {}
        frontmatter_lines = lines[1:index]
        cursor = 0
        while cursor < len(frontmatter_lines):
            raw_line = frontmatter_lines[cursor]
            if not raw_line.strip() or raw_line.lstrip().startswith("#"):
                cursor += 1
                continue
            indent = _count_indent(raw_line)
            line = raw_line.strip()
            key_index = _find_unquoted(line, ":")
            if key_index < 0:
                cursor += 1
                continue
            key = line[:key_index].strip()
            value = line[key_index + 1:].strip()
            if key in {"id", "title", "default_color_by", "default_projection", "base_view_label", "edge_color_by", "edge_label_from", "color_palette_source", "edge_color_palette_source"}:
                config[key] = _read_string(value)
                cursor += 1
                continue
            if key == "view_projections":
                projections = []
                current = None
                cursor += 1
                while cursor < len(frontmatter_lines):
                    child_raw = frontmatter_lines[cursor]
                    if not child_raw.strip() or child_raw.lstrip().startswith("#"):
                        cursor += 1
                        continue
                    child_indent = _count_indent(child_raw)
                    if child_indent <= indent:
                        break
                    child_line = child_raw.strip()
                    if child_line.startswith("- "):
                        if current:
                            projections.append(current)
                        current = {}
                        child_line = child_line[2:].strip()
                        child_key_index = _find_unquoted(child_line, ":")
                        if child_key_index >= 0:
                            current[child_line[:child_key_index].strip()] = _read_string(child_line[child_key_index + 1:].strip())
                        cursor += 1
                        continue
                    child_key_index = _find_unquoted(child_line, ":")
                    if current is None or child_key_index < 0:
                        cursor += 1
                        continue
                    sub_key = child_line[:child_key_index].strip()
                    sub_value = child_line[child_key_index + 1:].strip()
                    if sub_value:
                        if sub_value.startswith("[") and sub_value.endswith("]"):
                            current[sub_key] = _read_string_list(sub_value)
                        else:
                            current[sub_key] = _read_string(sub_value)
                        cursor += 1
                        continue
                    sub_items: list = []
                    cursor += 1
                    while cursor < len(frontmatter_lines):
                        item_raw = frontmatter_lines[cursor]
                        if not item_raw.strip() or item_raw.lstrip().startswith("#"):
                            cursor += 1
                            continue
                        item_indent = _count_indent(item_raw)
                        if item_indent <= child_indent:
                            break
                        item_line = item_raw.strip()
                        if item_line.startswith("- "):
                            sub_items.append(_read_string(item_line[2:].strip()))
                        cursor += 1
                    if sub_items:
                        current[sub_key] = sub_items
                if current:
                    projections.append(current)
                config["view_projections"] = normalize_projections(projections)
                continue
            if key in {"filter_attributes", "filter_whitelist", "filter_blacklist", "hover_attrs"}:
                if value:
                    config[key] = _read_string_list(value)
                    cursor += 1
                    continue
                values = []
                cursor += 1
                while cursor < len(frontmatter_lines):
                    child_raw = frontmatter_lines[cursor]
                    if not child_raw.strip() or child_raw.lstrip().startswith("#"):
                        cursor += 1
                        continue
                    child_indent = _count_indent(child_raw)
                    if child_indent <= indent:
                        break
                    child_line = child_raw.strip()
                    if child_line.startswith("- "):
                        values.append(_read_string(child_line[2:].strip()))
                    cursor += 1
                config[key] = values
                continue
            if key == "color_by":
                if value:
                    config["color_by"] = _read_string(value)
                    cursor += 1
                    continue
                palettes = {}
                default_key = ""
                cursor += 1
                while cursor < len(frontmatter_lines):
                    child_raw = frontmatter_lines[cursor]
                    if not child_raw.strip() or child_raw.lstrip().startswith("#"):
                        cursor += 1
                        continue
                    child_indent = _count_indent(child_raw)
                    if child_indent <= indent:
                        break
                    child_line = child_raw.strip()
                    child_key_index = _find_unquoted(child_line, ":")
                    if child_key_index < 0:
                        cursor += 1
                        continue
                    palette_key = _read_string(child_line[:child_key_index].strip())
                    palette_value = child_line[child_key_index + 1:].strip()
                    if palette_value:
                        cursor += 1
                        continue
                    if not default_key:
                        default_key = palette_key
                    palette = {}
                    cursor += 1
                    while cursor < len(frontmatter_lines):
                        value_raw = frontmatter_lines[cursor]
                        if not value_raw.strip() or value_raw.lstrip().startswith("#"):
                            cursor += 1
                            continue
                        value_indent = _count_indent(value_raw)
                        if value_indent <= child_indent:
                            break
                        value_line = value_raw.strip()
                        value_key_index = _find_unquoted(value_line, ":")
                        if value_key_index < 0:
                            cursor += 1
                            continue
                        palette[_read_string(value_line[:value_key_index].strip())] = _read_string(value_line[value_key_index + 1:].strip())
                        cursor += 1
                    palettes[palette_key] = palette
                config["color_by"] = default_key
                config["node_color_palettes"] = palettes
                continue
            if key == "color_palette":
                palette_key = _read_string(value) if value else ""
                if palette_key:
                    config["color_by"] = palette_key
                palette = {}
                cursor += 1
                while cursor < len(frontmatter_lines):
                    child_raw = frontmatter_lines[cursor]
                    if not child_raw.strip() or child_raw.lstrip().startswith("#"):
                        cursor += 1
                        continue
                    child_indent = _count_indent(child_raw)
                    if child_indent <= indent:
                        break
                    child_line = child_raw.strip()
                    child_key_index = _find_unquoted(child_line, ":")
                    if child_key_index < 0:
                        cursor += 1
                        continue
                    palette[_read_string(child_line[:child_key_index].strip())] = _read_string(child_line[child_key_index + 1:].strip())
                    cursor += 1
                config["color_palette"] = palette
                config["node_color_palettes"] = {palette_key: palette} if palette_key else {}
                continue
            if key == "edge_color_palette":
                palette_key = _read_string(value) if value else ""
                if palette_key:
                    config["edge_color_by"] = palette_key
                palette = {}
                cursor += 1
                while cursor < len(frontmatter_lines):
                    child_raw = frontmatter_lines[cursor]
                    if not child_raw.strip() or child_raw.lstrip().startswith("#"):
                        cursor += 1
                        continue
                    child_indent = _count_indent(child_raw)
                    if child_indent <= indent:
                        break
                    child_line = child_raw.strip()
                    child_key_index = _find_unquoted(child_line, ":")
                    if child_key_index < 0:
                        cursor += 1
                        continue
                    palette[_read_string(child_line[:child_key_index].strip())] = _read_string(child_line[child_key_index + 1:].strip())
                    cursor += 1
                config["edge_color_palette"] = palette
                config["edge_color_palettes"] = {palette_key: palette} if palette_key else {}
                continue
            cursor += 1
        return config, "\n".join(lines[index + 1:])
    return {}, body


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return slug or "item"


def _generated_graph_id(graph: dict) -> str:
    base = graph.get("title") or "tasks"
    return f"{_slugify(base)}-{secrets.token_hex(3)}"


def _count_indent(raw_line: str) -> int:
    return len(raw_line) - len(raw_line.lstrip(" "))


def _is_escaped(text: str, index: int) -> bool:
    count = 0
    cursor = index - 1
    while cursor >= 0 and text[cursor] == "\\":
        count += 1
        cursor -= 1
    return count % 2 == 1


def _find_unquoted(text: str, needle: str) -> int:
    in_string = False
    index = 0
    while index <= len(text) - len(needle):
        char = text[index]
        if char == '"' and not _is_escaped(text, index):
            in_string = not in_string
        if not in_string and text.startswith(needle, index):
            return index
        index += 1
    return -1


def _split_unquoted(text: str, sep: str) -> list[str]:
    parts = []
    start = 0
    index = 0
    in_string = False
    while index < len(text):
        char = text[index]
        if char == '"' and not _is_escaped(text, index):
            in_string = not in_string
        if not in_string and text.startswith(sep, index):
            parts.append(text[start:index].strip())
            index += len(sep)
            start = index
            continue
        index += 1
    parts.append(text[start:].strip())
    return parts


def _read_string(text: str) -> str:
    text = text.strip()
    if not text:
        return ""
    if text[0] == '"':
        value, end = _STRING_DECODER.raw_decode(text)
        if text[end:].strip():
            raise ValueError(f"Unexpected text after quoted string: {text[end:].strip()}")
        return str(value)
    return text


def _read_attr_value(text: str):
    value = _read_string(text)
    if isinstance(value, str):
        lowered = value.lower()
        if lowered == "true":
            return True
        if lowered == "false":
            return False
    return value


def _read_string_list(text: str) -> list[str]:
    value = text.strip()
    if not value:
        return []
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        if not inner:
            return []
        return [_read_string(part) for part in _split_unquoted(inner, ",") if part.strip()]
    return [_read_string(part) for part in value.split(",") if part.strip()]


def _clean_palette_map(value) -> dict:
    if not isinstance(value, dict):
        return {}
    return {
        str(key).strip(): str(palette).strip()
        for key, palette in value.items()
        if str(key).strip() and palette is not None and str(palette).strip()
    }


def _clean_gradient_palette(value) -> dict:
    if not isinstance(value, dict):
        return {}
    stops = value.get("stops")
    if not isinstance(stops, list):
        return {}
    cleaned_stops = []
    for stop in stops:
        if not isinstance(stop, dict):
            continue
        color = str(stop.get("color") or "").strip()
        if not color:
            continue
        try:
            at = float(stop.get("at"))
        except (TypeError, ValueError):
            continue
        cleaned_stops.append({"at": at, "color": color})
    if len(cleaned_stops) < 2:
        return {}
    gradient = {"type": "continuous", "stops": cleaned_stops}
    domain = value.get("domain")
    if isinstance(domain, list) and len(domain) == 2:
        try:
            start = float(domain[0])
            end = float(domain[1])
        except (TypeError, ValueError):
            start = end = None
        if start is not None and end is not None and start != end:
            gradient["domain"] = [start, end]
    if "wrap" in value:
        gradient["wrap"] = bool(value.get("wrap"))
    label = str(value.get("label") or "").strip()
    if label:
        gradient["label"] = label
    return gradient


def _clean_palette_definition(value) -> dict:
    gradient = _clean_gradient_palette(value)
    if gradient:
        return gradient
    return _clean_palette_map(value)


def _clean_palette_sources(value) -> dict[str, dict]:
    if not isinstance(value, dict):
        return {}
    if not value or not all(isinstance(palette, dict) for palette in value.values()):
        return {}
    return {
        str(key).strip(): _clean_palette_definition(palette)
        for key, palette in value.items()
        if str(key).strip() and _clean_palette_definition(palette)
    }


def _clean_combined_palette_source(value) -> tuple[dict[str, dict], dict[str, dict]]:
    if not isinstance(value, dict):
        return {}, {}
    color_palettes = _clean_palette_sources(value.get("node_color_palettes") or {})
    edge_color_palettes = _clean_palette_sources(value.get("edge_color_palettes") or {})
    return color_palettes, edge_color_palettes


def _clean_edge_kinds(value) -> dict[str, dict]:
    """Edge kinds: { kind_name: { attr: value, ... } }. Cleaned to dict[str, dict[str, str]]."""
    if not isinstance(value, dict):
        return {}
    out: dict[str, dict] = {}
    for key, attrs in value.items():
        kind = str(key or "").strip()
        if not kind or not isinstance(attrs, dict):
            continue
        cleaned = {}
        for attr_key, attr_value in attrs.items():
            attr_name = str(attr_key or "").strip()
            if not attr_name:
                continue
            if attr_value is None:
                continue
            cleaned[attr_name] = str(attr_value).strip()
        if cleaned:
            out[kind] = cleaned
    return out


def _resolve_tasks_source_path(current_path: str | Path | None, source: str) -> Path | None:
    source_text = str(source or "").strip()
    if not source_text:
        return None
    if re.match(r"^[a-zA-Z][\w+.-]*://", source_text):
        return None
    source_path = Path(source_text)
    if source_path.is_absolute():
        return source_path
    if current_path:
        current_path = Path(str(current_path))
        if current_path.exists():
            base = current_path.parent if current_path.is_file() else current_path
        else:
            resolved = current_content_path(str(current_path))
            base = resolved.parent if resolved else get_root_folder().resolve()
    else:
        base = get_root_folder().resolve()
    return (base / source_path).resolve()


def _load_palette_source(current_path: str | Path | None, source: str, palette_key: str = "") -> tuple[dict, dict, str]:
    resolved = _resolve_tasks_source_path(current_path, source)
    if not resolved or not resolved.exists():
        return {}, {}, ""
    try:
        payload = json.loads(resolved.read_text(encoding="utf-8"))
    except Exception:
        return {}, {}, ""
    palette = _clean_palette_definition(payload)
    if not palette:
        return {}, {}, ""
    selected_key = str(palette_key or "").strip()
    return palette, ({selected_key: palette} if selected_key else {}), selected_key


def _load_combined_palette_source(current_path: str | Path | None, source: str) -> tuple[dict[str, dict], dict[str, dict], dict[str, dict]]:
    resolved = _resolve_tasks_source_path(current_path, source)
    if not resolved or not resolved.exists():
        return {}, {}, {}
    try:
        payload = json.loads(resolved.read_text(encoding="utf-8"))
    except Exception:
        return {}, {}, {}
    color_palettes, edge_color_palettes = _clean_combined_palette_source(payload)
    edge_kinds = _clean_edge_kinds(payload.get("edge_kinds") if isinstance(payload, dict) else None)
    return color_palettes, edge_color_palettes, edge_kinds


def _read_optional_edge_label(text: str) -> tuple[str, str]:
    text = text.strip()
    if not text.startswith("|"):
        return "", text
    cursor = 1
    in_string = False
    while cursor < len(text):
        char = text[cursor]
        if char == '"' and not _is_escaped(text, cursor):
            in_string = not in_string
        if char == "|" and not in_string:
            return _read_string(text[1:cursor].strip()), text[cursor + 1:].strip()
        cursor += 1
    raise ValueError("Unclosed edge label")


def _split_attrs(text: str) -> tuple[str, dict]:
    parts = _split_unquoted(text, "|")
    head = parts[0]
    attrs = {}
    for part in parts[1:]:
        if not part:
            continue
        key_index = _find_unquoted(part, ":")
        if key_index < 0:
            attrs[part.strip().replace("-", "_")] = True
            continue
        key = part[:key_index].strip().replace("-", "_")
        attrs[key] = _read_attr_value(part[key_index + 1:].strip())
    return head, attrs


def _parse_node_def(text: str) -> tuple[str | None, str, dict]:
    head, attrs = _split_attrs(text)
    id_index = _find_unquoted(head, "::")
    if id_index >= 0:
        node_id = _read_string(head[:id_index].strip())
        label = _read_string(head[id_index + 2:].strip())
        return node_id, label, attrs
    label = _read_string(head)
    return None, label, attrs


def _dedupe_id(base: str, used: set[str]) -> str:
    node_id = base
    index = 2
    while node_id in used:
        node_id = f"{base}-{index}"
        index += 1
    used.add(node_id)
    return node_id


def _parse_edge_refs(text: str) -> list[str]:
    return [_read_string(part) for part in _split_unquoted(text, ",") if part.strip()]


def _add_edges(graph: dict, source_text: str, target_text: str, label: str, attrs: dict | None = None) -> None:
    sources = _parse_edge_refs(source_text)
    targets = _parse_edge_refs(target_text)
    for source in sources:
        for target in targets:
            edge = {"source": source, "target": target}
            if label:
                edge["label"] = label
            if attrs:
                edge.update(attrs)
            graph["dependency_edges"].append(edge)


def _add_edge_chain(graph: dict, line: str) -> None:
    segments = _split_unquoted(line, "->")
    source_text = segments[0].strip()
    for segment in segments[1:]:
        label, target_text = _read_optional_edge_label(segment.strip())
        target_refs, edge_attrs = _split_attrs(target_text)
        _add_edges(graph, source_text, target_refs, label, edge_attrs)
        source_text = target_refs


def _parse_items_graph(body: str) -> dict:
    graph = {"groups": [], "tasks": [], "dependency_edges": [], "node_color_palettes": {}, "edge_color_palettes": {}}
    stack: list[dict] = []
    used_ids: set[str] = set()
    lines = body.splitlines()

    def pop_to(indent: int) -> None:
        while stack and indent <= stack[-1]["indent"]:
            stack.pop()

    def current_group_id() -> str | None:
        for item in reversed(stack):
            if item["kind"] == "group":
                return item["id"]
        return None

    index = 0
    while index < len(lines):
        raw_line = lines[index]
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            index += 1
            continue
        indent = _count_indent(raw_line)
        line = raw_line.strip()

        if indent == 0 and _find_unquoted(line, ":") > 0 and _find_unquoted(line, "->") < 0:
            key, value = line.split(":", 1)
            key = key.strip()
            if key in {"id", "title", "default_color_by", "default_projection", "base_view_label", "edge_color_by", "edge_label_from", "color_palette_source", "edge_color_palette_source"}:
                graph[key] = _read_string(value.strip())
                index += 1
                continue
            if key == "color_by":
                if value.strip():
                    graph["color_by"] = _read_string(value.strip())
                    index += 1
                    continue
                palettes = {}
                default_key = ""
                index += 1
                while index < len(lines):
                    child_raw = lines[index]
                    if not child_raw.strip() or child_raw.lstrip().startswith("#"):
                        index += 1
                        continue
                    child_indent = _count_indent(child_raw)
                    if child_indent <= indent:
                        break
                    child_line = child_raw.strip()
                    child_key_index = _find_unquoted(child_line, ":")
                    if child_key_index < 0:
                        raise ValueError(f"Expected color_by entry key: value, got {child_raw!r}")
                    palette_key = _read_string(child_line[:child_key_index].strip())
                    palette_value = child_line[child_key_index + 1:].strip()
                    if palette_value:
                        raise ValueError("Nested color_by palettes must use indented value: color entries")
                    if not default_key:
                        default_key = palette_key
                    palette = {}
                    index += 1
                    while index < len(lines):
                        value_raw = lines[index]
                        if not value_raw.strip() or value_raw.lstrip().startswith("#"):
                            index += 1
                            continue
                        value_indent = _count_indent(value_raw)
                        if value_indent <= child_indent:
                            break
                        value_line = value_raw.strip()
                        value_key_index = _find_unquoted(value_line, ":")
                        if value_key_index < 0:
                            raise ValueError(f"Expected color_by palette value: color, got {value_raw!r}")
                        palette[_read_string(value_line[:value_key_index].strip())] = _read_string(value_line[value_key_index + 1:].strip())
                        index += 1
                    palettes[palette_key] = palette
                graph["color_by"] = default_key
                graph["node_color_palettes"] = palettes
                continue
            if key == "color_palette":
                palette_key = _read_string(value.strip())
                if palette_key:
                    graph["color_by"] = palette_key
                palette = {}
                index += 1
                while index < len(lines):
                    child_raw = lines[index]
                    if not child_raw.strip() or child_raw.lstrip().startswith("#"):
                        index += 1
                        continue
                    child_indent = _count_indent(child_raw)
                    if child_indent <= indent:
                        break
                    child_line = child_raw.strip()
                    child_key_index = _find_unquoted(child_line, ":")
                    if child_key_index < 0:
                        raise ValueError(f"Expected color palette entry key: value, got {child_raw!r}")
                    child_key = _read_string(child_line[:child_key_index].strip())
                    palette[child_key] = _read_string(child_line[child_key_index + 1:].strip())
                    index += 1
                graph["color_palette"] = palette
                graph["node_color_palettes"][graph.get("color_by") or palette_key or ""] = palette
                continue
            if key == "edge_color_palette":
                palette_key = _read_string(value.strip())
                if palette_key:
                    graph["edge_color_by"] = palette_key
                palette = {}
                index += 1
                while index < len(lines):
                    child_raw = lines[index]
                    if not child_raw.strip() or child_raw.lstrip().startswith("#"):
                        index += 1
                        continue
                    child_indent = _count_indent(child_raw)
                    if child_indent <= indent:
                        break
                    child_line = child_raw.strip()
                    child_key_index = _find_unquoted(child_line, ":")
                    if child_key_index < 0:
                        raise ValueError(f"Expected edge color palette entry key: value, got {child_raw!r}")
                    child_key = _read_string(child_line[:child_key_index].strip())
                    palette[child_key] = _read_string(child_line[child_key_index + 1:].strip())
                    index += 1
                graph["edge_color_palette"] = palette
                graph["edge_color_palettes"][graph.get("edge_color_by") or palette_key or ""] = palette
                continue

        edge_index = _find_unquoted(line, "->")
        if edge_index >= 0:
            _add_edge_chain(graph, line)
            index += 1
            continue

        if line.startswith("- ") and line.endswith(":"):
            pop_to(indent)
            explicit_id, label, attrs = _parse_node_def(line[2:-1].strip())
            group_id = _dedupe_id(explicit_id or _slugify(label), used_ids)
            group = {"id": group_id, "label": label, "parent_group_id": current_group_id()}
            group.update(attrs)
            graph["groups"].append(group)
            stack.append({"kind": "group", "id": group_id, "indent": indent})
            index += 1
            continue

        if line.startswith("- "):
            pop_to(indent)
            explicit_id, label, attrs = _parse_node_def(line[2:].strip())
            item_id = _dedupe_id(explicit_id or _slugify(label), used_ids)
            item = {"id": item_id, "label": label, "group_id": current_group_id()}
            item.update(attrs)
            graph["tasks"].append(item)
            stack.append({"kind": "item", "id": item_id, "indent": indent})
            index += 1
            continue

        if line.endswith(":"):
            pop_to(indent)
            explicit_id, label, attrs = _parse_node_def(line[:-1].strip())
            group_id = _dedupe_id(explicit_id or _slugify(label), used_ids)
            group = {"id": group_id, "label": label, "parent_group_id": current_group_id()}
            group.update(attrs)
            graph["groups"].append(group)
            stack.append({"kind": "group", "id": group_id, "indent": indent})
            index += 1
            continue

        raise ValueError(f"Unknown items line: {raw_line}")

    return graph


def _rank_palette(size: int) -> dict[str, str]:
    if size <= 1:
        return {"0": "#22c55e"}
    stops = ["#22c55e", "#84cc16", "#facc15", "#f97316", "#dc2626"]
    palette: dict[str, str] = {}
    for rank in range(size):
        stop_index = round((rank / (size - 1)) * (len(stops) - 1))
        palette[str(rank)] = stops[stop_index]
    return palette


def _centrality_palette() -> dict:
    return {
        "type": "continuous",
        "domain": [0.0, 1.0],
        "stops": [
            {"at": 0.0, "color": "#22c55e"},
            {"at": 0.5, "color": "#facc15"},
            {"at": 1.0, "color": "#dc2626"},
        ],
        "label": "Centrality",
    }


def _apply_dag_ranks(graph: dict) -> None:
    nodes = {item["id"]: item for item in [*graph.get("groups", []), *graph.get("tasks", [])]}
    children_by_group = defaultdict(list)
    for group in graph.get("groups", []):
        children_by_group[group.get("parent_group_id")].append(group["id"])
    for task in graph.get("tasks", []):
        children_by_group[task.get("group_id")].append(task["id"])

    outgoing = defaultdict(list)
    indegree = {node_id: 0 for node_id in nodes}
    for edge in graph.get("dependency_edges", []):
        source = edge.get("source")
        target = edge.get("target")
        if source not in nodes or target not in nodes:
            continue
        outgoing[source].append(target)
        indegree[target] += 1

    rank = {node_id: 0 for node_id in nodes}
    queue = [node_id for node_id, degree in indegree.items() if degree == 0]
    while queue:
        source = queue.pop(0)
        for target in outgoing[source]:
            rank[target] = max(rank[target], rank[source] + 1)
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)

    centrality = {node_id: 0.0 for node_id in nodes}
    for source in nodes:
        stack = []
        predecessors = {node_id: [] for node_id in nodes}
        shortest_path_count = {node_id: 0.0 for node_id in nodes}
        shortest_path_count[source] = 1.0
        distance = {node_id: -1 for node_id in nodes}
        distance[source] = 0
        traversal_queue = [source]
        while traversal_queue:
            current = traversal_queue.pop(0)
            stack.append(current)
            for target in outgoing[current]:
                if distance[target] < 0:
                    traversal_queue.append(target)
                    distance[target] = distance[current] + 1
                if distance[target] == distance[current] + 1:
                    shortest_path_count[target] += shortest_path_count[current]
                    predecessors[target].append(current)
        dependency = {node_id: 0.0 for node_id in nodes}
        while stack:
            target = stack.pop()
            for current in predecessors[target]:
                if shortest_path_count[target] == 0:
                    continue
                dependency[current] += (shortest_path_count[current] / shortest_path_count[target]) * (1.0 + dependency[target])
            if target != source:
                centrality[target] += dependency[target]

    def apply_group_rank(group_id: str) -> int:
        child_ranks = [rank.get(child_id, 0) for child_id in children_by_group.get(group_id, [])]
        for child_id in children_by_group.get(group_id, []):
            if child_id in nodes and "parent_group_id" in nodes[child_id]:
                child_ranks.append(apply_group_rank(child_id))
        if child_ranks:
            rank[group_id] = max(rank.get(group_id, 0), max(child_ranks))
        return rank.get(group_id, 0)

    def apply_group_centrality(group_id: str) -> float:
        child_values = []
        for child_id in children_by_group.get(group_id, []):
            if child_id in nodes and "parent_group_id" in nodes[child_id]:
                child_values.append(apply_group_centrality(child_id))
            else:
                child_values.append(centrality.get(child_id, 0.0))
        if child_values:
            centrality[group_id] = max(centrality.get(group_id, 0.0), sum(child_values) / len(child_values))
        return centrality.get(group_id, 0.0)

    for group in graph.get("groups", []):
        apply_group_rank(group["id"])
        apply_group_centrality(group["id"])
    max_centrality = max(centrality.values(), default=0.0)
    for node_id, node in nodes.items():
        node.setdefault("rank", str(rank.get(node_id, 0)))
        normalized_centrality = 0.0 if max_centrality <= 0 else (centrality.get(node_id, 0.0) / max_centrality)
        node.setdefault("centrality", f"{normalized_centrality:.3f}".rstrip("0").rstrip("."))
    max_rank = max(rank.values(), default=0)
    graph["node_color_palettes"] = {
        "rank": _rank_palette(max_rank + 1),
        "centrality": _centrality_palette(),
        **graph.get("node_color_palettes", {}),
    }


def apply_edge_kind_defaults(graph: dict) -> None:
    """For each edge, look up its kind in graph['edge_kinds'] and merge default
    attributes onto the edge. Inline edge attributes always win over kind defaults.
    The kind name is taken from edge['label'] (the inline pipe-label).
    """
    edge_kinds = graph.get("edge_kinds") or {}
    if not isinstance(edge_kinds, dict) or not edge_kinds:
        return
    for edge in graph.get("dependency_edges", []):
        label = str(edge.get("label") or "").strip()
        if not label:
            continue
        kind_attrs = edge_kinds.get(label)
        if not isinstance(kind_attrs, dict):
            continue
        for attr, value in kind_attrs.items():
            # Inline edge attrs (already on the edge dict) win.
            if edge.get(attr) is None or str(edge.get(attr) or "").strip() == "":
                edge[attr] = value


def apply_edge_label_fallbacks(graph: dict) -> None:
    """If edge_color_by is set, ensure each edge has a value the palette can read.
    Precedence: existing inline attr -> label-as-palette-key -> empty.
    """
    edge_color_key = str(graph.get("edge_color_by") or "").strip()
    if not edge_color_key:
        return
    palette = graph.get("edge_color_palettes", {}).get(edge_color_key, {})
    palette_keys = set(palette.keys()) if isinstance(palette, dict) else set()
    for edge in graph.get("dependency_edges", []):
        edge_value_str = str(edge.get(edge_color_key) or "").strip()
        if edge_value_str and palette_keys and edge_value_str not in palette_keys:
            edge_value_str = ""
        label = edge.get("label")
        if not edge_value_str and label and str(label).strip() in palette_keys:
            edge_value_str = str(label).strip()
        if edge_value_str:
            edge[edge_color_key] = edge_value_str


def _apply_palette_source(graph: dict, current_path: str | Path | None, source_field: str, palette_field: str, palettes_field: str, color_by_field: str) -> None:
    source = str(graph.get(source_field) or "").strip()
    if not source:
        return
    palette_key = str(graph.get(color_by_field) or "").strip()
    palette, palettes, selected_key = _load_palette_source(current_path, source, palette_key)
    if palettes:
        graph[palettes_field] = {**palettes, **graph.get(palettes_field, {})}
        if not graph.get(color_by_field) and selected_key:
            graph[color_by_field] = selected_key
    if palette and not graph.get(palette_field):
        graph[palette_field] = palette


def parse_tasks_text(text: str, current_path: str | Path | None = None) -> dict:
    config, body = _read_fence_frontmatter(_extract_tasks_body(text).strip())
    graph = _parse_items_graph(body)
    if config.get("id") and not graph.get("id"):
        graph["id"] = config["id"]
    if config.get("title") and not graph.get("title"):
        graph["title"] = config["title"]
    if "default_color_by" in config and "default_color_by" not in graph:
        graph["default_color_by"] = config["default_color_by"]
    if "default_projection" in config and "default_projection" not in graph:
        graph["default_projection"] = config["default_projection"]
    if "base_view_label" in config and "base_view_label" not in graph:
        graph["base_view_label"] = config["base_view_label"]
    if "view_projections" in config and "view_projections" not in graph:
        graph["view_projections"] = config["view_projections"]
    if "filter_attributes" in config and "filter_attributes" not in graph:
        graph["filter_attributes"] = config["filter_attributes"]
    if "filter_whitelist" in config and "filter_whitelist" not in graph:
        graph["filter_whitelist"] = config["filter_whitelist"]
    if "filter_blacklist" in config and "filter_blacklist" not in graph:
        graph["filter_blacklist"] = config["filter_blacklist"]
    if "hover_attrs" in config and "hover_attrs" not in graph:
        graph["hover_attrs"] = config["hover_attrs"]
    if config.get("color_palette_source") and not graph.get("color_palette_source"):
        graph["color_palette_source"] = config["color_palette_source"]
    if config.get("color_by") and not graph.get("color_by"):
        graph["color_by"] = config["color_by"]
    if config.get("color_palette") and not graph.get("color_palette"):
        graph["color_palette"] = config["color_palette"]
    if config.get("node_color_palettes"):
        graph["node_color_palettes"] = {**config["node_color_palettes"], **graph.get("node_color_palettes", {})}
    if config.get("edge_color_by") and not graph.get("edge_color_by"):
        graph["edge_color_by"] = config["edge_color_by"]
    if config.get("edge_label_from") and not graph.get("edge_label_from"):
        graph["edge_label_from"] = config["edge_label_from"]
    if config.get("edge_color_palette") and not graph.get("edge_color_palette"):
        graph["edge_color_palette"] = config["edge_color_palette"]
    if config.get("edge_color_palettes"):
        graph["edge_color_palettes"] = {**config["edge_color_palettes"], **graph.get("edge_color_palettes", {})}
    if config.get("edge_color_palette_source") and not graph.get("edge_color_palette_source"):
        graph["edge_color_palette_source"] = config["edge_color_palette_source"]
    if graph.get("color_palette_source"):
        color_palettes, edge_color_palettes, edge_kinds = _load_combined_palette_source(current_path, graph["color_palette_source"])
        if color_palettes:
            graph["node_color_palettes"] = {**color_palettes, **graph.get("node_color_palettes", {})}
            if not graph.get("color_by"):
                graph["color_by"] = next(iter(color_palettes.keys()), "")
            if not graph.get("color_palette") and graph.get("color_by"):
                graph["color_palette"] = color_palettes.get(graph["color_by"], {})
        if edge_color_palettes:
            graph["edge_color_palettes"] = {**edge_color_palettes, **graph.get("edge_color_palettes", {})}
            if not graph.get("edge_color_by"):
                graph["edge_color_by"] = next(iter(edge_color_palettes.keys()), "")
            if not graph.get("edge_color_palette") and graph.get("edge_color_by"):
                graph["edge_color_palette"] = edge_color_palettes.get(graph["edge_color_by"], {})
        if edge_kinds:
            graph["edge_kinds"] = {**edge_kinds, **graph.get("edge_kinds", {})}
    _apply_palette_source(graph, current_path, "color_palette_source", "color_palette", "node_color_palettes", "color_by")
    _apply_palette_source(graph, current_path, "edge_color_palette_source", "edge_color_palette", "edge_color_palettes", "edge_color_by")
    apply_edge_kind_defaults(graph)
    apply_edge_label_fallbacks(graph)
    _apply_dag_ranks(graph)
    groups = graph.get("groups", [])
    tasks = graph.get("tasks", [])
    edges = graph.get("dependency_edges", [])
    group_tree = defaultdict(list)
    task_children = defaultdict(list)
    for group in groups:
        group_tree[group.get("parent_group_id")].append(group["id"])
    for task in tasks:
        task_children[task.get("group_id")].append(task["id"])
    model = {
        "graph_id": graph.get("id") or _generated_graph_id(graph),
        "title": graph.get("title", ""),
        "groups": groups,
        "tasks": tasks,
        "dependency_edges": edges,
        "group_tree": dict(group_tree),
        "task_children": dict(task_children),
        "document_order": [g["id"] for g in groups] + [t["id"] for t in tasks],
        "frozen": graph.get("frozen", {}),
        "color_by": graph.get("color_by", ""),
        "default_color_by": graph.get("default_color_by", ""),
        "filter_attributes": graph.get("filter_attributes", []),
        "filter_whitelist": graph.get("filter_whitelist", []),
        "filter_blacklist": graph.get("filter_blacklist", []),
        "hover_attrs": graph.get("hover_attrs", []),
        "color_palette": graph.get("color_palette", {}),
        "node_color_palettes": graph.get("node_color_palettes", {}),
        "color_palette_source": graph.get("color_palette_source", ""),
        "edge_color_by": graph.get("edge_color_by", ""),
        "edge_color_palette": graph.get("edge_color_palette", {}),
        "edge_color_palettes": graph.get("edge_color_palettes", {}),
        "edge_color_palette_source": graph.get("edge_color_palette_source", ""),
        "edge_kinds": graph.get("edge_kinds", {}),
        "edge_label_from": graph.get("edge_label_from", ""),
        "default_projection": graph.get("default_projection", ""),
        "base_view_label": graph.get("base_view_label", ""),
        "view_projections": graph.get("view_projections", []),
        "projection_models": {},
    }
    return attach_projection_models(model)


def parse_tasks_model(markdown_path: str | Path) -> dict:
    text = Path(markdown_path).read_text(encoding="utf-8")
    return parse_tasks_text(text, current_path=markdown_path)
