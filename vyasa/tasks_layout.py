from collections import deque


def build_collapsed_graph(model: dict) -> dict:
    group_tree = model["group_tree"]
    task_children = model["task_children"]
    nodes = []
    task_to_group = {task["id"]: task.get("group_id") for task in model["tasks"]}
    edges = []
    seen_edges = set()

    order = []
    queue = deque(group_tree.get(None, []))
    while queue:
        group_id = queue.popleft()
        order.append(group_id)
        queue.extend(group_tree.get(group_id, []))

    for idx, group_id in enumerate(order):
        group = next(g for g in model["groups"] if g["id"] == group_id)
        child_groups = group_tree.get(group_id, [])
        child_tasks = task_children.get(group_id, [])
        nodes.append({
            "id": group_id,
            "label": group["label"],
            "kind": "group",
            "collapsed": True,
            "x": 80 + (idx % 3) * 280,
            "y": 80 + (idx // 3) * 140,
            "width": 250,
            "height": 80,
            "child_group_ids": child_groups,
            "child_task_ids": child_tasks,
        })

    for task in model["tasks"]:
        if task.get("group_id") is None:
            nodes.append({
                "id": task["id"],
                "label": task["label"],
                "kind": "task",
                "collapsed": True,
                "x": 80,
                "y": 80,
                "width": 220,
                "height": 60,
            })

    for edge in model["dependency_edges"]:
        src = task_to_group.get(edge["source"]) or edge["source"]
        dst = task_to_group.get(edge["target"]) or edge["target"]
        if src != dst and (src, dst) not in seen_edges:
            seen_edges.add((src, dst))
            edges.append({"source": src, "target": dst, "kind": "collapsed-proxy"})

    return {"nodes": nodes, "edges": edges}
