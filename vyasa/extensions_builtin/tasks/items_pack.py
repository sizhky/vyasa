from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import json
import shlex
import re
import textwrap
from typing import Any

NODE_ID_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*$")


def _as_pathlike(p):
    """Keep a ref-backed VirtualPath (or any read_text-capable path-like) as-is;
    wrap only plain strings into a filesystem Path. Coercing to Path() would strip
    the git ref and silently fall back to the working tree."""
    return p if hasattr(p, "read_text") else Path(p)


@dataclass
class KgView:
    id: str
    source: str = "base"
    where: dict[str, str] = field(default_factory=dict)
    group_by: list[str] = field(default_factory=list)
    color_by: str = ""
    secondary_color_by: str = ""
    edge_color_by: str = ""
    edge_label_from: str = ""
    hover_attrs: list[str] | None = None
    aggregate_edges: dict[str, str | bool] = field(default_factory=dict)
    filter_query: dict[str, Any] = field(default_factory=dict)
    query_builder_enabled: bool | None = None
    search: str = ""
    filters_collapsed: bool | None = None
    edges_visible: bool | None = None
    edge_animation_enabled: bool | None = None
    edge_animation_mode: str = ""
    edge_animation_tick_steps: str = ""
    edge_animation_tick_duration: str = ""
    edge_opacity: str = ""
    projection_unspecified_content_opacity: str = ""
    display: dict[str, str | bool] = field(default_factory=dict)
    caption: str = ""


@dataclass
class KgSchema:
    graph: dict[str, str] = field(default_factory=dict)
    sources: dict[str, dict[str, Any]] = field(default_factory=dict)
    relations: dict[str, dict[str, str]] = field(default_factory=dict)
    views: list[KgView] = field(default_factory=list)
    slides: list[dict[str, Any]] = field(default_factory=list)
    status_defaults: dict[str, str] = field(default_factory=dict)
    palette: str = ""
    cache: str = ""
    nodes: str = ""
    attrs: str = ""


@dataclass
class KgContext:
    id: str
    seq: int
    label: str = ""
    caption: str = ""
    attrs_path: str = ""
    palette: str = ""
    node_attrs: dict[str, dict[str, list[str]]] = field(default_factory=dict)
    edges: list[dict[str, str]] = field(default_factory=list)
    slides: list[dict[str, Any]] = field(default_factory=list)


