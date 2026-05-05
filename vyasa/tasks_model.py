from collections import defaultdict
from pathlib import Path


_ATTR_KEYS = {
    "depends",
    "depends_on",
    "estimate",
    "group",
    "group_id",
    "owner",
    "parent",
    "parent_group",
    "parent_group_id",
    "phase",
    "points",
    "priority",
}


def _extract_tasks_body(text: str) -> str:
    if "```tasks" in text:
        return text.split("```tasks", 1)[1].split("```", 1)[0]
    raise ValueError("No tasks payload found")


def _parse_terse_tasks(body: str) -> dict:
    graph = {"groups": [], "tasks": []}
    stack: list[dict] = []
    current_task = None
    current_task_indent = -1

    def pop_to(indent: int) -> None:
        while stack and indent <= stack[-1]["indent"]:
            stack.pop()

    def current_group_id() -> str | None:
        for item in reversed(stack):
            if item["kind"] == "group":
                return item["id"]
        return None

    for raw_line in body.splitlines():
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        line = raw_line.strip()
        keyword = line.split(None, 1)[0]

        if keyword in {"id", "title"} and indent == 0:
            parts = line.split(None, 1)
            graph[keyword] = parts[1] if len(parts) > 1 else ""
            continue

        if keyword in {"group", "task"}:
            pop_to(indent)
            tokens = line.split()
            if len(tokens) < 2:
                continue
            item_id = tokens[1]
            label = " ".join(tokens[2:]) if len(tokens) > 2 else ""
            if keyword == "group":
                item = {
                    "id": item_id,
                    "label": label,
                    "parent_group_id": current_group_id(),
                }
                graph["groups"].append(item)
                stack.append({"kind": "group", "id": item_id, "indent": indent})
                current_task = None
                current_task_indent = -1
            else:
                item = {
                    "id": item_id,
                    "label": label,
                    "group_id": current_group_id(),
                }
                graph["tasks"].append(item)
                stack.append({"kind": "task", "id": item_id, "indent": indent})
                current_task = item
                current_task_indent = indent
            continue

        if current_task is not None and indent > current_task_indent:
            parts = line.split()
            key = parts[0]
            value = " ".join(parts[1:]) if len(parts) > 1 else ""
            if key in {"depends", "depends_on"}:
                deps = [token for token in parts[1:] if token]
                if deps:
                    current_task.setdefault("depends_on", []).extend(deps)
            elif key in {"group", "group_id"} and value:
                current_task["group_id"] = value
            elif key == "owner" and value:
                current_task["owner"] = value
            elif key == "estimate" and value:
                current_task["estimate"] = value
            elif key == "priority" and value:
                current_task["priority"] = value
            elif key == "points" and value:
                current_task["points"] = value
            elif key == "phase" and value:
                current_task["phase"] = value
            elif key in {"parent", "parent_group", "parent_group_id"} and value:
                current_task["parent_group_id"] = value
            elif key in {"label", "name"} and value:
                current_task["label"] = value
            continue

    return graph


def parse_tasks_text(text: str) -> dict:
    body = _extract_tasks_body(text)
    graph = _parse_terse_tasks(body)
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
