from __future__ import annotations

import copy
import re
from collections import defaultdict

from .layout import build_collapsed_graph

TASKS_PROJECTION_UNSPECIFIED_LABEL = "Unspecified"
PROJECTION_DISPLAY_KEYS = {
    "default_open_depth", "node-card-width", "hover-font-size", "color_mix",
    "color_mix_intensity", "projection-group-opacity", "projection-unspecified-group-opacity",
    "projection-unspecified-content-opacity", "jitter", "jitter_y",
    "spacing", "node_spacing", "layer_spacing", "group_padding",
    "layout_direction", "collision_gap", "edge_label_width",
}


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return slug or "item"


def _clean_projection_id(value: str) -> str:
    return _slugify(str(value or "").strip())


def _normalize_groups_from(value) -> list[str]:
    if isinstance(value, list):
        items = value
    elif value is None:
        return []
    else:
        items = [value]
    out = []
    for item in items:
        attr = str(item or "").strip()
        if attr and attr not in out:
            out.append(attr)
    return out


def _normalize_where(value) -> dict[str, str]:
    return {
        str(key).strip(): str(item).strip()
        for key, item in (value or {}).items()
        if str(key).strip() and str(item).strip()
    } if isinstance(value, dict) else {}


def _source_attr_filters(model: dict, source: str) -> dict[str, set[str]]:
    filters: dict[str, set[str]] = {}
    sources = model.get("kg_sources") if isinstance(model.get("kg_sources"), dict) else {}
    for fragment in str(source or "base").split("+"):
        raw = sources.get(fragment, {}).get("__attrs_filter", {})
        if not isinstance(raw, dict):
            continue
        for key, values in raw.items():
            filters.setdefault(str(key), set()).update(str(value) for value in values)
    return filters


def _normalize_hover_attrs(value):
    if value is None:
        return None
    items = value if isinstance(value, list) else str(value).split(",")
    return [str(item).strip() for item in items if str(item).strip()]


def _normalize_aggregate_edges(value) -> dict:
    if isinstance(value, dict):
        return {str(key).strip(): item for key, item in value.items() if str(key).strip()}
    out = {}
    for part in str(value or "").replace(",", " ").split():
        if "=" not in part:
            continue
        key, raw = part.split("=", 1)
        text = raw.strip().lower()
        out[key.strip()] = text in {"1", "true", "yes", "on"} if text in {"1", "true", "yes", "on", "0", "false", "no", "off"} else raw.strip()
    return {key: item for key, item in out.items() if key}


def _projection_group_label(attr: str, value: str) -> str:
    attr_label = str(attr or "").strip().replace("_", " ").title()
    value_label = str(value or "").strip()
    if not attr_label:
        return value_label
    if not value_label:
        return attr_label
    return f"{attr_label} > {value_label}"


def normalize_projections(value) -> list[dict]:
    if not isinstance(value, list):
        return []
    projections = []
    seen = set()
    for raw in value:
        if not isinstance(raw, dict):
            continue
        groups_from = _normalize_groups_from(raw.get("groups_from"))
        if not groups_from:
            continue
        projection_id = _clean_projection_id(raw.get("id") or groups_from[-1])
        if not projection_id or projection_id in seen:
            continue
        seen.add(projection_id)
        default_label = " / ".join(attr.replace("_", " ").title() for attr in groups_from)
        hover_attrs = _normalize_hover_attrs(raw.get("hover_attrs"))
        projections.append({
            "id": projection_id,
            "label": str(raw.get("label") or default_label).strip(),
            "caption": str(raw.get("caption") or "").strip(),
            "source": str(raw.get("source") or "base").strip(),
            "where": _normalize_where(raw.get("where")),
            "groups_from": groups_from,
            "default_color_by": str(raw.get("default_color_by") or groups_from[-1]).strip(),
            "edge_color_by": str(raw.get("edge_color_by") or "").strip(),
            "edge_focus": str(raw.get("edge_focus") or "").strip(),
            "edge_label_from": str(raw.get("edge_label_from") or "").strip(),
            "hover_attrs": hover_attrs,
            "aggregate_edges": _normalize_aggregate_edges(raw.get("aggregate_edges")),
            **{key: raw[key] for key in PROJECTION_DISPLAY_KEYS if key in raw},
        })
    return projections


