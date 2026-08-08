from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import json
import shlex
import re
import textwrap
from typing import TYPE_CHECKING, Any, Union

from .query import resolve_context_id

if TYPE_CHECKING:
    from ...content_backend import VirtualPath

# A filesystem path or a ref-backed VirtualPath. Both expose the read surface
# (read_text, parent, /, with_suffix, exists, glob, ...) the KG readers use.
PathLike = Union[Path, "VirtualPath"]

NODE_ID_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*$")
EDGE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
EDGE_RESERVED_FIELDS = {"id", "source", "target", "relation", "label"}
NODE_REFERENCE_RE = re.compile(r"\[\[([^\]|\n]+)(?:\|[^\]\n]+)?\]\]")


def _referenced_node_ids(node: dict[str, Any]) -> set[str]:
    values = (
        item
        for value in node.values()
        for item in (value if isinstance(value, list) else [value])
        if isinstance(item, (str, int, float, bool))
    )
    return {
        match.group(1).strip()
        for value in values
        for match in NODE_REFERENCE_RE.finditer(str(value))
        if match.group(1).strip()
    }


def _reference_closure(nodes_by_id: dict[str, dict[str, Any]], roots: set[str]) -> set[str]:
    included = set(roots)
    pending = list(roots)
    while pending:
        node = nodes_by_id.get(pending.pop())
        if not node:
            continue
        for target in _referenced_node_ids(node):
            if target in nodes_by_id and target not in included:
                included.add(target)
                pending.append(target)
    return included


def _as_pathlike(p: "str | PathLike") -> PathLike:
    """Wrap a plain string into a filesystem Path; pass a ref-backed VirtualPath
    (or existing Path) through untouched. Coercing to Path() would strip the git
    ref and silently fall back to the working tree."""
    return Path(p) if isinstance(p, str) else p


@dataclass
class KgView:
    id: str
    context: str = "active"
    slides: list[dict[str, Any]] = field(default_factory=list)
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
    search_enabled: bool | None = None
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
    acl: dict[str, Any] = field(default_factory=lambda: {"classes": [], "grants": {}, "people": {}})
    palette: str = ""
    cache: str = ""
    nodes: str = ""
    edges: str = ""
    attrs: str = ""


@dataclass
class KgContext:
    id: str
    seq: int
    label: str = ""
    stage: str = ""
    caption: str = ""
    attrs_path: str = ""
    palette: str = ""
    node_attrs: dict[str, dict[str, list[str]]] = field(default_factory=dict)
    edges: list[dict[str, Any]] = field(default_factory=list)
    slides: list[dict[str, Any]] = field(default_factory=list)
    views: list[KgView] = field(default_factory=list)


def read_kg_pack(schema_path: PathLike, context_id: str = "") -> dict[str, Any]:
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
        "view_projections": _resolved_projections(schema.views, [], "base"),
        "slides": schema.slides,
        "default_projection": "",
        "default_group_by": _list_value(schema.graph.get("group_by", "")),
        "default_color_by": schema.graph.get("color_by", ""),
        "default_secondary_color_by": schema.graph.get("secondary_color_by", ""),
        "edge_color_by": schema.graph.get("edge_color_by", ""),
        "edge_label_from": schema.graph.get("edge_label_from", ""),
        "default_open_depth": schema.graph.get("default_open_depth", ""),
        "hover_attrs": _list_value(schema.graph.get("hover_attrs", "")),
        "card_states": _list_value(schema.graph.get("card_states", "")),
        "acl": _acl_payload(schema),
    }
    nodes_by_id: dict[str, dict] = {}
    edges_by_id: dict[str, dict] = {}
    index_attributes: list[str] = []
    edge_index_attributes: list[str] = []
    for source_name in _source_names_for_views(schema):
        source = _resolve_source(schema, source_name)
        for node_path in _path_list(source.get("nodes")):
            for node in read_nodes(_resolve(schema_path, node_path)):
                nodes_by_id[node["id"]] = {**nodes_by_id.get(node["id"], {}), **node}
        for edge_path in _path_list(source.get("edges")):
            for raw_edge in read_edges(_resolve(schema_path, edge_path)):
                edge: dict[str, Any] = dict(raw_edge)
                edge["__kg_sources"] = _source_tags(edges_by_id.get(edge["id"], {}).get("__kg_sources"), source_name)
                edges_by_id[edge["id"]] = {**edges_by_id.get(edge["id"], {}), **edge}
        for attrs_path in _path_list(source.get("attrs")):
            indexed = apply_attrs(_resolve(schema_path, attrs_path), nodes_by_id, edges_by_id)
            for key in indexed.get("node", []):
                if key not in index_attributes:
                    index_attributes.append(key)
            for key in indexed.get("edge", []):
                if key not in edge_index_attributes:
                    edge_index_attributes.append(key)
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
    graph["edge_index_attributes"] = list(dict.fromkeys(edge_index_attributes + _edge_attribute_keys(edges_by_id.values())))
    graph["filter_attributes"] = index_attributes
    _write_kg_cache(schema_path, schema.cache, graph)
    return graph