def read_kg_pack(schema_path: str | Path, context_id: str = "") -> dict[str, Any]:
    schema_path = _as_pathlike(schema_path)
    schema = read_schema(schema_path)
    if schema.graph.get("contexts"):
        return _read_context_kg_pack(schema_path, schema, context_id)
    graph = {
        "id": schema.graph.get("id", ""),
        "title": schema.graph.get("title", ""),
        "groups": [],
        "tasks": [],
        "dependency_edges": [],
        "view_projections": [_projection(view) for view in schema.views],
        "slides": schema.slides,
        "default_projection": schema.graph.get("initial_view", schema.views[0].id if schema.views else ""),
        "hover_attrs": _list_value(schema.graph.get("hover_attrs", "")),
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
    _propagate_inherited_attrs(nodes_by_id)
    groups = []
    tasks = []
    for node in nodes_by_id.values():
        clean = {key: value for key, value in node.items() if key not in {"__is_group__", "__inherit_keys__"}}
        if node.get("__is_group__"):
            clean["parent_group_id"] = clean.pop("group_id", None)
            groups.append(clean)
        else:
            tasks.append(clean)
    graph["groups"] = groups
    graph["tasks"] = tasks
    graph["dependency_edges"] = list(edges_by_id.values())
    if schema.palette:
        graph["color_palette_source"] = str(_resolve(schema_path, schema.palette))
    graph["kg_schema"] = str(schema_path)
    graph["kg_cache"] = schema.cache
    graph["kg_sources"] = schema.sources
    graph["index_attributes"] = index_attributes
    graph["filter_attributes"] = index_attributes
    _write_kg_cache(schema_path, schema.cache, graph)
    return graph


def _read_context_kg_pack(schema_path: Path, schema: KgSchema, context_id: str = "") -> dict[str, Any]:
    contexts = _discover_contexts(schema_path, schema.graph.get("contexts", ""))
    active = _default_context(contexts, context_id or schema.graph.get("default_context", "latest"))
    nodes_by_id = {node["id"]: node for node in read_nodes(_resolve(schema_path, schema.nodes))}
    edges_by_id = {edge["id"]: edge for edge in active.edges}
    index_attributes: list[str] = []
    if schema.attrs:
        indexed = apply_attrs(_resolve(schema_path, schema.attrs), nodes_by_id, edges_by_id)
        index_attributes.extend(indexed.get("node", []))
    _apply_context_attrs(active, nodes_by_id)
    _apply_status_defaults(schema, nodes_by_id, active.edges)
    present = {node_id for edge in active.edges for node_id in (edge.get("source"), edge.get("target")) if node_id}
    graph = {
        "id": schema.graph.get("id", ""),
        "title": schema.graph.get("title", ""),
        "groups": [],
        "tasks": [node for node_id, node in nodes_by_id.items() if node_id in present],
        "dependency_edges": active.edges,
        "view_projections": [_projection(view) for view in schema.views],
        "slides": active.slides or schema.slides,
        "default_projection": schema.graph.get("initial_view", schema.views[0].id if schema.views else ""),
        "hover_attrs": _list_value(schema.graph.get("hover_attrs", "")),
        "card_states": _list_value(schema.graph.get("card_states", "")),
        "kg_context": {"id": active.id, "seq": active.seq, "label": active.label, "caption": active.caption},
        "kg_contexts": [{"id": item.id, "seq": item.seq, "label": item.label, "caption": item.caption} for item in contexts],
    }
    if active.palette or schema.palette:
        graph["color_palette_source"] = str(_resolve(schema_path, active.palette or schema.palette))
    graph["kg_schema"] = str(schema_path)
    graph["kg_sources"] = {"base": {"context": active.id}}
    graph["index_attributes"] = list(dict.fromkeys(index_attributes + list(active.node_attrs.keys()) + ["status"]))
    graph["filter_attributes"] = graph["index_attributes"]
    return graph


def _discover_contexts(schema_path: Path, pattern: str) -> list[KgContext]:
    contexts = [_read_context(path) for path in sorted(schema_path.parent.glob(pattern))]
    return sorted((item for item in contexts if item.id), key=lambda item: item.seq)


def _default_context(contexts: list[KgContext], default_id: str) -> KgContext:
    if not contexts:
        raise ValueError("KG context schema has no contexts")
    if default_id == "latest":
        return max(contexts, key=lambda item: item.seq)
    return next((item for item in contexts if item.id == default_id), contexts[0])


def _read_context(path: Path) -> KgContext:
    context = KgContext(id="", seq=0)
    section = ""
    current_slide: dict[str, Any] | None = None
    raw_lines = path.read_text(encoding="utf-8").splitlines()
    index = 0
    while index < len(raw_lines):
        raw = raw_lines[index]
        index += 1
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        line = raw.strip()
        if line.startswith("@context"):
            payload = _assignments(shlex.split(line)[1:])
            context.id = payload.get("id", "")
            context.seq = int(payload.get("seq", "0") or 0)
            context.label = payload.get("label", "")
            section = "@context"
            continue
        if line.startswith("@"):
            section = line
            current_slide = None
            continue
        if raw.startswith((" ", "\t")):
            if section == "@slides" and current_slide is not None:
                index += _read_slide_attr(raw_lines, index - 1, current_slide)
                continue
        if section == "@context":
            payload = _assignments(shlex.split(line))
            if payload.get("caption") == "|":
                context.caption, count = _read_indented_multiline(raw_lines, index, _indent_width(raw))
                index += count
            elif "caption" in payload:
                context.caption = payload["caption"]
            context.palette = payload.get("palette", context.palette)
        elif section == "@attrs":
            _read_context_attr_line(context, raw)
        elif section == "@edges":
            edge = _read_context_edge(line, context.id, len(context.edges) + 1)
            if edge:
                context.edges.append(edge)
        elif section == "@slides":
            sid, _, title = line.partition(":")
            current_slide = {"id": sid.strip(), "title": title.strip(), "nodes": []}
            context.slides.append(current_slide)
    return context


def _read_slide_attr(raw_lines: list[str], raw_index: int, slide: dict[str, Any]) -> int:
    raw = raw_lines[raw_index]
    slide_indent = _indent_width(raw)
    payload = _view_assignment(raw.strip())
    consumed = 0
    for key, value in payload.items():
        if value == "|":
            value, consumed = _read_indented_multiline(raw_lines, raw_index + 1, slide_indent)
        slide[key] = _list_value(value) if key == "nodes" else value
    return consumed


def _read_context_attr_line(context: KgContext, raw: str) -> None:
    stripped = raw.strip()
    if not raw.startswith((" ", "\t")) and stripped.endswith(":"):
        context.attrs_path = stripped[:-1].strip()
        context.node_attrs.setdefault(context.attrs_path, {})
        return
    if not context.attrs_path or ":" not in stripped:
        return
    value, ids_text = stripped.split(":", 1)
    bucket = context.node_attrs.setdefault(context.attrs_path, {})
    bucket.setdefault(value.strip(), []).extend(shlex.split(ids_text))


def _read_context_edge(line: str, context_id: str, index: int) -> dict[str, str] | None:
    parts = shlex.split(line)
    if len(parts) < 3 or parts[1] != "->":
        return None
    relation = parts[3] if len(parts) > 3 and "=" not in parts[3] else ""
    attr_parts = parts[4:] if relation else parts[3:]
    edge = {
        "id": f"{context_id}-e{index}",
        "source": parts[0],
        "target": parts[2],
        **_assignments(attr_parts),
        "__kg_sources": [context_id],
    }
    if relation:
        edge["relation"] = relation
        edge.setdefault("label", relation)
    return edge


def _apply_context_attrs(context: KgContext, nodes_by_id: dict[str, dict]) -> None:
    for key, values in context.node_attrs.items():
        for value, node_ids in values.items():
            for node_id in node_ids:
                if node_id in nodes_by_id:
                    nodes_by_id[node_id][key] = value


def _apply_status_defaults(schema: KgSchema, nodes_by_id: dict[str, dict], edges: list[dict]) -> None:
    present = {node_id for edge in edges for node_id in (edge.get("source"), edge.get("target")) if node_id}
    for node_id in present:
        node = nodes_by_id.get(node_id)
        if node and not node.get("status"):
            node["status"] = schema.status_defaults.get(str(node.get("kind") or ""), "")


def _write_kg_cache(schema_path: Path, cache_name: str, graph: dict[str, Any]) -> None:
    cache_name = str(cache_name or "").strip()
    if not cache_name:
        return
    cache_path = _resolve(schema_path, cache_name)
    if not isinstance(cache_path, Path):
        return  # ref-served from a read-only object store: nothing to cache to disk
    payload = {
        "generated": True,
        "nodes": {node["id"]: node for node in graph.get("tasks", [])},
        "edges": {edge["id"]: edge for edge in graph.get("dependency_edges", [])},
        "views": graph.get("view_projections", []),
        "sources": graph.get("kg_sources", {}),
    }
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def read_schema(path: str | Path) -> KgSchema:
    path = _as_pathlike(path)
    schema = KgSchema()
    section = ""
    current_source = ""
    current_source_attrs = False
    current_view: KgView | None = None
    current_slide: dict[str, Any] | None = None
    raw_lines = path.read_text(encoding="utf-8").splitlines()
    raw_index = 0
    while raw_index < len(raw_lines):
        raw = raw_lines[raw_index]
        raw_index += 1
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        line = raw.strip()
        if line.startswith("@"):
            parts = shlex.split(line)
            section = parts[0]
            current_source = ""
            current_source_attrs = False
            current_view = None
            current_slide = None
            if section == "@graph":
                payload = _assignments(parts[1:])
                schema.graph.update(payload)
                schema.nodes = payload.get("pool", schema.nodes)
                schema.attrs = payload.get("attrs", schema.attrs)
                schema.palette = payload.get("palette", schema.palette)
            continue
        if section == "@graph":
            payload = _assignments(shlex.split(line))
            schema.graph.update(payload)
            schema.nodes = payload.get("pool", schema.nodes)
            schema.attrs = payload.get("attrs", schema.attrs)
            schema.palette = payload.get("palette", schema.palette)
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
                payload = _view_assignment(line)
                _update_view(current_view, payload)
            elif section == "@slides" and current_slide is not None:
                raw_index += _read_slide_attr(raw_lines, raw_index - 1, current_slide)
            continue
        if section == "@sources":
            current_source = _read_source_line(schema, line)
            current_source_attrs = False
        elif section == "@relations":
            parts = shlex.split(line)
            if parts:
                schema.relations[parts[0]] = _assignments(parts[1:])
        elif section == "@status_defaults":
            payload = _assignments(shlex.split(line))
            schema.status_defaults.update(payload)
        elif section == "@views":
            current_view = _read_view(line)
            schema.views.append(current_view)
        elif section == "@slides":
            sid, _, title = line.partition(":")
            current_slide = {"id": sid.strip(), "title": title.strip(), "nodes": []}
            schema.slides.append(current_slide)
    _read_tmp_view_sidecars(schema, path)
    if "base" not in schema.sources:
        schema.sources["base"] = {}
    return schema


def _read_tmp_view_sidecars(schema: KgSchema, schema_path: Path) -> None:
    view_dir = _tmp_view_sidecar_dir(schema_path)
    if not view_dir.is_dir():
        return
    existing = {view.id: index for index, view in enumerate(schema.views)}
    for view_path in sorted(view_dir.glob("tmp.*.view")):
        current_view: KgView | None = None
        for raw in view_path.read_text(encoding="utf-8").splitlines():
            if not raw.strip() or raw.lstrip().startswith("#"):
                continue
            line = raw.strip()
            if raw.startswith((" ", "\t")):
                if current_view:
                    _update_view(current_view, _view_assignment(line))
                continue
            current_view = _read_view(line)
            if current_view.id in existing:
                schema.views[existing[current_view.id]] = current_view
            else:
                existing[current_view.id] = len(schema.views)
                schema.views.append(current_view)


def _tmp_view_sidecar_dir(schema_path: Path) -> Path:
    return schema_path.parent if schema_path.name == "kg.schema" else schema_path.with_suffix("")


def read_nodes(path: str | Path) -> list[dict[str, str]]:
    nodes_by_id: dict[str, dict[str, Any]] = {}
    stack: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    raw_lines = _as_pathlike(path).read_text(encoding="utf-8").splitlines()
    line_index = 0
    while line_index < len(raw_lines):
        raw = raw_lines[line_index]
        line_index += 1
        if not raw.strip() or raw.lstrip().startswith(("#", "@")):
            continue
        indent = _indent_width(raw)
        line = raw.strip()
        if _looks_like_node_line(line):
            while stack and stack[-1]["indent"] >= indent:
                stack.pop()
            parent = stack[-1]["node"] if stack else None
            node = _read_node_line(line, path)
            if parent is not None:
                parent["__is_group__"] = True
                node["group_id"] = parent["id"]
                _apply_inherited_attrs(parent, node)
            existing = nodes_by_id.get(node["id"])
            if existing is not None:
                _merge_node(existing, node, path)
                node = existing
            else:
                nodes_by_id[node["id"]] = node
            stack.append({"indent": indent, "node": node})
            current = node
            continue
        if "=" in line:
            if current is None:
                continue
            key, value = _split_inline_assignment(line)
            if not key:
                continue
            if value == "|":
                value, skip_count = _read_indented_multiline(raw_lines, line_index, indent)
                line_index += skip_count
            current[key] = value
            if key == "inherit":
                current["__inherit_keys__"] = _list_value(value)
            continue
        if ":" in line:
            raise ValueError(f"{path}: invalid node line {line!r}; node children must use '<id>: <label>' with a valid id")
    return list(nodes_by_id.values())


def _read_indented_multiline(raw_lines: list[str], start_index: int, parent_indent: int) -> tuple[str, int]:
    block_lines = []
    line_index = start_index
    while line_index < len(raw_lines):
        block_line = raw_lines[line_index]
        if block_line.strip() and _indent_width(block_line) <= parent_indent:
            break
        block_lines.append(block_line)
        line_index += 1
    return textwrap.dedent("\n".join(block_lines)).strip("\n"), line_index - start_index


def read_edges(path: str | Path, relations: dict[str, dict[str, str]] | None = None) -> list[dict[str, str]]:
    edges = []
    known_relations = set((relations or {}).keys())
    for line in _record_lines(path):
        head, rest = line.split(":", 1)
        parts = shlex.split(rest)
        if len(parts) < 3 or parts[1] != "->":
            continue
        relation = ""
        attr_parts = parts[3:]
        if len(parts) >= 4 and "=" not in parts[3]:
            relation = parts[3]
            attr_parts = parts[4:]
        attrs = _assignments(attr_parts)
        edge = {"id": head.strip(), "source": parts[0], "target": parts[2], **attrs}
        if relation:
            edge["relation"] = relation
        if relation in known_relations:
            for key, value in (relations or {}).get(relation, {}).items():
                edge.setdefault(key, value)
        if relation:
            edge.setdefault("label", relation)
        edges.append(edge)
    return edges


def apply_attrs(path: str | Path, nodes: dict[str, dict], edges: dict[str, dict]) -> dict[str, list[str]]:
    section = ""
    current_key = ""
    target = nodes
    indexed = {"node": [], "edge": []}
    for raw in _as_pathlike(path).read_text(encoding="utf-8").splitlines():
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
        if not line.startswith((" ", "\t")) and stripped.endswith(":"):
            current_key = stripped[:-1].strip()
            index_key = "node" if section == "@node_attrs" else "edge"
            if current_key and current_key not in indexed[index_key]:
                indexed[index_key].append(current_key)
            continue
        if current_key and line.startswith((" ", "\t")) and ":" in stripped:
            value, ids_text = stripped.split(":", 1)
            for record_id in shlex.split(ids_text):
                if record_id in target:
                    attr_value = value.strip()
                    existing = target[record_id].get(current_key)
                    if existing is None:
                        target[record_id][current_key] = attr_value
                    elif isinstance(existing, list):
                        if attr_value not in existing:
                            existing.append(attr_value)
                    elif existing != attr_value:
                        target[record_id][current_key] = [existing, attr_value]
                    if section == "@node_attrs" and current_key == "inherit":
                        target[record_id]["__inherit_keys__"] = _list_value(value.strip())
    return indexed


def read_palette(path: str | Path) -> dict[str, Any]:
    try:
        payload = json.loads(_as_pathlike(path).read_text(encoding="utf-8"))
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
    consumed = {
        "source", "where", "filter", "group_by", "color_by", "secondary_color_by",
        "edge_color_by", "edge_label_from", "hover_attrs", "aggregate_edges",
        "filter_query", "query_builder_enabled", "search", "filters_collapsed",
        "edges_visible", "edge_animation_enabled", "edge_animation_mode",
        "edge_animation_tick_steps", "edge_animation_tick_duration", "edge_opacity",
        "projection_unspecified_content_opacity", "caption",
    }
    if "source" in payload:
        view.source = payload["source"]
    if "where" in payload:
        view.where.update(_where_value(payload["where"]))
    if "filter" in payload:
        view.where.update(_where_value(payload["filter"]))
    if group_by:
        view.group_by = group_by
    if "color_by" in payload:
        view.color_by = payload["color_by"]
    if "secondary_color_by" in payload:
        view.secondary_color_by = payload["secondary_color_by"]
    if "edge_color_by" in payload:
        view.edge_color_by = payload["edge_color_by"]
    if "edge_label_from" in payload:
        view.edge_label_from = payload["edge_label_from"]
    if "hover_attrs" in payload:
        view.hover_attrs = _list_value(payload["hover_attrs"])
    if "aggregate_edges" in payload:
        view.aggregate_edges = _aggregate_edges_value(payload["aggregate_edges"])
    if "filter_query" in payload:
        view.filter_query = _json_object_value(payload["filter_query"])
    if "query_builder_enabled" in payload:
        value = _typed_scalar(payload["query_builder_enabled"])
        view.query_builder_enabled = value if isinstance(value, bool) else None
    if "search" in payload:
        view.search = payload["search"]
    if "filters_collapsed" in payload:
        value = _typed_scalar(payload["filters_collapsed"])
        view.filters_collapsed = value if isinstance(value, bool) else None
    if "edges_visible" in payload:
        value = _typed_scalar(payload["edges_visible"])
        view.edges_visible = value if isinstance(value, bool) else None
    if "edge_animation_enabled" in payload:
        value = _typed_scalar(payload["edge_animation_enabled"])
        view.edge_animation_enabled = value if isinstance(value, bool) else None
    if "edge_animation_mode" in payload:
        view.edge_animation_mode = payload["edge_animation_mode"]
    if "edge_animation_tick_steps" in payload:
        view.edge_animation_tick_steps = payload["edge_animation_tick_steps"]
    if "edge_animation_tick_duration" in payload:
        view.edge_animation_tick_duration = payload["edge_animation_tick_duration"]
    if "edge_opacity" in payload:
        view.edge_opacity = payload["edge_opacity"]
    if "projection_unspecified_content_opacity" in payload:
        view.projection_unspecified_content_opacity = payload["projection_unspecified_content_opacity"]
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
        "default_secondary_color_by": view.secondary_color_by,
        "where": view.where,
        "edge_color_by": view.edge_color_by,
        "edge_label_from": view.edge_label_from,
        "hover_attrs": view.hover_attrs,
        "aggregate_edges": view.aggregate_edges,
        "filter_query": view.filter_query,
        "query_builder_enabled": view.query_builder_enabled,
        "search": view.search,
        "filters_collapsed": view.filters_collapsed,
        "edges_visible": view.edges_visible,
        "edge_animation_enabled": view.edge_animation_enabled,
        "edge_animation_mode": view.edge_animation_mode,
        "edge_animation_tick_steps": view.edge_animation_tick_steps,
        "edge_animation_tick_duration": view.edge_animation_tick_duration,
        "edge_opacity": view.edge_opacity,
        "projection_unspecified_content_opacity": view.projection_unspecified_content_opacity,
        **view.display,
        "caption": view.caption,
    }
    return {key: value for key, value in projection.items() if value not in ("", [], (), None)}


