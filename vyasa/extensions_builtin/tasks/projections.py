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


def normalize_projections(value) -> list[dict]:
    if not isinstance(value, list):
        return []
    projections = []
    seen = set()
    for raw in value:
        if not isinstance(raw, dict):
            continue
        groups_from = str(raw.get("groups_from") or "").strip()
        if not groups_from:
            continue
        projection_id = _clean_projection_id(raw.get("id") or groups_from)
        if not projection_id or projection_id in seen:
            continue
        seen.add(projection_id)
        projections.append({
            "id": projection_id,
            "label": str(raw.get("label") or groups_from.replace("_", " ").title()).strip(),
            "groups_from": groups_from,
            "edge_focus": str(raw.get("edge_focus") or "").strip(),
        })
    return projections


def build_projection_model(base_model: dict, projection: dict) -> dict:
    group_attr = projection["groups_from"]
    buckets: dict[str, list[dict]] = defaultdict(list)
    for task in base_model.get("tasks", []):
        value = str(task.get(group_attr) or "(unset)").strip() or "(unset)"
        buckets[value].append(copy.deepcopy(task))

    groups = []
    tasks = []
    group_tree = defaultdict(list)
    task_children = defaultdict(list)
    used_group_ids = set()
    for value in sorted(buckets):
        group_id = _slugify(f"{projection['id']}-{value}")
        if group_id in used_group_ids:
            suffix = 2
            while f"{group_id}-{suffix}" in used_group_ids:
                suffix += 1
            group_id = f"{group_id}-{suffix}"
        used_group_ids.add(group_id)
        group = {
            "id": group_id,
            "label": value,
            "parent_group_id": None,
            "__projection_group__": True,
            "projection": projection["id"],
        }
        group[group_attr] = value
        groups.append(group)
        group_tree[None].append(group_id)
        for task in buckets[value]:
            task["group_id"] = group_id
            tasks.append(task)
            task_children[group_id].append(task["id"])

    projection_model = {
        **base_model,
        "graph_id": f"{base_model.get('graph_id')}-{projection['id']}",
        "title": base_model.get("title", ""),
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