def build_projection_model(base_model: dict, projection: dict) -> dict:
    group_attrs: list[str] = projection["groups_from"]
    where = projection.get("where") or {}
    source_attr_filters = _source_attr_filters(base_model, projection.get("source") or "")
    source_names = set(str(projection.get("source") or "").split("+"))
    edge_source_scoped = bool(source_names and source_names != {"base"})
    source_scoped_edges = [
        copy.deepcopy(edge)
        for edge in base_model.get("dependency_edges", [])
        if edge_source_scoped and source_names.intersection(edge.get("__kg_sources") or [])
    ]
    endpoint_node_ids = {
        node_id
        for edge in source_scoped_edges
        for node_id in (edge.get("source"), edge.get("target"))
        if node_id
    }

    def value_path(task: dict) -> tuple[str, ...]:
        return tuple(
            (str(task.get(attr) or "").strip() or TASKS_PROJECTION_UNSPECIFIED_LABEL)
            for attr in group_attrs
        )

    # Bottom-up: only paths that have at least one task get materialized.
    groups: list[dict] = []
    groups_by_path: dict[tuple[str, ...], dict] = {}
    group_tree: dict = defaultdict(list)
    task_children: dict = defaultdict(list)
    tasks: list[dict] = []

    for task in base_model.get("tasks", []):
        if endpoint_node_ids and task.get("id") not in endpoint_node_ids:
            continue
        if where and any(str(task.get(key) or "").strip() != value for key, value in where.items()):
            continue
        if source_attr_filters and any(str(task.get(key) or "").strip() not in values for key, values in source_attr_filters.items()):
            continue
        path = value_path(task)
        # Ensure ancestor groups exist for every prefix of the path.
        for depth in range(1, len(path) + 1):
            prefix = path[:depth]
            if prefix in groups_by_path:
                continue
            attr = group_attrs[depth - 1]
            value = prefix[-1]
            slug_parts = [projection["id"]] + [
                f"{group_attrs[i]}-{prefix[i]}" for i in range(depth)
            ]
            group_id = _slugify("__".join(slug_parts))
            parent_path = prefix[:-1]
            parent_id = groups_by_path[parent_path]["id"] if parent_path else None
            group = {
                "id": group_id,
                "label": _projection_group_label(attr, value),
                "parent_group_id": parent_id,
                "__projection_group__": True,
                "projection": projection["id"],
                attr: value,
            }
            groups.append(group)
            groups_by_path[prefix] = group
            group_tree[parent_id].append(group_id)
        leaf_group = groups_by_path[path]
        task_copy = copy.deepcopy(task)
        task_copy["group_id"] = leaf_group["id"]
        tasks.append(task_copy)
        task_children[leaf_group["id"]].append(task_copy["id"])

    projection_model = {
        **base_model,
        "graph_id": f"{base_model.get('graph_id')}-{projection['id']}",
        "title": base_model.get("title", ""),
        "default_color_by": str(projection.get("default_color_by") or base_model.get("default_color_by") or "").strip(),
        "edge_color_by": str(projection.get("edge_color_by") or base_model.get("edge_color_by") or "").strip(),
        "edge_label_from": str(projection.get("edge_label_from") or base_model.get("edge_label_from") or "").strip(),
        "hover_attrs": projection.get("hover_attrs") if projection.get("hover_attrs") is not None else base_model.get("hover_attrs", []),
        "aggregate_edges": projection.get("aggregate_edges") or base_model.get("aggregate_edges", {}),
        **{key: projection[key] for key in PROJECTION_DISPLAY_KEYS if key in projection},
        "groups": groups,
        "tasks": tasks,
        "dependency_edges": [
            copy.deepcopy(edge)
            for edge in (source_scoped_edges if edge_source_scoped else base_model.get("dependency_edges", []))
            if edge.get("source") in {task["id"] for task in tasks} and edge.get("target") in {task["id"] for task in tasks}
        ],
        "group_tree": dict(group_tree),
        "task_children": dict(task_children),
        "document_order": [group["id"] for group in groups] + [task["id"] for task in tasks],
        "active_projection": projection["id"],
    }
    projection_model.pop("projection_models", None)
    projection_model.pop("view_projections", None)
    return projection_model


def attach_projection_models(model: dict) -> dict:
    projections = normalize_projections(model.get("view_projections"))
    model["view_projections"] = projections
    model["projection_models"] = {}
    for projection in projections:
        projection_model = build_projection_model(model, projection)
        model["projection_models"][projection["id"]] = {
            "model": projection_model,
            "graph": build_collapsed_graph(projection_model),
        }
    if model.get("default_projection") and model["default_projection"] not in model["projection_models"]:
        model["default_projection"] = ""
    return model