def _read_context_kg_pack(schema_path: PathLike, schema: KgSchema, context_id: str = "") -> dict[str, Any]:
    contexts = _discover_contexts(schema_path, schema.graph.get("contexts", ""))
    _validate_context_catalog(contexts, require_stage=bool(schema.edges))
    catalog = _context_catalog(contexts)
    active_id = resolve_context_id(
        catalog,
        context_id or schema.graph.get("default_context", "latest"),
        schema.graph.get("default_context", "latest"),
    )
    active = next(item for item in contexts if item.id == active_id)
    edge_definitions = _read_edge_definitions(schema_path, schema)
    introduced = _edge_introductions(contexts)
    resolved_edges = {
        context.id: _resolve_context_edges(context, edge_definitions, introduced)
        for context in contexts
    }
    edges = resolved_edges[active.id]
    nodes_by_id = {node["id"]: node for node in read_nodes(_resolve(schema_path, schema.nodes))}
    edges_by_id = {edge["id"]: edge for edge in edges}
    index_attributes: list[str] = []
    if schema.attrs:
        indexed = apply_attrs(_resolve(schema_path, schema.attrs), nodes_by_id, edges_by_id)
        index_attributes.extend(indexed.get("node", []))
        edge_index_attributes = list(indexed.get("edge", []))
    else:
        edge_index_attributes = []
    _apply_context_attrs(active, nodes_by_id)
    _apply_status_defaults(schema, nodes_by_id, edges)
    present = {node_id for edge in edges for node_id in (edge.get("source"), edge.get("target")) if node_id}
    present = _reference_closure(nodes_by_id, present)
    graph = {
        "id": schema.graph.get("id", ""),
        "title": schema.graph.get("title", ""),
        "groups": [],
        "tasks": [node for node_id, node in nodes_by_id.items() if node_id in present],
        "node_reference_labels": {
            node_id: str(node.get("label") or node_id)
            for node_id, node in nodes_by_id.items()
        },
        "dependency_edges": edges,
        "view_projections": _resolved_projections(active.views or schema.views, catalog, active.id),
        "slides": active.slides or schema.slides,
        "default_projection": "",
        "default_group_by": _list_value(schema.graph.get("group_by", "")),
        "default_color_by": schema.graph.get("color_by", ""),
        "default_secondary_color_by": schema.graph.get("secondary_color_by", ""),
        "edge_color_by": schema.graph.get("edge_color_by", ""),
        "edge_label_from": schema.graph.get("edge_label_from", ""),
        "default_open_depth": schema.graph.get("default_open_depth", ""),
        "hover_attrs": _list_value(schema.graph.get("hover_attrs", "")),
        "card_states": _list_value(schema.graph.get("card_states", "")),
        "acl": _acl_payload(schema),
        "kg_context": {"id": active.id, "seq": active.seq, "label": active.label, "stage": active.stage, "caption": active.caption},
        "kg_contexts": [{"id": item.id, "seq": item.seq, "label": item.label, "stage": item.stage, "caption": item.caption} for item in contexts],
    }
    if active.palette or schema.palette:
        graph["color_palette_source"] = str(_resolve(schema_path, active.palette or schema.palette))
    graph["kg_schema"] = str(schema_path)
    graph["kg_sources"] = schema.sources or {"base": {"context": active.id}}
    graph["index_attributes"] = list(dict.fromkeys(index_attributes + list(active.node_attrs) + ["status"]))
    graph["edge_index_attributes"] = list(dict.fromkeys(edge_index_attributes + _edge_attribute_keys(edges)))
    graph["filter_attributes"] = graph["index_attributes"]
    return graph


