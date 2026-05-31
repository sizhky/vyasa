from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import json
import shlex
from typing import Any


@dataclass
class KgView:
    id: str
    source: str = "base"
    where: dict[str, str] = field(default_factory=dict)
    group_by: list[str] = field(default_factory=list)
    color_by: str = ""
    edge_color_by: str = ""
    edge_label_from: str = ""
    hover_attrs: list[str] | None = None
    aggregate_edges: dict[str, str | bool] = field(default_factory=dict)
    display: dict[str, str | bool] = field(default_factory=dict)
    caption: str = ""


@dataclass
class KgSchema:
    graph: dict[str, str] = field(default_factory=dict)
    sources: dict[str, dict[str, Any]] = field(default_factory=dict)
    relations: dict[str, dict[str, str]] = field(default_factory=dict)
    views: list[KgView] = field(default_factory=list)
    palette: str = ""
    cache: str = ""
    nodes: str = ""
    attrs: str = ""


def read_kg_pack(schema_path: str | Path) -> dict[str, Any]:
    schema_path = Path(schema_path)
    schema = read_schema(schema_path)
    graph = {
        "id": schema.graph.get("id", ""),
        "title": schema.graph.get("title", ""),
        "groups": [],
        "tasks": [],
        "dependency_edges": [],
        "view_projections": [_projection(view) for view in schema.views],
        "default_projection": schema.graph.get("initial_view", schema.views[0].id if schema.views else ""),
        "card_states": _list_value(schema.graph.get("card_states", "")),
    }
    nodes_by_id: dict[str, dict] = {}
    edges_by_id: dict[str, dict] = {}
    index_attributes: list[str] = []
    for source_name in _source_names_for_views(schema):
        source = _resolve_source(schema, source_name)
        for node_path in _path_list(source.get("nodes")):
            for node in read_nodes(_resolve(schema_path, node_path)):
                nodes_by_id[node["id"]] = {**nodes_by_id.get(node["id"], {}), **node}
        for edge_path in _path_list(source.get("edges")):
            for edge in read_edges(_resolve(schema_path, edge_path), schema.relations):
                edge["__kg_sources"] = _source_tags(edges_by_id.get(edge["id"], {}).get("__kg_sources"), source_name)
                edges_by_id[edge["id"]] = {**edges_by_id.get(edge["id"], {}), **edge}
        for attrs_path in _path_list(source.get("attrs")):
            indexed = apply_attrs(_resolve(schema_path, attrs_path), nodes_by_id, edges_by_id)
            for key in indexed.get("node", []):
                if key not in index_attributes:
                    index_attributes.append(key)
    graph["tasks"] = list(nodes_by_id.values())
    graph["dependency_edges"] = list(edges_by_id.values())
    if schema.palette:
        graph["color_palette_source"] = str(_resolve(schema_path, schema.palette))
    graph["kg_schema"] = str(schema_path)
    graph["kg_cache"] = schema.cache
    graph["kg_sources"] = schema.sources
    graph["index_attributes"] = index_attributes
    graph["filter_attributes"] = index_attributes
    return graph


def read_schema(path: str | Path) -> KgSchema:
    schema = KgSchema()
    section = ""
    current_source = ""
    current_source_attrs = False
    current_view: KgView | None = None
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        line = raw.strip()
        if line.startswith("@"):
            parts = shlex.split(line)
            section = parts[0]
            current_source = ""
            current_source_attrs = False
            current_view = None
            if section == "@graph":
                schema.graph.update(_assignments(parts[1:]))
            continue
        if raw.startswith((" ", "\t")):
            if section == "@sources" and current_source:
                if line == "attrs:":
                    current_source_attrs = True
                    schema.sources.setdefault(current_source, {}).setdefault("__attrs_filter", {})
                    continue
                if current_source_attrs and ":" in line and "=" not in line:
                    key, values = _source_attr_filter(line)
                    if key and values:
                        schema.sources.setdefault(current_source, {}).setdefault("__attrs_filter", {})[key] = values
                    continue
                current_source_attrs = False
                payload = _assignments(shlex.split(line))
                schema.sources.setdefault(current_source, {}).update(payload)
            elif section == "@views" and current_view:
                payload = _assignments(shlex.split(line))
                _update_view(current_view, payload)
            continue
        if section == "@sources":
            current_source = _read_source_line(schema, line)
            current_source_attrs = False
        elif section == "@relations":
            parts = shlex.split(line)
            if parts:
                schema.relations[parts[0]] = _assignments(parts[1:])
        elif section == "@views":
            current_view = _read_view(line)
            schema.views.append(current_view)
    if "base" not in schema.sources:
        schema.sources["base"] = {}
    return schema


