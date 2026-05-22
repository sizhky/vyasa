from __future__ import annotations

import copy
import re
from collections import defaultdict

from .layout import build_collapsed_graph


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
        hover_attrs_raw = raw.get("hover_attrs")
        if isinstance(hover_attrs_raw, list):
            hover_attrs = [str(item).strip() for item in hover_attrs_raw if str(item).strip()]
        elif hover_attrs_raw is None:
            hover_attrs = None  # signals "use default"
        else:
            value = str(hover_attrs_raw).strip()
            hover_attrs = [value] if value else []
        projections.append({
            "id": projection_id,
            "label": str(raw.get("label") or default_label).strip(),
            "caption": str(raw.get("caption") or "").strip(),
            "groups_from": groups_from,
            "default_color_by": str(raw.get("default_color_by") or groups_from[-1]).strip(),
            "edge_focus": str(raw.get("edge_focus") or "").strip(),
            "edge_label_from": str(raw.get("edge_label_from") or "").strip(),
            "hover_attrs": hover_attrs,
        })
    return projections


def build_projection_model(base_model: dict, projection: dict) -> dict:
    group_attrs: list[str] = projection["groups_from"]

    def value_path(task: dict) -> tuple[str, ...]:
        return tuple(
            (str(task.get(attr) or "").strip() or "(unset)")
            for attr in group_attrs
        )

    # Bottom-up: only paths that have at least one task get materialized.
    groups: list[dict] = []
    groups_by_path: dict[tuple[str, ...], dict] = {}
    group_tree: dict = defaultdict(list)
    task_children: dict = defaultdict(list)
    tasks: list[dict] = []

    for task in base_model.get("tasks", []):
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
                "label": value,
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
        "groups": groups,
        "tasks": tasks,
        "dependency_edges": copy.deepcopy(base_model.get("dependency_edges", [])),
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