def _assignments(parts: list[str]) -> dict[str, str]:
    payload: dict[str, str] = {}
    for part in parts:
        if "=" not in part:
            continue
        keys, value = part.split("=", 1)
        for key in keys.split(","):
            payload[key.strip()] = value.strip()
    return payload


def _view_assignment(line: str) -> dict[str, str]:
    if "=" not in line:
        return {}
    keys, raw_value = line.split("=", 1)
    value = raw_value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        value = value[1:-1]
    value = value.replace('\\"', '"').replace("\\'", "'").replace("\\\\", "\\")
    return {key.strip(): value for key in keys.split(",") if key.strip()}


def _split_inline_assignment(text: str) -> tuple[str, str]:
    if "=" not in text:
        return "", ""
    key, value = text.split("=", 1)
    return key.strip(), value.strip()


def _indent_width(raw: str) -> int:
    return len(raw) - len(raw.lstrip(" \t"))


def _looks_like_node_line(line: str) -> bool:
    if ":" not in line:
        return False
    node_id, _label = line.split(":", 1)
    return bool(NODE_ID_RE.fullmatch(node_id.strip()))


def _read_node_line(line: str, path: str | Path) -> dict[str, Any]:
    node_id, label = line.split(":", 1)
    node_id = node_id.strip()
    if not NODE_ID_RE.fullmatch(node_id):
        raise ValueError(f"{path}: invalid node id {node_id!r}")
    return {"id": node_id, "label": label.strip(), "group_id": None}


