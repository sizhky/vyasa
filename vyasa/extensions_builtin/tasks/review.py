"""Git-backed Knowledge Graph review compilation.

Git owns revision topology. Knowledge Graph contexts remain semantic snapshots
inside each revision. This module resolves both axes and produces one review
model that the existing graph renderer can consume.
"""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any, cast

from ...content_backend import VirtualPath, discover_git_backend, ref_read_scope
from .layout import build_collapsed_graph
from .model import parse_tasks_text


_NODE_IGNORED_FIELDS = {
    "id", "__rendered_attrs__", "__kg_sources", "__checked__", "__card_state__",
    "__card_state_color__", "__has_note__", "connectivity", "rank",
}
_EDGE_IGNORED_FIELDS = {"__rendered_attrs__", "__kg_sources"}


def _compile_ref_model(schema_path: Path, ref: str, context_id: str = "") -> dict[str, Any]:
    discovered = discover_git_backend(schema_path)
    if discovered is None:
        raise ValueError("Knowledge Graph history requires a Git repository")
    backend, repo_root = discovered
    if ref == "WORKTREE":
        context_line = f"kg_context_id: {context_id}\n" if context_id else ""
        source = f"```items\n---\nitems_schema: {schema_path}\n{context_line}---\n```"
        return parse_tasks_text(source, current_path=schema_path)
    resolved = backend.resolve_ref(ref)
    if not resolved:
        raise ValueError(f"Unknown Git revision: {ref}")
    try:
        rel = schema_path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError as exc:
        raise ValueError("Knowledge Graph schema is outside its Git repository") from exc
    virtual_schema = VirtualPath(backend, resolved, "", rel, "file")
    if not virtual_schema.exists():
        raise ValueError(f"Knowledge Graph schema does not exist at {ref}")
    context_line = f"kg_context_id: {context_id}\n" if context_id else ""
    source = f"```items\n---\nitems_schema: {virtual_schema.slug}\n{context_line}---\n```"
    with ref_read_scope(virtual_schema):
        model = parse_tasks_text(source, current_path=cast(Any, virtual_schema))
    model["kg_schema"] = str(schema_path)
    return model


def _context_ids(model: dict[str, Any]) -> set[str]:
    return {str(item.get("id") or "") for item in model.get("kg_contexts", []) if item.get("id")}


def _empty_side() -> dict[str, Any]:
    return {"groups": [], "tasks": [], "dependency_edges": [], "projection_models": {}, "view_projections": []}


def _head_side(schema_path: Path, ref: str, requested: str) -> tuple[dict[str, Any], str]:
    """The head revision owns the context catalog the reviewer browses."""
    model = _compile_ref_model(schema_path, ref)
    wanted = requested if requested and requested in _context_ids(model) else ""
    if wanted and str(model.get("kg_context", {}).get("id") or "") != wanted:
        model = _compile_ref_model(schema_path, ref, wanted)
    return model, str(model.get("kg_context", {}).get("id") or "")


def _base_side(schema_path: Path, ref: str, context_id: str) -> tuple[dict[str, Any], bool]:
    """One context is held across both revisions. A context names a variant, not an
    earlier version of another variant, so an absent one never substitutes another.
    It contributes nothing instead, the way a view present on one side does."""
    model = _compile_ref_model(schema_path, ref)
    if context_id and context_id not in _context_ids(model):
        return _empty_side(), True
    if context_id and str(model.get("kg_context", {}).get("id") or "") != context_id:
        model = _compile_ref_model(schema_path, ref, context_id)
    return model, False


def _public_record(record: dict[str, Any], ignored: set[str]) -> dict[str, Any]:
    return {
        key: value
        for key, value in record.items()
        if key not in ignored and not key.startswith("__")
    }


def _node_map(model: dict[str, Any]) -> dict[str, tuple[str, dict[str, Any]]]:
    return {
        str(node.get("id")): (bucket, node)
        for bucket in ("groups", "tasks")
        for node in model.get(bucket, [])
        if node.get("id")
    }


def _edge_key(edge: dict[str, Any]) -> str:
    edge_id = str(edge.get("id") or "")
    if edge_id:
        return edge_id
    return "\x1f".join(str(edge.get(key) or "") for key in ("source", "relation", "label", "target"))


