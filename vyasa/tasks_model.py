from collections import defaultdict
from pathlib import Path
import json
import re
import secrets


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
            if key in {"id", "title", "default_color_by", "edge_color_by"}:
                config[key] = _read_string(value)
                cursor += 1
                continue
            if key == "filter_attributes":
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
                config["color_palettes"] = palettes
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
                config["color_palettes"] = {palette_key: palette} if palette_key else {}
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


def _parse_items_graph(body: str) -> dict:
    graph = {"groups": [], "tasks": [], "dependency_edges": [], "color_palettes": {}, "edge_color_palettes": {}}
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
            if key in {"id", "title", "default_color_by", "edge_color_by"}:
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
                graph["color_palettes"] = palettes
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
                graph["color_palettes"][graph.get("color_by") or palette_key or ""] = palette
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
            source_text = line[:edge_index].strip()
            label, target_text = _read_optional_edge_label(line[edge_index + 2:])
            target_refs, edge_attrs = _split_attrs(target_text)
            _add_edges(graph, source_text, target_refs, label, edge_attrs)
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


def parse_tasks_text(text: str) -> dict:
    config, body = _read_fence_frontmatter(_extract_tasks_body(text).strip())
    graph = _parse_items_graph(body)
    if config.get("id") and not graph.get("id"):
        graph["id"] = config["id"]
    if config.get("title") and not graph.get("title"):
        graph["title"] = config["title"]
    if "default_color_by" in config and "default_color_by" not in graph:
        graph["default_color_by"] = config["default_color_by"]
    if "filter_attributes" in config and "filter_attributes" not in graph:
        graph["filter_attributes"] = config["filter_attributes"]
    if config.get("color_by") and not graph.get("color_by"):
        graph["color_by"] = config["color_by"]
    if config.get("color_palette") and not graph.get("color_palette"):
        graph["color_palette"] = config["color_palette"]
    if config.get("color_palettes"):
        graph["color_palettes"] = {**config["color_palettes"], **graph.get("color_palettes", {})}
    if config.get("edge_color_by") and not graph.get("edge_color_by"):
        graph["edge_color_by"] = config["edge_color_by"]
    if config.get("edge_color_palette") and not graph.get("edge_color_palette"):
        graph["edge_color_palette"] = config["edge_color_palette"]
    if config.get("edge_color_palettes"):
        graph["edge_color_palettes"] = {**config["edge_color_palettes"], **graph.get("edge_color_palettes", {})}
    groups = graph.get("groups", [])
    tasks = graph.get("tasks", [])
    edges = graph.get("dependency_edges", [])
    group_tree = defaultdict(list)
    task_children = defaultdict(list)
    for group in groups:
        group_tree[group.get("parent_group_id")].append(group["id"])
    for task in tasks:
        task_children[task.get("group_id")].append(task["id"])
    return {
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
        "color_palette": graph.get("color_palette", {}),
        "color_palettes": graph.get("color_palettes", {}),
        "edge_color_by": graph.get("edge_color_by", ""),
        "edge_color_palette": graph.get("edge_color_palette", {}),
        "edge_color_palettes": graph.get("edge_color_palettes", {}),
    }


def parse_tasks_model(markdown_path: str | Path) -> dict:
    text = Path(markdown_path).read_text(encoding="utf-8")
    return parse_tasks_text(text)