def _apply_inherited_attrs(parent: dict[str, Any], child: dict[str, Any]) -> None:
    inherit_keys = parent.get("__inherit_keys__") or []
    if inherit_keys:
        child.setdefault("__inherit_keys__", list(inherit_keys))
    for key in inherit_keys:
        if key in parent and key not in child:
            child[key] = parent[key]


def _propagate_inherited_attrs(nodes_by_id: dict[str, dict[str, Any]]) -> None:
    children_by_parent: dict[str | None, list[str]] = {}
    for node in nodes_by_id.values():
        children_by_parent.setdefault(node.get("group_id"), []).append(node["id"])

    def visit(node_id: str) -> None:
        parent = nodes_by_id[node_id]
        for child_id in children_by_parent.get(node_id, []):
            child = nodes_by_id[child_id]
            _apply_inherited_attrs(parent, child)
            visit(child_id)

    for root_id in children_by_parent.get(None, []):
        visit(root_id)


def _merge_node(existing: dict[str, Any], node: dict[str, Any], path: str | Path) -> None:
    if existing.get("label") and node.get("label") and existing["label"] != node["label"]:
        raise ValueError(f"{path}: duplicate node id {node['id']!r} has conflicting labels")
    for key, value in node.items():
        if key in existing and existing[key] not in (value, None, "") and value not in (None, ""):
            if key in {"group_id", "parent_group_id"}:
                raise ValueError(f"{path}: duplicate node id {node['id']!r} has multiple parents")
            continue
        if value not in (None, ""):
            existing[key] = value


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


def _json_object_value(value: str) -> dict[str, Any]:
    try:
        parsed = json.loads(str(value or "").strip())
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


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
    value = str(value)
    if isinstance(schema_path, Path):
        path = Path(value)
        return path if path.is_absolute() else (schema_path.parent / path).resolve()
    # VirtualPath: resolve the sibling source on the same git ref.
    return schema_path.parent / value.lstrip("/")


def _record_lines(path: str | Path):
    for line in _record_raw_lines(path):
        yield line.strip()


def _record_raw_lines(path: str | Path):
    for raw in _as_pathlike(path).read_text(encoding="utf-8").splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if raw.strip().startswith("@"):
            continue
        yield raw


def _lines(path: str | Path):
    for raw in _as_pathlike(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#"):
            yield line
