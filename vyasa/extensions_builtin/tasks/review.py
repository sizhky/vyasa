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
from .projections import build_projection_model


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


def _base_side(schema_path: Path, ref: str, context_id: str) -> tuple[dict[str, Any], str]:
    """One context is held across both revisions when the base has it.

    A context the base never had is not an empty graph. Contexts in one pack
    share the node and edge definitions, so the records a new context selects
    are mostly records the base already held. Comparing against nothing called
    every one of them added, so the base falls back to the context it does have
    and the caller names both."""
    model = _compile_ref_model(schema_path, ref)
    resolved = str(model.get("kg_context", {}).get("id") or "")
    if not context_id or context_id not in _context_ids(model):
        return model, resolved
    if resolved != context_id:
        model = _compile_ref_model(schema_path, ref, context_id)
    return model, context_id


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


def _same_value(left: Any, right: Any) -> bool:
    """A blank field and an absent field read the same, so they compare equal.
    One compiler path stamps every node with an empty attribute and another
    leaves it unset, which otherwise reports a change the reader cannot see."""
    if left == right:
        return True
    return left in (None, "") and right in (None, "")


def _field_changes(before: dict[str, Any], after: dict[str, Any], ignored: set[str]) -> list[dict[str, Any]]:
    left = _public_record(before, ignored)
    right = _public_record(after, ignored)
    changes: list[dict[str, Any]] = []
    for field in sorted((left.keys() | right.keys()) - {"id"}):
        if _same_value(left.get(field), right.get(field)):
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


def _incident_node_ids(statement: dict[str, Any], before: dict[str, Any] | None) -> set[str]:
    """Both endpoints on both sides, because a re-pointed edge touches all of them."""
    ids = {statement["source"], statement["target"]}
    if before is not None:
        ids.update((str(before.get("source") or ""), str(before.get("target") or "")))
    return ids - {""}


def _merge_edges(base: dict[str, Any], head: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """Mark every edge, keep removed ones as ghosts, and collect the changed
    statements incident to each node."""
    before_edges = _edge_map(base)
    after_edges = _edge_map(head)
    incident: dict[str, list[dict[str, Any]]] = {}
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
            removed["__kg_review__"] = {"change": "removed", "fields": []}
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
            after["__kg_review__"] = {"change": change, "fields": fields}
        if change == "unchanged":
            continue
        statement = _edge_statement(record, change, fields)
        for node_id in _incident_node_ids(statement, before):
            incident.setdefault(node_id, []).append(statement)
    return incident


def _merge_nodes(
    base: dict[str, Any],
    head: dict[str, Any],
    incident: dict[str, list[dict[str, Any]]],
) -> dict[str, int]:
    """Mark every node against its own fields and the edges that moved around it."""
    before_nodes = _node_map(base)
    after_nodes = _node_map(head)
    counts = {"added": 0, "modified": 0, "removed": 0}
    for node_id in sorted(before_nodes.keys() | after_nodes.keys()):
        before_entry = before_nodes.get(node_id)
        after_entry = after_nodes.get(node_id)
        fields: list[dict[str, Any]] = []
        if before_entry is None:
            assert after_entry is not None
            change, target = "added", after_entry[1]
        elif after_entry is None:
            bucket, before = before_entry
            change, target = "removed", copy.deepcopy(before)
            head.setdefault(bucket, []).append(target)
        else:
            fields = _field_changes(before_entry[1], after_entry[1], _NODE_IGNORED_FIELDS)
            change = "modified" if fields or incident.get(node_id) else "unchanged"
            target = after_entry[1]
        target["__kg_review_change__"] = change
        target["__kg_review__"] = {"change": change, "fields": fields, "edges": incident.get(node_id, [])}
        if change in counts:
            counts[change] += 1
    return counts


def _merge_review_level(base: dict[str, Any], head: dict[str, Any]) -> dict[str, int]:
    """Mark one graph level in place against its base and count what changed."""
    counts = _merge_nodes(base, head, _merge_edges(base, head))
    _rebuild_indexes(head)
    counts["total"] = counts["added"] + counts["modified"] + counts["removed"]
    return counts


def build_git_state(schema_path: Path, *, ref: str, context_id: str = "") -> tuple[dict[str, Any], dict[str, Any]]:
    """One revision with nothing to compare: Review without Diff."""
    model, context = _head_side(schema_path, ref, context_id)
    model["kg_schema"] = str(schema_path)
    model["kg_revision"] = {"ref": ref, "context": context}
    return model, build_collapsed_graph(model)


def _merge_projection_configs(base: dict[str, Any], review: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Every view either revision offers, keyed by id and carried on the review."""
    configs = {str(item.get("id")): item for item in review.get("view_projections", []) if item.get("id")}
    for item in base.get("view_projections", []):
        projection_id = str(item.get("id") or "")
        if projection_id and projection_id not in configs:
            removed = copy.deepcopy(item)
            review.setdefault("view_projections", []).append(removed)
            configs[projection_id] = removed
    return configs


def _projection_base_model(
    base: dict[str, Any],
    before_entry: dict[str, Any] | None,
    config: dict[str, Any] | None,
) -> dict[str, Any]:
    """A view added at head still shows records the base already had, so project
    the base data through that view rather than comparing it against nothing."""
    if before_entry is not None:
        return before_entry["model"]
    return build_projection_model(base, config) if config else _empty_side()


def _merge_projections(base: dict[str, Any], review: dict[str, Any]) -> dict[str, dict[str, int]]:
    """Compare every view between the two revisions and return each view's counts."""
    base_projections = base.get("projection_models", {})
    head_projections = review.get("projection_models", {})
    configs = _merge_projection_configs(base, review)
    view_counts: dict[str, dict[str, int]] = {}
    for projection_id in sorted(set(base_projections) | set(head_projections)):
        before_entry = base_projections.get(projection_id)
        after_entry = head_projections.get(projection_id)
        if after_entry is None:
            if before_entry is None:
                continue
            after_entry = copy.deepcopy(before_entry)
            head_projections[projection_id] = after_entry
        before_model = _projection_base_model(base, before_entry, configs.get(projection_id))
        counts = _merge_review_level(before_model, after_entry["model"])
        after_entry["graph"] = build_collapsed_graph(after_entry["model"])
        view_counts[projection_id] = counts
        if projection_id in configs:
            configs[projection_id]["kg_review_counts"] = counts
    return view_counts


def build_git_review(
    schema_path: Path,
    *,
    base_ref: str,
    head_ref: str,
    context_id: str = "",
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Compile and compare two complete pack revisions."""
    head, context = _head_side(schema_path, head_ref, context_id)
    base, base_context = _base_side(schema_path, base_ref, context)
    review = copy.deepcopy(head)
    counts = _merge_review_level(base, review)
    review["kg_schema"] = str(schema_path)
    review["kg_review"] = {
        "base": base_ref,
        "head": head_ref,
        "context": context,
        "base_context": base_context,
        "counts": counts,
        "view_counts": {"": counts, **_merge_projections(base, review)},
    }
    return review, build_collapsed_graph(review)