def _discover_contexts(schema_path: PathLike, pattern: str) -> list[KgContext]:
    contexts = [_read_context(path) for path in sorted(schema_path.parent.glob(pattern))]
    return sorted((item for item in contexts if item.id), key=lambda item: item.seq)


def _default_context(contexts: list[KgContext], default_id: str) -> KgContext:
    if not contexts:
        raise ValueError("KG context schema has no contexts")
    context_id = resolve_context_id(_context_catalog(contexts), default_id, default_id)
    return next(item for item in contexts if item.id == context_id)


def _context_catalog(contexts: list[KgContext]) -> list[dict[str, Any]]:
    return [
        {"id": item.id, "seq": item.seq, "label": item.label, "stage": item.stage, "caption": item.caption}
        for item in contexts
    ]


def _resolved_projections(
    views: list[KgView],
    contexts: list[dict[str, Any]],
    active_context: str,
) -> list[dict[str, Any]]:
    return [
        _projection(
            view,
            resolve_context_id(contexts, view.context, active_context, active_context),
        )
        for view in views
    ]


def _read_context(path: PathLike) -> KgContext:
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
            context.stage = payload.get("stage", "")
            section = "@context"
            continue
        if line.startswith("@"):
            section = line
            current_slide = None
            if section == "@views":
                views, consumed = _read_views(raw_lines, index)
                for view in views:
                    view.context = context.id
                context.views.extend(views)
                index += consumed
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
            context.stage = payload.get("stage", context.stage)
        elif section == "@attrs":
            _read_context_attr_line(context, raw)
        elif section == "@edges":
            context.edges.append(_read_context_edge(line, context.id, len(context.edges) + 1, path))
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


def _read_views(raw_lines: list[str], start: int = 0) -> tuple[list[KgView], int]:
    views: list[KgView] = []
    current_view: KgView | None = None
    slides_indent: int | None = None
    slide_indent: int | None = None
    current_slide: dict[str, Any] | None = None
    index = start
    while index < len(raw_lines):
        raw = raw_lines[index]
        if raw.strip().startswith("@"):
            break
        index += 1
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        line = raw.strip()
        if not raw.startswith((" ", "\t")):
            current_view = _read_view(line)
            views.append(current_view)
            slides_indent, slide_indent, current_slide = None, None, None
            continue
        if current_view is None:
            continue
        indent = _indent_width(raw)
        if line == "slides:":
            slides_indent, slide_indent, current_slide = indent, None, None
        elif slides_indent is not None and indent > slides_indent:
            if "=" not in line and ":" in line and (slide_indent is None or indent <= slide_indent):
                sid, _, title = line.partition(":")
                current_slide = {"id": sid.strip(), "title": title.strip(), "nodes": []}
                current_view.slides.append(current_slide)
                slide_indent = indent
            elif current_slide is not None and indent > (slide_indent or 0):
                index += _read_slide_attr(raw_lines, index - 1, current_slide)
        else:
            slides_indent, slide_indent, current_slide = None, None, None
            _update_view(current_view, _view_assignment(line))
    return views, index - start


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


def _read_context_edge(line: str, context_id: str, index: int, path: PathLike | None = None) -> dict[str, Any]:
    edge = _parse_edge_head(line, path or f"context {context_id}", generated_id=f"{context_id}-e{index}")
    edge["__kg_sources"] = [context_id]
    edge["__authored_id__"] = ":" in line.split("->", 1)[0]
    return edge


def _apply_context_attrs(context: KgContext, nodes_by_id: dict[str, dict]) -> None:
    for key, values in context.node_attrs.items():
        for value, node_ids in values.items():
            for node_id in node_ids:
                if node_id in nodes_by_id:
                    _set_node_attr(nodes_by_id[node_id], key, value)


def _set_node_attr(node: dict[str, Any], key: str, value: Any) -> None:
    if key != "cls":
        node[key] = value
        return
    existing = node.get(key)
    values = existing if isinstance(existing, list) else ([existing] if existing not in (None, "") else [])
    for item in value if isinstance(value, list) else [value]:
        if item not in (None, "") and item not in values:
            values.append(item)
    if values:
        node[key] = values