def read_nodes(path: str | Path) -> list[dict[str, str]]:
    nodes = []
    current: dict[str, str] | None = None
    for raw in _record_raw_lines(path):
        if raw.startswith((" ", "\t")):
            if current is not None:
                key, value = _split_inline_assignment(raw.strip())
                if key:
                    current[key] = value
            continue
        line = raw.strip()
        if ":" in line and not line.split(":", 1)[0].strip().endswith(("http", "https")):
            node_id, label = line.split(":", 1)
            current = {"id": node_id.strip(), "label": label.strip(), "group_id": None}
            nodes.append(current)
            continue
        parts = shlex.split(line)
        if len(parts) >= 2:
            current = {"id": parts[0], "label": parts[1], "group_id": None}
            current.update(_assignments(parts[2:]))
            nodes.append(current)
    return nodes


def read_edges(path: str | Path, relations: dict[str, dict[str, str]] | None = None) -> list[dict[str, str]]:
    edges = []
    known_relations = set((relations or {}).keys())
    for line in _record_lines(path):
        head, rest = line.split(":", 1)
        parts = shlex.split(rest)
        if len(parts) < 4 or parts[1] != "->":
            continue
        relation = parts[3]
        attrs = _assignments(parts[4:])
        edge = {"id": head.strip(), "source": parts[0], "target": parts[2], "relation": relation, **attrs}
        if relation in known_relations:
            for key, value in (relations or {}).get(relation, {}).items():
                edge.setdefault(key, value)
        edge.setdefault("label", relation)
        edges.append(edge)
    return edges


def apply_attrs(path: str | Path, nodes: dict[str, dict], edges: dict[str, dict]) -> dict[str, list[str]]:
    section = ""
    current_key = ""
    target = nodes
    indexed = {"node": [], "edge": []}
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        line = raw.rstrip()
        stripped = line.strip()
        if stripped in {"@node_attrs", "@edge_attrs"}:
            section = stripped
            target = nodes if section == "@node_attrs" else edges
            current_key = ""
            continue
        if not section:
            continue
        if not line.startswith(" ") and stripped.endswith(":"):
            current_key = stripped[:-1].strip()
            index_key = "node" if section == "@node_attrs" else "edge"
            if current_key and current_key not in indexed[index_key]:
                indexed[index_key].append(current_key)
            continue
        if current_key and line.startswith(" ") and ":" in stripped:
            value, ids_text = stripped.split(":", 1)
            for record_id in shlex.split(ids_text):
                if record_id in target:
                    target[record_id][current_key] = value.strip()
    return indexed


def read_palette(path: str | Path) -> dict[str, Any]:
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def _read_source_line(schema: KgSchema, line: str) -> str:
    if ":" in line:
        name, values = line.split(":", 1)
        schema.sources[name.strip()] = _assignments(shlex.split(values))
        return name.strip()
    payload = _assignments(shlex.split(line))
    schema.palette = payload.get("palette", schema.palette)
    schema.cache = payload.get("cache", schema.cache)
    schema.nodes = payload.get("nodes", schema.nodes)
    schema.attrs = payload.get("attrs", schema.attrs)
    return ""


def _read_view(line: str) -> KgView:
    parts = shlex.split(line)
    view_id = parts[0].rstrip(":")
    payload = _assignments(parts[1:])
    view = KgView(id=view_id)
    _update_view(view, payload)
    return view


def _update_view(view: KgView, payload: dict[str, str]) -> None:
    group_by = _list_value(payload.get("group_by", ""))
    consumed = {"source", "where", "group_by", "color_by", "edge_color_by", "edge_label_from", "hover_attrs", "aggregate_edges", "caption"}
    if "source" in payload:
        view.source = payload["source"]
    if "where" in payload:
        view.where.update(_where_value(payload["where"]))
    if group_by:
        view.group_by = group_by
    if "color_by" in payload:
        view.color_by = payload["color_by"]
    if "edge_color_by" in payload:
        view.edge_color_by = payload["edge_color_by"]
    if "edge_label_from" in payload:
        view.edge_label_from = payload["edge_label_from"]
    if "hover_attrs" in payload:
        view.hover_attrs = _list_value(payload["hover_attrs"])
    if "aggregate_edges" in payload:
        view.aggregate_edges = _aggregate_edges_value(payload["aggregate_edges"])
    if "caption" in payload:
        view.caption = payload["caption"]
    for key, value in payload.items():
        if key not in consumed:
            view.display[key] = _typed_scalar(value)


