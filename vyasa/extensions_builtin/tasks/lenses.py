from __future__ import annotations

import copy
import re
from collections import defaultdict

from .layout import build_collapsed_graph


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return slug or "item"


def _clean_lens_id(value: str) -> str:
    return _slugify(str(value or "").strip())


def normalize_lenses(value) -> list[dict]:
    if not isinstance(value, list):
        return []
    lenses = []
    seen = set()
    for raw in value:
        if not isinstance(raw, dict):
            continue
        groups_from = str(raw.get("groups_from") or "").strip()
        if not groups_from:
            continue
        lens_id = _clean_lens_id(raw.get("id") or groups_from)
        if not lens_id or lens_id in seen:
            continue
        seen.add(lens_id)
        lenses.append({
            "id": lens_id,
            "label": str(raw.get("label") or groups_from.replace("_", " ").title()).strip(),
            "groups_from": groups_from,
            "edge_focus": str(raw.get("edge_focus") or "").strip(),
        })
    return lenses


def build_lens_model(base_model: dict, lens: dict) -> dict:
    group_attr = lens["groups_from"]
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
        group_id = _slugify(f"{lens['id']}-{value}")
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
            "__lens_group__": True,
            "lens": lens["id"],
        }
        group[group_attr] = value
        groups.append(group)
        group_tree[None].append(group_id)
        for task in buckets[value]:
            task["group_id"] = group_id
            tasks.append(task)
            task_children[group_id].append(task["id"])

    lens_model = {
        **base_model,
        "graph_id": f"{base_model.get('graph_id')}-{lens['id']}",
        "title": base_model.get("title", ""),
        "groups": groups,
        "tasks": tasks,
        "dependency_edges": copy.deepcopy(base_model.get("dependency_edges", [])),
        "group_tree": dict(group_tree),
        "task_children": dict(task_children),
        "document_order": [group["id"] for group in groups] + [task["id"] for task in tasks],
        "active_lens": lens["id"],
    }
    lens_model.pop("lens_models", None)
    lens_model.pop("view_lenses", None)
    return lens_model


def attach_lens_models(model: dict) -> dict:
    lenses = normalize_lenses(model.get("view_lenses"))
    model["view_lenses"] = lenses
    model["lens_models"] = {}
    for lens in lenses:
        lens_model = build_lens_model(model, lens)
        model["lens_models"][lens["id"]] = {
            "model": lens_model,
            "graph": build_collapsed_graph(lens_model),
        }
    if model.get("default_lens") and model["default_lens"] not in model["lens_models"]:
        model["default_lens"] = ""
    return model