def _apply_status_defaults(schema: KgSchema, nodes_by_id: dict[str, dict], edges: list[dict]) -> None:
    present = {node_id for edge in edges for node_id in (edge.get("source"), edge.get("target")) if node_id}
    for node_id in present:
        node = nodes_by_id.get(node_id)
        if node and not node.get("status"):
            node["status"] = schema.status_defaults.get(str(node.get("kind") or ""), "")


def _write_kg_cache(schema_path: PathLike, cache_name: str, graph: dict[str, Any]) -> None:
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


def read_schema(path: PathLike) -> KgSchema:
    path = _as_pathlike(path)
    schema = KgSchema()
    section = ""
    current_source = ""
    current_source_attrs = False
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
            current_slide = None
            if section == "@graph":
                payload = _assignments(parts[1:])
                schema.graph.update(payload)
                schema.nodes = payload.get("pool", schema.nodes)
                schema.attrs = payload.get("attrs", schema.attrs)
                schema.palette = payload.get("palette", schema.palette)
            elif section == "@views":
                views, consumed = _read_views(raw_lines, raw_index)
                schema.views.extend(views)
                raw_index += consumed
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
        elif section == "@acl":
            _read_acl_line(schema, line)
        elif section == "@slides":
            sid, _, title = line.partition(":")
            current_slide = {"id": sid.strip(), "title": title.strip(), "nodes": []}
            schema.slides.append(current_slide)
    _read_tmp_view_sidecars(schema, path)
    if "base" not in schema.sources:
        schema.sources["base"] = {}
    return schema


def _read_tmp_view_sidecars(schema: KgSchema, schema_path: PathLike) -> None:
    view_dir = _tmp_view_sidecar_dir(schema_path)
    if not view_dir.is_dir():
        return
    existing = {view.id: index for index, view in enumerate(schema.views)}
    for view_path in sorted(view_dir.glob("tmp.*.view")):
        raw_lines = view_path.read_text(encoding="utf-8").splitlines()
        views, _consumed = _read_views(raw_lines)
        for view in views:
            if view.id in existing:
                schema.views[existing[view.id]] = view
            else:
                existing[view.id] = len(schema.views)
                schema.views.append(view)


def _tmp_view_sidecar_dir(schema_path: PathLike) -> PathLike:
    return schema_path.parent if schema_path.name == "kg.schema" else schema_path.with_suffix("")


def read_nodes(path: PathLike) -> list[dict[str, str]]:
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


def read_edges(path: PathLike, relations: dict[str, dict[str, str]] | None = None) -> list[dict[str, Any]]:
    del relations  # Relation palettes style edges at render time; records stay authored data only.
    edges: list[dict[str, Any]] = []
    by_id: dict[str, dict[str, Any]] = {}
    current: dict[str, Any] | None = None
    raw_lines = _as_pathlike(path).read_text(encoding="utf-8").splitlines()
    line_index = 0
    while line_index < len(raw_lines):
        raw = raw_lines[line_index]
        line_index += 1
        if not raw.strip() or raw.lstrip().startswith(("#", "@")):
            continue
        line = raw.strip()
        if not raw.startswith((" ", "\t")):
            edge = _parse_edge_head(line, path)
            if edge["id"] in by_id:
                raise ValueError(f"{path}: duplicate edge id {edge['id']!r}")
            by_id[edge["id"]] = edge
            edges.append(edge)
            current = edge
            continue
        if current is None or "=" not in line:
            raise ValueError(f"{path}: invalid edge field {line!r}")
        key, value = _split_inline_assignment(line)
        if key in EDGE_RESERVED_FIELDS:
            raise ValueError(f"{path}: edge field {key!r} is reserved")
        if value == "|":
            value, consumed = _read_indented_multiline(raw_lines, line_index, _indent_width(raw))
            line_index += consumed
        _merge_edge_value(current, key, value)
    return edges