def _edge_map(model: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {_edge_key(edge): edge for edge in model.get("dependency_edges", [])}


def _field_changes(before: dict[str, Any], after: dict[str, Any], ignored: set[str]) -> list[dict[str, Any]]:
    left = _public_record(before, ignored)
    right = _public_record(after, ignored)
    changes: list[dict[str, Any]] = []
    for field in sorted((left.keys() | right.keys()) - {"id"}):
        if left.get(field) == right.get(field):
            continue
        change = "added" if field not in left else "removed" if field not in right else "modified"
        changes.append({"field": field, "change": change, "before": left.get(field), "after": right.get(field)})
    return changes


def _edge_statement(edge: dict[str, Any], change: str, fields: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "id": str(edge.get("id") or ""),
        "change": change,
        "source": str(edge.get("source") or ""),
        "relation": str(edge.get("relation") or edge.get("label") or ""),
        "target": str(edge.get("target") or ""),
        "fields": fields or [],
    }


def _rebuild_indexes(model: dict[str, Any]) -> None:
    group_ids = {str(group.get("id")) for group in model.get("groups", [])}
    group_tree: dict[str | None, list[str]] = {}
    task_children: dict[str | None, list[str]] = {}
    for group in model.get("groups", []):
        parent = group.get("parent_group_id") if group.get("parent_group_id") in group_ids else None
        group["parent_group_id"] = parent
        group_tree.setdefault(parent, []).append(str(group["id"]))
    for task in model.get("tasks", []):
        parent = task.get("group_id") if task.get("group_id") in group_ids else None
        task["group_id"] = parent
        task_children.setdefault(parent, []).append(str(task["id"]))
    model["group_tree"] = group_tree
    model["task_children"] = task_children
    model["document_order"] = [str(node["id"]) for bucket in ("groups", "tasks") for node in model.get(bucket, [])]


def _merge_review_level(base: dict[str, Any], head: dict[str, Any]) -> dict[str, int]:
    before_nodes = _node_map(base)
    after_nodes = _node_map(head)
    before_edges = _edge_map(base)
    after_edges = _edge_map(head)
    incident: dict[str, list[dict[str, Any]]] = {}
    counts = {"added": 0, "modified": 0, "removed": 0}

    for edge_key in sorted(before_edges.keys() | after_edges.keys()):
        before = before_edges.get(edge_key)
        after = after_edges.get(edge_key)
        fields: list[dict[str, Any]] = []
        if before is None:
            change, record = "added", after
        elif after is None:
            change, record = "removed", before
            removed = copy.deepcopy(before)
            removed["__kg_review_change__"] = "removed"
            head.setdefault("dependency_edges", []).append(removed)
        else:
            fields = _field_changes(before, after, _EDGE_IGNORED_FIELDS | {"id"})
            change, record = ("modified", after) if fields else ("unchanged", after)
        if record is None:
            continue
        # Nodes carry this state unconditionally. Edges skipping "unchanged" left
        # the renderer unable to recede them behind the changed topology.
        if after is not None:
            after["__kg_review_change__"] = change
        if change != "unchanged":
            statement = _edge_statement(record, change, fields)
            affected_nodes = {statement["source"], statement["target"]}
            if before is not None:
                affected_nodes.update((str(before.get("source") or ""), str(before.get("target") or "")))
            for node_id in affected_nodes - {""}:
                incident.setdefault(node_id, []).append(statement)

    for node_id in sorted(before_nodes.keys() | after_nodes.keys()):
        before_entry = before_nodes.get(node_id)
        after_entry = after_nodes.get(node_id)
        fields: list[dict[str, Any]] = []
        if before_entry is None:
            change = "added"
            assert after_entry is not None
            target = after_entry[1]
        elif after_entry is None:
            change = "removed"
            bucket, before = before_entry
            target = copy.deepcopy(before)
            head.setdefault(bucket, []).append(target)
        else:
            fields = _field_changes(before_entry[1], after_entry[1], _NODE_IGNORED_FIELDS)
            change = "modified" if fields or incident.get(node_id) else "unchanged"
            target = after_entry[1]
        target["__kg_review_change__"] = change
        target["__kg_review__"] = {"change": change, "fields": fields, "edges": incident.get(node_id, [])}
        if change in counts:
            counts[change] += 1

    _rebuild_indexes(head)
    counts["total"] = counts["added"] + counts["modified"] + counts["removed"]
    return counts


def build_git_state(schema_path: Path, *, ref: str, context_id: str = "") -> tuple[dict[str, Any], dict[str, Any]]:
    """One revision with nothing to compare: Review without Diff."""
    model, context = _head_side(schema_path, ref, context_id)
    model["kg_schema"] = str(schema_path)
    model["kg_revision"] = {"ref": ref, "context": context}
    return model, build_collapsed_graph(model)


def build_git_review(
    schema_path: Path,
    *,
    base_ref: str,
    head_ref: str,
    context_id: str = "",
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Compile and compare two complete pack revisions."""
    head, context = _head_side(schema_path, head_ref, context_id)
    base, base_absent = _base_side(schema_path, base_ref, context)
    review = copy.deepcopy(head)
    counts = _merge_review_level(base, review)

    base_projections = base.get("projection_models", {})
    head_projections = review.get("projection_models", {})
    projection_configs = {str(item.get("id")): item for item in review.get("view_projections", []) if item.get("id")}
    for item in base.get("view_projections", []):
        projection_id = str(item.get("id") or "")
        if projection_id and projection_id not in projection_configs:
            removed_config = copy.deepcopy(item)
            review.setdefault("view_projections", []).append(removed_config)
            projection_configs[projection_id] = removed_config
    view_counts: dict[str, dict[str, int]] = {"": counts}
    for projection_id in sorted(set(base_projections) | set(head_projections)):
        before_entry = base_projections.get(projection_id)
        after_entry = head_projections.get(projection_id)
        if after_entry is None and before_entry is not None:
            after_entry = copy.deepcopy(before_entry)
            head_projections[projection_id] = after_entry
        if after_entry is None:
            continue
        if before_entry is None:
            empty = {"groups": [], "tasks": [], "dependency_edges": []}
            projection_counts = _merge_review_level(empty, after_entry["model"])
        else:
            projection_counts = _merge_review_level(before_entry["model"], after_entry["model"])
        after_entry["graph"] = build_collapsed_graph(after_entry["model"])
        view_counts[projection_id] = projection_counts
        if projection_id in projection_configs:
            projection_configs[projection_id]["kg_review_counts"] = projection_counts

    review["kg_schema"] = str(schema_path)
    review["kg_review"] = {
        "base": base_ref,
        "head": head_ref,
        "context": context,
        "base_context_absent": base_absent,
        "counts": counts,
        "view_counts": view_counts,
    }
    return review, build_collapsed_graph(review)
