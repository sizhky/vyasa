from collections import defaultdict
from pathlib import Path

import yaml


def _extract_tasks_payload(text: str) -> dict:
    if "```tasks" in text:
        body = text.split("```tasks", 1)[1].split("```", 1)[0]
        return yaml.safe_load(body) or {}
    if "```yaml" in text:
        body = text.split("```yaml", 1)[1].split("```", 1)[0]
        payload = yaml.safe_load(body) or {}
        return payload.get("graph", payload)
    raise ValueError("No tasks payload found")


def parse_tasks_text(text: str) -> dict:
    graph = _extract_tasks_payload(text)
    groups = graph.get("groups", [])
    tasks = graph.get("tasks", [])
    edges = [{"source": dep, "target": task["id"]} for task in tasks for dep in task.get("depends_on", [])]
    group_tree = defaultdict(list)
    task_children = defaultdict(list)
    for group in groups:
        group_tree[group.get("parent_group_id")].append(group["id"])
    for task in tasks:
        task_children[task.get("group_id")].append(task["id"])
    return {
        "graph_id": graph["id"],
        "title": graph.get("title", ""),
        "groups": groups,
        "tasks": tasks,
        "dependency_edges": edges,
        "group_tree": dict(group_tree),
        "task_children": dict(task_children),
        "document_order": [g["id"] for g in groups] + [t["id"] for t in tasks],
        "frozen": graph.get("frozen", {}),
    }


def parse_tasks_model(markdown_path: str | Path) -> dict:
    text = Path(markdown_path).read_text(encoding="utf-8")
    return parse_tasks_text(text)
