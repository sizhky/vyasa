from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
import json
import re
import shlex
import yaml

from vyasa.extensions_builtin.tasks.items_pack import read_kg_pack
from vyasa.extensions_builtin.tasks.model import parse_tasks_text


GENERATED_ATTRS = {"rank", "connectivity", "__rendered_attrs__", "source_graph"}
INLINE_ATTRS = {"summary", "description", "note", "notes", "rationale", "details"}


@dataclass(frozen=True)
class LedgerConversion:
    markdown_path: Path
    schema_path: Path
    nodes_path: Path
    edges_path: Path
    attrs_path: Path
    palette_path: Path
    cache_path: Path
    markdown_text: str
    schema_text: str
    nodes_text: str
    edges_text: str
    attrs_text: str
    palette_text: str
    cache_text: str


def convert_legacy_items_markdown(path: str | Path) -> LedgerConversion:
    markdown_path = Path(path)
    source = markdown_path.read_text(encoding="utf-8")
    match = _find_first_items_fence(source)
    fence_name, body = match.group("name"), match.group("body")
    model = parse_tasks_text(f"```{fence_name}\n{body}\n```", current_path=markdown_path)
    stem = markdown_path.with_suffix("")
    pack_dir = stem.with_suffix(".kg")
    schema_path = pack_dir / "kg.schema"
    nodes_path = pack_dir / "kg.nodes"
    edges_path = pack_dir / "kg.edges"
    attrs_path = pack_dir / "kg.attrs"
    palette_path = pack_dir / "kg.palette"
    cache_path = pack_dir / "kg.cache"
    frontmatter = _frontmatter_text(body)
    markdown_text = f"{source[:match.start()]}{_replacement_fence(fence_name, body, f'{pack_dir.name}/{schema_path.name}')}{source[match.end():]}"
    schema_text = _schema_text(model, nodes_path.name, edges_path.name, attrs_path.name, palette_path.name, cache_path.name)
    nodes_text, node_attrs, node_id_map = _nodes_text(model)
    edges_text, edge_attrs = _edges_text(model, node_id_map)
    attrs_text = _attrs_text(node_attrs, edge_attrs)
    palette_text = _palette_text(frontmatter, model)
    cache_text = _cache_text(schema_path, nodes_path.name, edges_path.name, attrs_path.name, palette_path.name, schema_text, nodes_text, edges_text, attrs_text, palette_text)
    return LedgerConversion(
        markdown_path=markdown_path.with_name(f"{markdown_path.stem}.ledger{markdown_path.suffix}"),
        schema_path=schema_path,
        nodes_path=nodes_path,
        edges_path=edges_path,
        attrs_path=attrs_path,
        palette_path=palette_path,
        cache_path=cache_path,
        markdown_text=markdown_text,
        schema_text=schema_text,
        nodes_text=nodes_text,
        edges_text=edges_text,
        attrs_text=attrs_text,
        palette_text=palette_text,
        cache_text=cache_text,
    )


def write_conversion(conversion: LedgerConversion, *, force: bool = False) -> None:
    for path, text in (
        (conversion.markdown_path, conversion.markdown_text),
        (conversion.schema_path, conversion.schema_text),
        (conversion.nodes_path, conversion.nodes_text),
        (conversion.edges_path, conversion.edges_text),
        (conversion.attrs_path, conversion.attrs_text),
        (conversion.palette_path, conversion.palette_text),
        (conversion.cache_path, conversion.cache_text),
    ):
        if path.exists() and not force:
            raise FileExistsError(f"{path} exists; pass --force to overwrite")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")


def _find_first_items_fence(source: str) -> re.Match:
    match = re.search(r"```(?P<name>items|tasks)\s*\n(?P<body>.*?)\n```", source, re.DOTALL)
    if not match:
        raise ValueError("No items/tasks fence found")
    return match


def _replacement_fence(fence_name: str, body: str, schema_name: str) -> str:
    frontmatter = _strip_generated_frontmatter(_frontmatter_text(body))
    injected = [f"items_schema: {schema_name}"]
    if frontmatter:
        return f"```{fence_name}\n---\n{frontmatter}\n" + "\n".join(injected) + "\n---\n```"
    return f"```{fence_name}\n---\n" + "\n".join(injected) + "\n---\n```"


