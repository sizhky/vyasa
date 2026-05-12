from collections import deque


def build_collapsed_graph(model: dict) -> dict:
    group_tree = model["group_tree"]
    task_children = model["task_children"]
    nodes = []
    task_to_group = {task["id"]: task.get("group_id") for task in model["tasks"]}
    group_parent = {group["id"]: group.get("parent_group_id") for group in model["groups"]}
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
            "href": group.get("href"),
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
                "href": task.get("href"),
                "kind": "task",
                "collapsed": True,
                "x": 80,
                "y": 80,
                "width": 220,
                "height": 60,
            })

    def collapsed_owner(task_id: str) -> str:
        cur = task_to_group.get(task_id)
        owner = None
        while cur is not None:
            owner = cur
            cur = group_parent.get(cur)
        return owner or task_id

    for edge in model["dependency_edges"]:
        src = collapsed_owner(edge["source"])
        dst = collapsed_owner(edge["target"])
        if src != dst and (src, dst) not in seen_edges:
            seen_edges.add((src, dst))
            collapsed_edge = {"source": src, "target": dst, "kind": "collapsed-proxy"}
            if edge.get("label"):
                collapsed_edge["label"] = edge["label"]
            edges.append(collapsed_edge)

    return {"nodes": nodes, "edges": edges}