def _projection(view: KgView) -> dict[str, Any]:
    projection = {
        "id": view.id,
        "label": view.id.replace("_", " ").replace("-", " ").title(),
        "source": view.source,
        "groups_from": view.group_by,
        "default_color_by": view.color_by,
        "where": view.where,
        "edge_color_by": view.edge_color_by,
        "edge_label_from": view.edge_label_from,
        "hover_attrs": view.hover_attrs,
        "aggregate_edges": view.aggregate_edges,
        **view.display,
        "caption": view.caption,
    }
    return {key: value for key, value in projection.items() if value not in ("", [], ())}


def _assignments(parts: list[str]) -> dict[str, str]:
    payload: dict[str, str] = {}
    for part in parts:
        if "=" not in part:
            continue
        keys, value = part.split("=", 1)
        for key in keys.split(","):
            payload[key.strip()] = value.strip()
    return payload


def _split_inline_assignment(text: str) -> tuple[str, str]:
    if "=" not in text:
        return "", ""
    key, value = text.split("=", 1)
    return key.strip(), value.strip()


def _resolve_source(schema: KgSchema, name: str) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    if schema.nodes:
        merged["nodes"] = schema.nodes
    if schema.attrs:
        merged["attrs"] = schema.attrs
    for fragment in str(name or "base").split("+"):
        for key, value in schema.sources.get(fragment, {}).items():
            if key == "__attrs_filter":
                filters = merged.setdefault("__attrs_filter", {})
                for attr, values in value.items():
                    filters.setdefault(attr, [])
                    filters[attr].extend(item for item in values if item not in filters[attr])
                continue
            if key in merged and value:
                merged[key] = f"{merged[key]}+{value}"
            elif value:
                merged[key] = value
    return merged


def _source_names_for_views(schema: KgSchema) -> list[str]:
    names = [view.source for view in schema.views] or ["base"]
    return list(dict.fromkeys(names))


def _path_list(value: str | None) -> list[str]:
    return [part for part in str(value or "").split("+") if part]


def _source_attr_filter(line: str) -> tuple[str, list[str]]:
    key, raw_values = line.split(":", 1)
    text = raw_values.strip()
    if text.startswith("[") and text.endswith("]"):
        text = text[1:-1]
    if "," in text:
        values = [part.strip().strip("\"'") for part in text.split(",") if part.strip()]
    else:
        values = [part.strip().strip("\"'") for part in shlex.split(text) if part.strip()]
    return key.strip(), values


def _list_value(value: str) -> list[str]:
    text = str(value or "").strip()
    if text.startswith("[") and text.endswith("]"):
        return [part.strip() for part in text[1:-1].split(",") if part.strip()]
    if "," in text:
        return [part.strip() for part in text.split(",") if part.strip()]
    return [text] if text else []


def _aggregate_edges_value(value: str) -> dict[str, str | bool]:
    out: dict[str, str | bool] = {}
    for part in str(value or "").replace(",", " ").split():
        if "=" not in part:
            continue
        key, raw_value = part.split("=", 1)
        text = raw_value.strip().lower()
        out[key.strip()] = text in {"1", "true", "yes", "on"} if text in {"1", "true", "yes", "on", "0", "false", "no", "off"} else raw_value.strip()
    return {key: value for key, value in out.items() if key}


def _typed_scalar(value: str) -> str | bool:
    text = str(value or "").strip()
    lowered = text.lower()
    if lowered in {"1", "true", "yes", "on"}:
        return True
    if lowered in {"0", "false", "no", "off"}:
        return False
    return text


def _where_value(value: str) -> dict[str, str]:
    text = str(value or "").strip()
    if not text:
        return {}
    sep = "=" if "=" in text else ":"
    if sep not in text:
        return {}
    key, raw_value = text.split(sep, 1)
    key = key.strip()
    raw_value = raw_value.strip()
    return {key: raw_value} if key and raw_value else {}


def _source_tags(existing, source_name: str) -> list[str]:
    tags = list(existing or [])
    for tag in str(source_name or "base").split("+"):
        if tag and tag not in tags:
            tags.append(tag)
    return tags


def _resolve(schema_path: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else (schema_path.parent / path).resolve()


def _record_lines(path: str | Path):
    for line in _record_raw_lines(path):
        yield line.strip()


def _record_raw_lines(path: str | Path):
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if raw.strip().startswith("@"):
            continue
        yield raw


def _lines(path: str | Path):
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#"):
            yield line