def _schema_text(model: dict, nodes_name: str, edges_name: str, attrs_name: str, palette_name: str, cache_name: str) -> str:
    title = model.get("title") or "Knowledge Graph"
    initial_view = model.get("default_projection") or _first_view_id(model) or "overview"
    lines = [
        f"@graph id={_quote(model.get('persistence_id') or _slug(title))} title={_quote(title)} initial_view={_quote(initial_view)}",
        "",
        "@sources",
        "base:",
        f"\tnodes={_quote(nodes_name)}",
        f"\tedges={_quote(edges_name)}",
        f"\tattrs={_quote(attrs_name)}",
        f"palette={_quote(palette_name)}",
        f"cache={_quote(cache_name)}",
        "",
        "@relations",
    ]
    for relation in _relations(model):
        color = _relation_color(model, relation)
        lines.append(f"{_quote(relation)} color={_quote(color)}" if color else _quote(relation))
    lines.extend(["", "@views"])
    views = model.get("view_projections") or []
    if views:
        for view in views:
            lines.append(_view_line(view, initial_view))
    else:
        color_by = model.get("default_color_by") or model.get("color_by") or ""
        if color_by:
            lines.extend(["overview:", "\tsource=base", f"\tgroup_by,color_by={_quote(color_by)}", f"\tcaption={_quote('Understand the graph by ' + color_by)}"])
        else:
            lines.extend(["overview:", "\tsource=base", "\tcaption=\"Inspect the graph\""])
    return "\n".join(lines) + "\n"


def _nodes_text(model: dict) -> tuple[str, dict[str, dict[str, list[str]]], dict[str, str]]:
    group_labels = {group["id"]: group.get("label", group["id"]) for group in model.get("groups", [])}
    attr_index: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    node_id_map = {node["id"]: f"n{index}" for index, node in enumerate(model.get("tasks", []), start=1)}
    lines = []
    for node in model.get("tasks", []):
        node_id = node_id_map[node["id"]]
        inline = {}
        for key, value in node.items():
            if not _is_data_attr(key, value):
                continue
            if key in INLINE_ATTRS:
                inline[key] = str(value)
            else:
                attr_index[key][str(value)].append(node_id)
        if node.get("group_id") and node.get("group_id") in group_labels and "section" not in node:
            attr_index["section"][group_labels[node["group_id"]]].append(node_id)
        lines.append(f"{node_id}: {node.get('label', '')}")
        for key, value in inline.items():
            lines.append(f"\t{_safe_key(key)}={value}")
    return "\n".join(lines) + "\n", attr_index, node_id_map


def _edges_text(model: dict, node_id_map: dict[str, str]) -> tuple[str, dict[str, dict[str, list[str]]]]:
    attr_index: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    lines = []
    for index, edge in enumerate(model.get("dependency_edges", []), start=1):
        edge_id = edge.get("id") or f"e{index}"
        relation = str(edge.get("relation") or edge.get("label") or "relates").strip().replace(" ", "_")
        inline = {}
        for key, value in edge.items():
            if key in {"id", "source", "target", "label", "relation"} or not _is_data_attr(key, value):
                continue
            if key in INLINE_ATTRS:
                inline[key] = str(value)
            else:
                attr_index[key][str(value)].append(edge_id)
        suffix = " ".join(f"{_safe_key(key)}={_quote(value)}" for key, value in inline.items())
        source = node_id_map.get(edge.get("source", ""), edge.get("source", ""))
        target = node_id_map.get(edge.get("target", ""), edge.get("target", ""))
        lines.append(" ".join(part for part in [f"{edge_id}:", source, "->", target, relation, suffix] if part))
    return "\n".join(lines) + "\n", attr_index


def _attrs_text(node_attrs: dict[str, dict[str, list[str]]], edge_attrs: dict[str, dict[str, list[str]]]) -> str:
    lines = ["@node_attrs"]
    _append_attr_lines(lines, node_attrs)
    lines.append("")
    lines.append("@edge_attrs")
    _append_attr_lines(lines, edge_attrs)
    return "\n".join(lines).rstrip() + "\n"


def _append_attr_lines(lines: list[str], attrs: dict[str, dict[str, list[str]]]) -> None:
    for key in sorted(attrs):
        lines.append(f"{_safe_key(key)}:")
        for value in sorted(attrs[key]):
            ids = " ".join(dict.fromkeys(attrs[key][value]))
            lines.append(f"  {_quote_attr_value(value)}: {ids}")


def _palette_text(frontmatter: str, model: dict) -> str:
    payload = _raw_palette_payload(frontmatter)
    if not payload["node_color_palettes"] and not payload["edge_color_palettes"]:
        payload = {
            "node_color_palettes": model.get("node_color_palettes") or {},
            "edge_color_palettes": model.get("edge_color_palettes") or {},
        }
    return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def _cache_text(schema_path: Path, nodes_name: str, edges_name: str, attrs_name: str, palette_name: str, schema_text: str, nodes_text: str, edges_text: str, attrs_text: str, palette_text: str) -> str:
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        schema_tmp = tmp_path / schema_path.name
        schema_tmp.write_text(schema_text, encoding="utf-8")
        for name, text in ((nodes_name, nodes_text), (edges_name, edges_text), (attrs_name, attrs_text), (palette_name, palette_text)):
            (tmp_path / name).write_text(text, encoding="utf-8")
        graph = read_kg_pack(schema_tmp)
    payload = {
        "generated": True,
        "nodes": {node["id"]: node for node in graph.get("tasks", [])},
        "edges": {edge["id"]: edge for edge in graph.get("dependency_edges", [])},
        "views": graph.get("view_projections", []),
        "sources": graph.get("kg_sources", {}),
    }
    return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def _frontmatter_text(body: str) -> str:
    match = re.match(r"^\s*---\s*\n(?P<frontmatter>.*?)\n---\s*(?:\n|$)", body, re.DOTALL)
    return match.group("frontmatter").strip() if match else ""