def _parse_edge_head(line: str, path: PathLike | str, generated_id: str = "") -> dict[str, Any]:
    edge_id = generated_id
    rest = line
    if ":" in line:
        edge_id, rest = (part.strip() for part in line.split(":", 1))
    if not edge_id or not EDGE_ID_RE.fullmatch(edge_id):
        raise ValueError(f"{path}: invalid edge id {edge_id!r}")
    parts = shlex.split(rest)
    if len(parts) < 3 or parts[1] != "->":
        raise ValueError(f"{path}: invalid edge line {line!r}; expected '<id>: <source> -> <target> [relation]'")
    relation = parts[3] if len(parts) > 3 and "=" not in parts[3] else ""
    attr_parts = parts[4:] if relation else parts[3:]
    malformed = next((part for part in attr_parts if "=" not in part), "")
    if malformed:
        raise ValueError(f"{path}: invalid edge field {malformed!r}")
    attrs = _assignments(attr_parts)
    conflict = EDGE_RESERVED_FIELDS & attrs.keys()
    if conflict:
        raise ValueError(f"{path}: edge field {sorted(conflict)[0]!r} is reserved")
    edge: dict[str, Any] = {"id": edge_id, "source": parts[0], "target": parts[2], **attrs}
    if relation:
        edge["relation"] = relation
        edge["label"] = relation
    return edge


def _merge_edge_value(edge: dict[str, Any], key: str, value: Any) -> None:
    existing = edge.get(key)
    if existing is None:
        edge[key] = value
    elif isinstance(existing, list):
        if value not in existing:
            existing.append(value)
    elif existing != value:
        edge[key] = [existing, value]


def _edge_attribute_keys(edges) -> list[str]:
    return list(dict.fromkeys(
        key
        for edge in edges
        for key in edge
        if key not in EDGE_RESERVED_FIELDS and not key.startswith("__")
    ))


def _read_edge_definitions(schema_path: PathLike, schema: KgSchema) -> dict[str, dict[str, Any]]:
    if not schema.edges:
        return {}
    definitions: dict[str, dict[str, Any]] = {}
    for edge_path in _path_list(schema.edges):
        for edge in read_edges(_resolve(schema_path, edge_path)):
            edge_id = str(edge["id"])
            if edge_id in definitions:
                raise ValueError(f"{schema_path}: duplicate edge id {edge_id!r}")
            definitions[edge_id] = edge
    return definitions


def _validate_context_catalog(contexts: list[KgContext], require_stage: bool) -> None:
    seen_seq: set[int] = set()
    for context in contexts:
        if context.seq in seen_seq:
            raise ValueError(f"Duplicate KG context seq: {context.seq}")
        seen_seq.add(context.seq)
        if require_stage and not context.stage:
            raise ValueError(f"KG context {context.id!r} must declare stage")


def _edge_introductions(contexts: list[KgContext]) -> dict[str, tuple[str, str]]:
    introduced: dict[str, tuple[str, str]] = {}
    for context in sorted(contexts, key=lambda item: (item.seq, item.id)):
        for edge in context.edges:
            introduced.setdefault(str(edge["id"]), (context.id, context.stage))
    return introduced


def _resolve_context_edges(
    context: KgContext,
    definitions: dict[str, dict[str, Any]],
    introduced: dict[str, tuple[str, str]],
) -> list[dict[str, Any]]:
    if not definitions:
        return list(context.edges)
    resolved: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    allowed = EDGE_RESERVED_FIELDS | {"__kg_sources", "__authored_id__"}
    for assertion in context.edges:
        edge_id = str(assertion["id"])
        if edge_id in seen_ids:
            raise ValueError(f"KG context {context.id!r} asserts edge {edge_id!r} more than once")
        seen_ids.add(edge_id)
        if not assertion.get("__authored_id__"):
            raise ValueError(f"KG context {context.id!r} edge must use an authored id")
        definition = definitions.get(edge_id)
        if definition is None:
            raise ValueError(f"KG context {context.id!r} names undefined edge {edge_id!r}")
        extra = [key for key in assertion if key not in allowed]
        if extra:
            raise ValueError(f"KG context {context.id!r} edge {edge_id!r} cannot set field {extra[0]!r}")
        for key in ("source", "target", "relation"):
            if str(assertion.get(key) or "") != str(definition.get(key) or ""):
                raise ValueError(f"KG context {context.id!r} edge {edge_id!r} has conflicting {key}")
        introduced_context, introduced_stage = introduced[edge_id]
        resolved.append({
            **definition,
            "introduced_context": introduced_context,
            "introduced_stage": introduced_stage,
            "__kg_sources": [context.id],
        })
    return resolved