def _strip_generated_frontmatter(frontmatter: str) -> str:
    if not frontmatter:
        return ""
    drop = {
        "color_by", "color_palette", "edge_color_palette", "color_palette_source",
        "edge_color_palette_source", "view_projections", "items_source",
        "edges_source", "items_dict", "items_schema", "default_projection",
    }
    return _strip_frontmatter_keys(frontmatter, drop)


def _strip_frontmatter_keys(frontmatter: str, drop: set[str]) -> str:
    lines = frontmatter.splitlines()
    kept: list[str] = []
    cursor = 0
    while cursor < len(lines):
        raw = lines[cursor]
        key_match = re.match(r"^(?P<indent>\s*)(?P<key>[^:#][^:]*):(?P<value>.*)$", raw)
        if not key_match or key_match.group("indent") or key_match.group("key").strip() not in drop:
            kept.append(raw)
            cursor += 1
            continue
        base_indent = len(raw) - len(raw.lstrip(" "))
        cursor += 1
        while cursor < len(lines):
            child = lines[cursor]
            if child.strip() and len(child) - len(child.lstrip(" ")) <= base_indent:
                break
            cursor += 1
    return "\n".join(line for line in kept if line.strip()).strip()


def _raw_palette_payload(frontmatter: str) -> dict:
    try:
        parsed = yaml.safe_load(frontmatter) or {}
    except Exception:
        parsed = {}
    if not isinstance(parsed, dict):
        parsed = {}
    node_palettes = {}
    color_by = parsed.get("color_by")
    if isinstance(color_by, dict):
        node_palettes.update(_dict_palettes(color_by))
    color_palette = parsed.get("color_palette")
    if isinstance(color_palette, dict):
        key = parsed.get("color_by") if isinstance(parsed.get("color_by"), str) else parsed.get("default_color_by")
        if key:
            node_palettes[str(key)] = _string_map(color_palette)
    edge_palettes = {}
    edge_palette = parsed.get("edge_color_palette")
    if isinstance(edge_palette, dict):
        edge_palettes.update(_dict_palettes(edge_palette))
    return {"node_color_palettes": node_palettes, "edge_color_palettes": edge_palettes}


def _dict_palettes(value: dict) -> dict:
    return {str(key): _string_map(palette) for key, palette in value.items() if isinstance(palette, dict) and _string_map(palette)}


def _string_map(value: dict) -> dict:
    return {str(key): str(color) for key, color in value.items() if isinstance(color, str)}


def _relations(model: dict) -> list[str]:
    relations = []
    for edge in model.get("dependency_edges", []):
        relations.append(str(edge.get("relation") or edge.get("label") or "relates").strip().replace(" ", "_"))
    return sorted(dict.fromkeys(relations))


def _relation_color(model: dict, relation: str) -> str:
    palettes = model.get("edge_color_palettes") or {}
    relation_palette = palettes.get("relation") if isinstance(palettes, dict) else {}
    return str((relation_palette or {}).get(relation, ""))


def _view_line(view: dict, initial_view: str) -> str:
    view_id = view.get("id") or initial_view
    parts = [f"{_safe_key(view_id)}:", "\tsource=base"]
    group_by = view.get("groups_from") or []
    if isinstance(group_by, str):
        group_by = [group_by]
    if group_by:
        value = group_by[0] if len(group_by) == 1 else "[" + ",".join(group_by) + "]"
        if view.get("default_color_by") == value:
            parts.append(f"\tgroup_by,color_by={_quote(value)}")
        else:
            parts.append(f"\tgroup_by={_quote(value)}")
    if view.get("default_color_by") and f"color_by={view.get('default_color_by')}" not in " ".join(parts):
        parts.append(f"\tcolor_by={_quote(view['default_color_by'])}")
    if view.get("edge_label_from"):
        parts.append(f"\tedge_label_from={_quote(view['edge_label_from'])}")
    if view.get("caption"):
        parts.append(f"\tcaption={_quote(view['caption'])}")
    return "\n".join(parts)


def _first_view_id(model: dict) -> str:
    views = model.get("view_projections") or []
    return str(views[0].get("id") or "") if views else ""


def _is_data_attr(key: str, value) -> bool:
    if key in {"id", "label", "parent_group_id", "group_id", "source", "target"} | GENERATED_ATTRS:
        return False
    return isinstance(value, (str, int, float, bool)) and str(value).strip() != ""


def _safe_key(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", str(value).strip()).strip("_") or "x"


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(value).lower()).strip("-") or "kg"


def _quote(value: str) -> str:
    text = str(value)
    return text if re.match(r"^[A-Za-z0-9_.:/#-]+$", text) else json.dumps(text)


def _quote_attr_value(value: str) -> str:
    text = str(value)
    return json.dumps(text) if ":" in text or "\n" in text else text