def apply_attrs(path: PathLike, nodes: dict[str, dict], edges: dict[str, dict]) -> dict[str, list[str]]:
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
                    if section == "@node_attrs" and current_key == "cls":
                        _set_node_attr(target[record_id], current_key, attr_value)
                    elif existing is None:
                        target[record_id][current_key] = attr_value
                    elif isinstance(existing, list):
                        if attr_value not in existing:
                            existing.append(attr_value)
                    elif existing != attr_value:
                        target[record_id][current_key] = [existing, attr_value]
                    if section == "@node_attrs" and current_key == "inherit":
                        target[record_id]["__inherit_keys__"] = _list_value(value.strip())
    return indexed


def read_palette(path: PathLike) -> dict[str, Any]:
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
    schema.edges = payload.get("edges", schema.edges)
    schema.attrs = payload.get("attrs", schema.attrs)
    return ""


def _read_view(line: str) -> KgView:
    parts = shlex.split(line)
    view_id = parts[0].rstrip(":")
    payload = _assignments(parts[1:])
    view = KgView(id=view_id)
    _update_view(view, payload)
    return view


def _read_acl_line(schema: KgSchema, line: str) -> None:
    if line.startswith("classes="):
        schema.acl["classes"] = _list_value(line.split("=", 1)[1])
        return
    if line.startswith("grant "):
        parts = line.split()
        if len(parts) >= 3:
            schema.acl.setdefault("grants", {})[parts[1]] = parts[2:]
        return
    if line.startswith("person ") and " = " in line:
        people, role = line[len("person "):].split(" = ", 1)
        for person in [part.strip() for part in people.split(",") if part.strip()]:
            schema.acl.setdefault("people", {})[person] = role.strip()


def _acl_payload(schema: KgSchema) -> dict[str, Any]:
    return {
        "classes": list(schema.acl.get("classes") or []),
        "grants": dict(schema.acl.get("grants") or {}),
        "people": dict(schema.acl.get("people") or {}),
    }


def _update_view(view: KgView, payload: dict[str, str]) -> None:
    group_by = _list_value(payload.get("group_by", ""))
    consumed = {
        "context", "source", "where", "filter", "group_by", "color_by", "secondary_color_by",
        "edge_color_by", "edge_label_from", "hover_attrs", "aggregate_edges",
        "filter_query", "query_builder_enabled", "search_enabled", "search", "filters_collapsed",
        "edges_visible", "edge_animation_enabled", "edge_animation_mode",
        "edge_animation_tick_steps", "edge_animation_tick_duration", "edge_opacity",
        "projection_unspecified_content_opacity", "caption",
    }
    if "context" in payload:
        view.context = payload["context"]
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
    if "search_enabled" in payload:
        value = _typed_scalar(payload["search_enabled"])
        view.search_enabled = value if isinstance(value, bool) else None
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


def _projection(view: KgView, resolved_context: str = "base") -> dict[str, Any]:
    projection = {
        "id": view.id,
        "label": view.id.replace("_", " ").replace("-", " ").title(),
        "context": view.context,
        "resolved_context": resolved_context,
        "slides": view.slides,
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
        "search_enabled": view.search_enabled,
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


def _read_node_line(line: str, path: PathLike) -> dict[str, Any]:
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


def _merge_node(existing: dict[str, Any], node: dict[str, Any], path: PathLike) -> None:
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
    if schema.edges:
        merged["edges"] = schema.edges
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


def _resolve(schema_path: PathLike, value: str) -> PathLike:
    value = str(value)
    if isinstance(schema_path, Path):
        path = Path(value)
        return path if path.is_absolute() else (schema_path.parent / path).resolve()
    # VirtualPath: resolve the sibling source on the same git ref.
    return schema_path.parent / value.lstrip("/")


def _record_lines(path: PathLike):
    for line in _record_raw_lines(path):
        yield line.strip()


def _record_raw_lines(path: PathLike):
    for raw in _as_pathlike(path).read_text(encoding="utf-8").splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if raw.strip().startswith("@"):
            continue
        yield raw


def _lines(path: PathLike):
    for raw in _as_pathlike(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#"):
            yield line
