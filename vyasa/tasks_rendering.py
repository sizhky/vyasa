import html
import json
import re
import textwrap
from dataclasses import dataclass, field
from pathlib import Path

from fasthtml.common import Div, H1, NotStr, P, Script


@dataclass
class TaskItem:
    id: str
    title: str
    attrs: dict[str, str] = field(default_factory=dict)
    group_id: str | None = None


@dataclass
class TaskGroup:
    id: str
    title: str
    tasks: list["TaskItem"] = field(default_factory=list)
    attrs: dict[str, str] = field(default_factory=dict)
    parent_group_id: str | None = None


TASK_RE = re.compile(r'^\s*task\s+(\S+)\s+"([^"]+)"\s*$')
GROUP_RE = re.compile(r'^\s*group\s+(\S+)\s+"([^"]+)"\s*$')
GROUP_END_RE = re.compile(r'^\s*end\s*$')
CHAIN_RE = re.compile(r"^\s*chain\s+(\S+)\s*$")
ATTR_RE = re.compile(r"^\s+([a-zA-Z_][\w-]*)\s*:\s*(.*?)\s*$")
ESTIMATE_RE = re.compile(r"^\s*(\d+)\s*d\s*$", re.IGNORECASE)
TASKS_FENCE_RE = re.compile(r"(?ms)^(?P<fence>`{3,}|~{3,})tasks(?P<info>[^\n]*)\n(?P<body>.*?)(?:\n(?P=fence))[ \t]*$")
TASKS_BLOCK_FRONTMATTER_RE = re.compile(r"(?s)\A(?P<frontmatter>---\s*\n.*?\n---\s*\n?)(?P<body>.*)\Z")
CRITICAL_TASK_ATTRS = ("estimate", "owner", "phase", "priority")


def parse_tasks_text(text: str) -> list[TaskItem]:
    tasks: list[TaskItem] = []
    current: TaskItem | None = None
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        task_match = TASK_RE.match(line)
        if task_match:
            current = TaskItem(task_match.group(1), html.unescape(task_match.group(2)))
            tasks.append(current)
            continue
        attr_match = ATTR_RE.match(line)
        if current and attr_match:
            current.attrs[attr_match.group(1).lower()] = attr_match.group(2).strip()
    return tasks


def parse_tasks_document_text(text: str) -> tuple[list[TaskItem], dict[str, list[str]], list[TaskGroup]]:
    tasks: list[TaskItem] = []
    chains: dict[str, list[str]] = {}
    groups: list[TaskGroup] = []
    current: TaskItem | None = None
    current_chain: str | None = None
    group_stack: list[TaskGroup] = []
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        group_match = GROUP_RE.match(line)
        if group_match:
            parent_group_id = group_stack[-1].id if group_stack else None
            current_group = TaskGroup(group_match.group(1), html.unescape(group_match.group(2)), parent_group_id=parent_group_id)
            groups.append(current_group)
            group_stack.append(current_group)
            current = None
            current_chain = None
            continue
        if group_stack and GROUP_END_RE.match(line):
            group_stack.pop()
            current = None
            continue
        task_match = TASK_RE.match(line)
        if task_match:
            current_group = group_stack[-1] if group_stack else None
            current = TaskItem(task_match.group(1), html.unescape(task_match.group(2)), group_id=current_group.id if current_group else None)
            if current_group:
                current_group.tasks.append(current)
            tasks.append(current)
            current_chain = None
            continue
        chain_match = CHAIN_RE.match(line)
        if chain_match:
            current = None
            current_chain = chain_match.group(1)
            chains.setdefault(current_chain, [])
            continue
        attr_match = ATTR_RE.match(line)
        if attr_match:
            key, value = attr_match.group(1).lower(), attr_match.group(2).strip()
            if current:
                current.attrs[key] = value
            elif group_stack and not current_chain:
                current_group = group_stack[-1]
                current_group.attrs[key] = value
            continue
        if current_chain and "->" in line:
            chains[current_chain].extend(part.strip() for part in line.split("->") if part.strip())
    return tasks, chains, groups

def serialize_tasks_document(tasks: list[TaskItem], chains: dict[str, list[str]], groups: list[TaskGroup] | None = None) -> str:
    lines: list[str] = []
    task_map = {t.id: t for t in tasks}
    groups = groups or []
    children_by_group: dict[str | None, list[TaskGroup]] = {}
    for group in groups:
        children_by_group.setdefault(group.parent_group_id, []).append(group)

    def emit_task(task: TaskItem, indent: int) -> None:
        pad = "  " * indent
        lines.append(f'{pad}task {task.id} "{task.title}"')
        for key, value in task.attrs.items():
            lines.append(f"{pad}  {key}: {value}")

    def emit_group(group: TaskGroup, indent: int = 0) -> None:
        pad = "  " * indent
        lines.append(f'{pad}group {group.id} "{group.title}"')
        for key, value in group.attrs.items():
            lines.append(f"{pad}  {key}: {value}")
        for gt in group.tasks:
            if gt.id in task_map:
                emit_task(gt, indent + 1)
        for child in children_by_group.get(group.id, []):
            emit_group(child, indent + 1)
        lines.append(f"{pad}end")

    emitted_groups: set[str] = set()
    for group in children_by_group.get(None, []):
        emit_group(group)
        emitted_groups.add(group.id)
        lines.append("")

    for task in tasks:
        if task.group_id:
            continue
        emit_task(task, 0)
        lines.append("")
    for name, ids in chains.items():
        lines.append(f"chain {name}")
        lines.append(f"  {' -> '.join(ids)}" if ids else "  ")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def apply_chain_dependencies_to_tasks(tasks: list[TaskItem], chains: dict[str, list[str]]) -> None:
    chain_deps = chain_dependencies(chains)
    for task in tasks:
        deps = chain_deps.get(task.id, [])
        if deps:
            task.attrs["depends_on"] = "[" + ", ".join(deps) + "]"
        elif "depends_on" in task.attrs:
            task.attrs["depends_on"] = "[]"

def tasks_payload_text(text: str) -> dict:
    tasks, chains, groups = parse_tasks_document_text(text)
    return {
        "tasks": [{"id": task.id, "title": task.title, "attrs": task.attrs, "group_id": task.group_id} for task in tasks],
        "chains": chains,
        "groups": [{"id": g.id, "title": g.title, "attrs": g.attrs, "task_ids": [t.id for t in g.tasks], "parent_group_id": g.parent_group_id} for g in groups],
    }


def payload_to_tasks_document(payload: dict) -> tuple[list[TaskItem], dict[str, list[str]], list[TaskGroup]]:
    raw_tasks = payload.get("tasks", [])
    raw_chains = payload.get("chains", {})
    raw_groups = payload.get("groups", [])
    tasks = [
        TaskItem(
            str(item.get("id", "")).strip(),
            str(item.get("title", "")).strip(),
            {str(k): str(v) for k, v in dict(item.get("attrs", {})).items()},
            group_id=str(item["group_id"]).strip() if item.get("group_id") else None,
        )
        for item in raw_tasks
        if isinstance(item, dict) and str(item.get("id", "")).strip()
    ]
    chains = {
        str(name): [str(task_id) for task_id in ids if str(task_id).strip()]
        for name, ids in raw_chains.items()
        if isinstance(ids, list)
    } if isinstance(raw_chains, dict) else {}
    task_map = {t.id: t for t in tasks}
    groups: list[TaskGroup] = []
    if isinstance(raw_groups, list):
        for item in raw_groups:
            if not isinstance(item, dict):
                continue
            gid = str(item.get("id", "")).strip()
            gtitle = str(item.get("title", "")).strip()
            if not gid:
                continue
            gattrs = {str(k): str(v) for k, v in dict(item.get("attrs", {})).items()}
            gtasks = [task_map[tid] for tid in item.get("task_ids", []) if tid in task_map]
            parent_group_id = str(item["parent_group_id"]).strip() if item.get("parent_group_id") else None
            groups.append(TaskGroup(gid, gtitle, gtasks, gattrs, parent_group_id))
    return tasks, chains, groups


def missing_critical_task_attrs(task: TaskItem) -> list[str]:
    return [key for key in CRITICAL_TASK_ATTRS if not str(task.attrs.get(key, "")).strip()]

def list_tasks_fence_blocks(markdown: str) -> list[re.Match[str]]:
    return list(TASKS_FENCE_RE.finditer(markdown))


def split_tasks_block_frontmatter(body: str) -> tuple[str, str]:
    match = TASKS_BLOCK_FRONTMATTER_RE.match(body)
    if not match:
        return "", body
    return match.group("frontmatter"), match.group("body")


def tasks_fence_payload(path: Path, block_index: int) -> dict:
    matches = list_tasks_fence_blocks(path.read_text(encoding="utf-8"))
    if block_index < 0 or block_index >= len(matches):
        raise IndexError(block_index)
    return tasks_payload_text(matches[block_index].group("body"))


def write_tasks_fence_payload(path: Path, block_index: int, payload: dict) -> None:
    markdown = path.read_text(encoding="utf-8")
    matches = list_tasks_fence_blocks(markdown)
    if block_index < 0 or block_index >= len(matches):
        raise IndexError(block_index)
    match = matches[block_index]
    tasks, chains, groups = payload_to_tasks_document(payload)
    frontmatter, _ = split_tasks_block_frontmatter(match.group("body"))
    serialized = serialize_tasks_document(tasks, chains, groups).rstrip()
    replacement = f'{match.group("fence")}tasks{match.group("info")}\n{frontmatter}{serialized}\n{match.group("fence")}'
    path.write_text(markdown[:match.start()] + replacement + markdown[match.end():], encoding="utf-8")


def chain_dependencies(chains: dict[str, list[str]]) -> dict[str, list[str]]:
    deps: dict[str, list[str]] = {}
    for ids in chains.values():
        for before, after in zip(ids, ids[1:]):
            deps.setdefault(after, []).append(before)
    return deps


def parse_dependency_ids(value: str) -> list[str]:
    text = (value or "").strip()
    if text.startswith("[") and text.endswith("]"):
        text = text[1:-1]
    return [part.strip() for part in text.split(",") if part.strip()]


def validate_task_dependencies(tasks: list[TaskItem], chains: dict[str, list[str]] | None = None) -> list[str]:
    ids = {task.id for task in tasks}
    warnings: list[str] = []
    chain_deps = chain_dependencies(chains or {})
    graph = {task.id: [*parse_dependency_ids(task.attrs.get("depends_on", "")), *chain_deps.get(task.id, [])] for task in tasks}
    for task_id, deps in graph.items():
        for dep in deps:
            if dep not in ids:
                warnings.append(f"{task_id} depends on missing task {dep}")
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(task_id: str, chain: list[str]):
        if task_id in visiting:
            start = chain.index(task_id) if task_id in chain else 0
            warnings.append("Circular dependency: " + " -> ".join(chain[start:]))
            return
        if task_id in visited:
            return
        visiting.add(task_id)
        for dep in graph.get(task_id, []):
            if dep in ids:
                visit(dep, [*chain, dep])
        visiting.remove(task_id)
        visited.add(task_id)

    for task in tasks:
        visit(task.id, [task.id])
    return warnings


def parse_estimate_days(value: str) -> int | None:
    match = ESTIMATE_RE.match(value or "")
    return int(match.group(1)) if match else None


def build_task_schedule(tasks: list[TaskItem], chains: dict[str, list[str]] | None = None) -> tuple[dict[str, tuple[int, int]], list[str], set[str]]:
    task_by_id = {task.id: task for task in tasks}
    chain_deps = chain_dependencies(chains or {})
    graph = {task.id: [dep for dep in [*parse_dependency_ids(task.attrs.get("depends_on", "")), *chain_deps.get(task.id, [])] if dep in task_by_id] for task in tasks}
    warnings: list[str] = []
    memo: dict[str, tuple[int, int]] = {}
    critical_memo: dict[str, tuple[int, tuple[str, ...]]] = {}

    def duration(task: TaskItem) -> int:
        days = parse_estimate_days(task.attrs.get("estimate", ""))
        if days is None:
            warnings.append(f"{task.id} has missing or invalid estimate")
            return 1
        return max(days, 1)

    def schedule(task_id: str, stack: set[str] | None = None) -> tuple[int, int]:
        if task_id in memo:
            return memo[task_id]
        if stack and task_id in stack:
            memo[task_id] = (1, duration(task_by_id[task_id]))
            return memo[task_id]
        next_stack = {*stack, task_id} if stack else {task_id}
        dep_ends = [schedule(dep, next_stack)[1] for dep in graph.get(task_id, [])]
        start = (max(dep_ends) + 1) if dep_ends else 1
        end = start + duration(task_by_id[task_id]) - 1
        memo[task_id] = (start, end)
        return memo[task_id]

    def critical(task_id: str, stack: set[str] | None = None) -> tuple[int, tuple[str, ...]]:
        if task_id in critical_memo:
            return critical_memo[task_id]
        if stack and task_id in stack:
            return (0, ())
        next_stack = {*stack, task_id} if stack else {task_id}
        task_duration = duration(task_by_id[task_id])
        dep_paths = [critical(dep, next_stack) for dep in graph.get(task_id, [])]
        best = max(dep_paths, default=(0, ()), key=lambda item: item[0])
        result = (best[0] + task_duration, (*best[1], task_id))
        critical_memo[task_id] = result
        return result

    for task in tasks:
        schedule(task.id)
    critical_path = set(max((critical(task.id) for task in tasks), default=(0, ()), key=lambda item: item[0])[1])
    return memo, warnings, critical_path


def validate_owner_overlaps(tasks: list[TaskItem], schedule: dict[str, tuple[int, int]]) -> list[str]:
    warnings: list[str] = []
    by_owner: dict[str, list[TaskItem]] = {}
    for task in tasks:
        by_owner.setdefault(task.attrs.get("owner", "Unassigned"), []).append(task)
    for owner, owner_tasks in by_owner.items():
        ordered = sorted(owner_tasks, key=lambda task: schedule.get(task.id, (1, 1)))
        for left, right in zip(ordered, ordered[1:]):
            left_start, left_end = schedule.get(left.id, (1, 1))
            right_start, right_end = schedule.get(right.id, (1, 1))
            if right_start <= left_end:
                warnings.append(f"{owner} overlap: {left.id} D{left_start}-D{left_end} conflicts with {right.id} D{right_start}-D{right_end}")
    return warnings


def _chip(label: str, value: str) -> str:
    return f'<span class="rounded border border-slate-200 px-2 py-0.5 text-[11px] dark:border-slate-700"><b>{html.escape(label)}</b> {html.escape(value)}</span>'


def _build_order(task_id: str, tasks: list[TaskItem], chains: dict[str, list[str]]) -> list[str]:
    task_lookup = {task.id: task for task in tasks}
    chain_deps = chain_dependencies(chains)
    seen: set[str] = set()
    order: list[str] = []

    def walk(current_id: str, stack: set[str]) -> None:
        if current_id in stack:
            return
        task = task_lookup.get(current_id)
        if not task:
            return
        next_stack = {*stack, current_id}
        direct = [*parse_dependency_ids(task.attrs.get("depends_on", "")), *chain_deps.get(current_id, [])]
        for dep in direct:
            if dep in seen:
                continue
            walk(dep, next_stack)
            if dep not in seen:
                seen.add(dep)
                order.append(dep)

    walk(task_id, set())
    return order


def _task_dependency_edges(tasks: list[TaskItem], chains: dict[str, list[str]]) -> list[tuple[str, str]]:
    chain_deps = chain_dependencies(chains)
    edges: list[tuple[str, str]] = []
    for task in tasks:
        deps = [*parse_dependency_ids(task.attrs.get("depends_on", "")), *chain_deps.get(task.id, [])]
        edges.extend((dep, task.id) for dep in deps)
    return list(dict.fromkeys(edges))


def _parse_graph_int(value: str | None) -> int | None:
    try:
        return int(str(value).strip()) if value is not None and str(value).strip() else None
    except (TypeError, ValueError):
        return None


def _estimate_collapsed_group_size(title: str) -> tuple[int, int]:
    min_w, max_w = 260, 460
    side_pad, badge_w = 56, 88
    line_h, top_bottom_pad = 26, 28
    width = max(min_w, min(max_w, len(title) * 8 + side_pad + badge_w))
    text_w = max(16, int((width - side_pad - badge_w) / 8))
    lines = max(1, len(textwrap.wrap(title, width=text_w, break_long_words=False, break_on_hyphens=False)))
    height = max(88, lines * line_h + top_bottom_pad)
    return width, height


def _render_tasks_board(tasks: list[TaskItem], chains: dict[str, list[str]], groups: list[TaskGroup], title: str, *, task_api_url: str | None = None, show_heading: bool = True, width: str = "95vw", height: str = "70vh", direction: str = "lr"):
    warnings = validate_task_dependencies(tasks, chains)
    schedule, schedule_warnings, critical_path = build_task_schedule(tasks, chains)
    warnings.extend(schedule_warnings)
    warnings.extend(validate_owner_overlaps(tasks, schedule))
    preview_cards = []
    edges = _task_dependency_edges(tasks, chains)
    dependants_by_task: dict[str, list[str]] = {}
    for source, target in edges:
        dependants_by_task.setdefault(source, []).append(target)
    node_w, node_h, col_gap, row_gap = 320, 92, 112, 44
    is_td = direction.lower() == "td"
    columns: dict[int, list[TaskItem]] = {}
    for task in tasks:
        columns.setdefault(schedule.get(task.id, (1, 1))[0], []).append(task)
    max_rows = max((len(items) for items in columns.values()), default=1)
    graph_w = max(columns.keys(), default=1) * (node_w + col_gap) + 80
    graph_h = max_rows * (node_h + row_gap) + 80
    positions: dict[str, tuple[int, int]] = {}
    for start_day, items in sorted(columns.items()):
        for row, task in enumerate(items):
            if is_td:
                positions[task.id] = (
                    _parse_graph_int(task.attrs.get("graph_x")) or (40 + row * (node_w + col_gap)),
                    _parse_graph_int(task.attrs.get("graph_y")) or (40 + (start_day - 1) * (node_h + row_gap)),
                )
            else:
                positions[task.id] = (
                    _parse_graph_int(task.attrs.get("graph_x")) or (40 + (start_day - 1) * (node_w + col_gap)),
                    _parse_graph_int(task.attrs.get("graph_y")) or (40 + row * (node_h + row_gap)),
                )
    for index, task in enumerate(tasks, start=1):
        chips = "".join(
            _chip(k.replace("_", " "), v)
            for k, v in task.attrs.items()
            if k in {"priority", "points", "estimate", "depends_on", "owner", "phase"}
        )
        dependency_ids = parse_dependency_ids(task.attrs.get("depends_on", ""))
        dependency_chips = "".join(
            f'<button type="button" data-task-preview-trigger="{html.escape(dep)}" class="rounded border border-slate-200 px-2 py-0.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">{html.escape(dep)}</button>'
            for dep in dependency_ids
        ) or '<span class="text-slate-400">None</span>'
        dependant_chips = "".join(
            f'<button type="button" data-task-preview-trigger="{html.escape(dep)}" class="rounded border border-slate-200 px-2 py-0.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">{html.escape(dep)}</button>'
            for dep in dependants_by_task.get(task.id, [])
        ) or '<span class="text-slate-400">None</span>'
        start_day, end_day = schedule.get(task.id, (1, 1))
        timeline = f'D{start_day}' if start_day == end_day else f'D{start_day}-D{end_day}'
        preview_cards.append(
            f'<article data-task-preview="{html.escape(task.id)}" data-task-id="{html.escape(task.id)}" data-manual-deps="{html.escape(",".join(parse_dependency_ids(task.attrs.get("depends_on", ""))))}" data-task-title="{html.escape(task.title)}" data-task-attrs="{html.escape(json.dumps(task.attrs))}" data-task-dependencies="{html.escape(json.dumps(dependency_ids))}" data-task-dependants="{html.escape(json.dumps(dependants_by_task.get(task.id, [])))}" data-task-index="{index:02d}" data-task-schedule="{html.escape(timeline)}" data-task-critical="{"yes" if task.id in critical_path else "no"}" class="vyasa-task-card hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">'
            f'<div><div class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{html.escape(task.id)}</div>'
            f'<h2 class="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{html.escape(task.title)}</h2></div>'
            f'<div class="mt-4 flex flex-wrap gap-2">{chips}{_chip("schedule", timeline)}{_chip("critical", "yes" if task.id in critical_path else "no")}</div>'
            f'<div class="mt-5 text-sm text-slate-600 dark:text-slate-300"><b class="mb-2 block uppercase tracking-wide text-slate-500">Dependencies</b><div class="flex flex-wrap gap-2">{dependency_chips}</div><b class="mb-2 mt-4 block uppercase tracking-wide text-slate-500">Dependants</b><div class="flex flex-wrap gap-2">{dependant_chips}</div></div>'
            f'</article>'
        )
    group_padding = 24
    header_h = 40
    group_nodes = []
    child_groups_by_group: dict[str, list[TaskGroup]] = {}
    for group in groups:
        if group.parent_group_id:
            child_groups_by_group.setdefault(group.parent_group_id, []).append(group)

    def descendant_task_ids(group: TaskGroup) -> set[str]:
        ids = {t.id for t in group.tasks}
        for child in child_groups_by_group.get(group.id, []):
            ids.update(descendant_task_ids(child))
        return ids

    top_group_order = [g.id for g in groups if not g.parent_group_id]
    top_group_index = {gid: idx for idx, gid in enumerate(top_group_order)}
    for group in groups:
        child_ids = {t.id for t in group.tasks}
        all_child_ids = descendant_task_ids(group)
        child_group_ids = [g.id for g in child_groups_by_group.get(group.id, [])]
        if not all_child_ids and not child_group_ids:
            continue
        has_saved_positions = all(
            _parse_graph_int(t.attrs.get("graph_x")) is not None
            for t in tasks
            if t.id in all_child_ids
            if t.id in positions
        ) and _parse_graph_int(group.attrs.get("graph_x")) is not None
        if has_saved_positions:
            # child positions already relative to group origin
            rel_xs = [positions[tid][0] for tid in all_child_ids if tid in positions]
            rel_ys = [positions[tid][1] for tid in all_child_ids if tid in positions]
            if not rel_xs:
                continue
            gx = _parse_graph_int(group.attrs.get("graph_x"))
            gy = _parse_graph_int(group.attrs.get("graph_y"))
            gw = max(rel_xs) + node_w + group_padding
            gh = max(rel_ys) + node_h + group_padding
        else:
            # child positions are absolute canvas coords — compute group origin
            abs_xs = [positions[tid][0] for tid in all_child_ids if tid in positions]
            abs_ys = [positions[tid][1] for tid in all_child_ids if tid in positions]
            if not abs_xs:
                continue
            gx = min(abs_xs) - group_padding
            gy = min(abs_ys) - group_padding - header_h
            gw = max(abs_xs) - min(abs_xs) + node_w + group_padding * 2
            gh = max(abs_ys) - min(abs_ys) + node_h + group_padding * 2 + header_h
            for tid in all_child_ids:
                if tid in positions:
                    positions[tid] = (positions[tid][0] - gx, positions[tid][1] - gy)
        is_collapsed = True
        pill_x = _parse_graph_int(group.attrs.get("pill_x"))
        pill_y = _parse_graph_int(group.attrs.get("pill_y"))
        collapsed_w, collapsed_h = _estimate_collapsed_group_size(group.title)
        group_pill_gap = collapsed_h + 32
        if group.parent_group_id:
            parent_index = child_groups_by_group.get(group.parent_group_id, []).index(group)
            if pill_x is not None and pill_y is not None:
                node_pos = {"x": pill_x, "y": pill_y}
            elif is_td:
                node_pos = {"x": 40, "y": 40 + parent_index * group_pill_gap}
            else:
                node_pos = {"x": 40 + parent_index * (node_w + col_gap), "y": 40}
        elif is_collapsed and pill_x is not None:
            node_pos = {"x": pill_x, "y": pill_y}
            if abs(node_pos["x"]) > graph_w * 2 or abs(node_pos["y"]) > graph_h * 2:
                if is_td:
                    node_pos = {"x": 40, "y": 40 + top_group_index.get(group.id, 0) * group_pill_gap}
                else:
                    node_pos = {"x": 40 + top_group_index.get(group.id, 0) * (node_w + col_gap), "y": 40}
        else:
            if is_td:
                node_pos = {"x": 40, "y": 40 + top_group_index.get(group.id, 0) * group_pill_gap}
            else:
                node_pos = {"x": 40 + top_group_index.get(group.id, 0) * (node_w + col_gap), "y": 40}
        group_nodes.append({
            "id": group.id,
            "type": "group",
            "position": node_pos,
            "data": {"title": group.title, "task_ids": [t.id for t in group.tasks], "descendant_task_ids": sorted(all_child_ids), "child_group_ids": child_group_ids, "parent_group_id": group.parent_group_id, "has_saved_position": pill_x is not None and pill_y is not None, "collapsed": is_collapsed, "expanded_w": gw, "expanded_h": gh, "expanded_x": gx, "expanded_y": gy, "collapsed_w": collapsed_w, "collapsed_h": collapsed_h},
            "style": {"width": collapsed_w if is_collapsed else gw, "height": collapsed_h if is_collapsed else gh},
            "hidden": bool(group.parent_group_id),
        })
    rf_task_nodes = []
    for task in tasks:
        node: dict = {
            "id": task.id,
            "position": {"x": positions[task.id][0], "y": positions[task.id][1]},
            "data": {"title": task.title, "missing": missing_critical_task_attrs(task), "has_saved_position": _parse_graph_int(task.attrs.get("graph_x")) is not None and _parse_graph_int(task.attrs.get("graph_y")) is not None},
        }
        if task.group_id:
            node["parentId"] = task.group_id
        rf_task_nodes.append(node)
    graph_payload = {
        "nodes": [*group_nodes, *rf_task_nodes],
        "edges": [{"id": f"{source}->{target}", "source": source, "target": target} for source, target in edges],
    }
    warnings_html = "".join(f"<li>{html.escape(item)}</li>" for item in warnings)
    warnings_cls = "mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
    warnings_style = "" if warnings else "display:none;"
    # warnings_open = " open" if warnings else ""
    warnings_open = ""
    panel_style = f'width: {html.escape(width)}; position: relative; left: 50%; transform: translateX(-50%);' if "vw" in str(width).lower() else f'width: {html.escape(width)};'
    header_nodes = [H1(title, cls="vyasa-page-title text-4xl font-bold"), P(f"{len(tasks)} task{'s' if len(tasks) != 1 else ''}", cls="mt-2 text-slate-500")] if show_heading else []
    return Div(
        *header_nodes,
        NotStr(f'<section id="vyasa-task-region" data-task-api-url="{html.escape(task_api_url or "")}" data-task-graph="{html.escape(json.dumps(graph_payload))}" data-task-direction="{html.escape(direction.lower())}" class="mt-8 rounded-lg border border-slate-200 p-4 dark:border-slate-800" style="{panel_style}"><div class="flex items-center justify-between gap-4"><div><h2 class="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{html.escape(title)}</h2><p class="mt-1 text-xs text-slate-500">Drag cards. Connect right handle to left handle. Click card to edit. Click group to inspect tasks.</p></div></div><details id="vyasa-task-warnings" class="{warnings_cls} mt-2"{warnings_open} style="{warnings_style}"><summary class="cursor-pointer font-semibold">Dependency warnings</summary><ul class="mt-2 list-disc pl-5">{warnings_html}</ul></details><div class="relative mt-2"><div class="absolute right-2 top-2 z-10 flex gap-1 rounded bg-white/80 backdrop-blur-sm dark:bg-slate-800/80"><button type="button" id="vyasa-task-popout" class="rounded border px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700" title="Fullscreen">⛶</button></div><div id="vyasa-task-flow-host" class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50" style="height: {html.escape(height)};"></div></div><div id="vyasa-task-preview-store" class="hidden">{"".join(preview_cards)}</div><div id="vyasa-task-preview-modal" class="fixed inset-0 z-[9998] hidden items-center justify-center bg-slate-950/60 p-4"><div class="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"><div class="mb-3 flex items-center justify-between gap-4"><h2 class="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Task editor</h2><div class="flex items-center gap-2"><button id="vyasa-task-preview-save" type="button" class="rounded bg-blue-600 px-3 py-1 text-sm text-white">Save</button><button id="vyasa-task-preview-close" type="button" class="rounded border border-slate-200 px-3 py-1 text-sm dark:border-slate-700">Close</button></div></div><form id="vyasa-task-preview-form" class="space-y-4"><div id="vyasa-task-preview-body"></div></form><p id="vyasa-task-preview-status" class="mt-3 text-xs text-slate-500"></p></div></div></section>'),
        Script(r"""
(() => {
  const region = document.getElementById('vyasa-task-region');
  if (!region || region.dataset.bound === 'true') return;
  region.dataset.bound = 'true';
  const previewModal = region.querySelector('#vyasa-task-preview-modal');
  const previewBody = region.querySelector('#vyasa-task-preview-body');
  const previewStore = region.querySelector('#vyasa-task-preview-store');
  const previewStatus = region.querySelector('#vyasa-task-preview-status');
  const flowHost = region.querySelector('#vyasa-task-flow-host');
  const taskApiUrl = region.dataset.taskApiUrl || '';
  const taskGraph = JSON.parse(region.dataset.taskGraph || '{"nodes":[],"edges":[]}');
  const taskDirection = (region.dataset.taskDirection || 'lr').toLowerCase();
  let activeTaskId = '';
  let flowLibPromise = null;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const closePreview = () => { activeTaskId = ''; previewModal?.classList.add('hidden'); previewModal?.classList.remove('flex'); if (previewBody) previewBody.innerHTML = ''; if (previewStatus) previewStatus.textContent = ''; };
  const ensureFlowCss = () => {
    if (document.querySelector('link[data-vyasa-react-flow]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/@xyflow/react@12.8.4/dist/style.css';
    link.setAttribute('data-vyasa-react-flow', 'true');
    document.head.appendChild(link);
  };
  const getFlowLib = async () => {
    if (!flowLibPromise) {
      flowLibPromise = Promise.all([
        import('https://esm.sh/react@18.3.1'),
        import('https://esm.sh/react-dom@18.3.1/client'),
        import('https://esm.sh/@xyflow/react@12.8.4?deps=react@18.3.1,react-dom@18.3.1'),
      ]);
    }
    return flowLibPromise;
  };
  const renderEditor = (card) => {
    const attrs = JSON.parse(card.dataset.taskAttrs || '{}');
    const dependencies = JSON.parse(card.dataset.taskDependencies || '[]');
    const dependants = JSON.parse(card.dataset.taskDependants || '[]');
    const attrFields = ['priority', 'points', 'estimate', 'depends_on', 'phase', 'owner'];
    const hiddenAttrs = new Set(['graph_x', 'graph_y']);
    const extraAttrs = Object.entries(attrs).filter(([key]) => !attrFields.includes(key) && !hiddenAttrs.has(key)).map(([key, value]) => `${key}: ${value}`).join('\\n');
    return `
      <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <label class="block text-sm"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Task ID</span><input name="id" value="${esc(card.dataset.taskId || '')}" class="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"></label>
        <label class="mt-4 block text-sm"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Title</span><input name="title" value="${esc(card.dataset.taskTitle || '')}" class="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"></label>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          ${attrFields.map((key) => `<label class="block text-sm"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">${esc(key.replace('_', ' '))}</span><input name="attr:${esc(key)}" value="${esc(attrs[key] || '')}" class="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"></label>`).join('')}
        </div>
        <label class="mt-4 block text-sm"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Extra fields</span><textarea name="extra_attrs" rows="5" class="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="key: value&#10;another_key: value">${esc(extraAttrs)}</textarea></label>
        <div class="mt-5 text-sm text-slate-600 dark:text-slate-300"><b class="mb-2 block uppercase tracking-wide text-slate-500">Dependencies</b><div class="flex flex-wrap gap-2">${dependencies.length ? dependencies.map((dep) => `<button type="button" data-task-preview-trigger="${esc(dep)}" class="rounded border border-slate-200 px-2 py-0.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">${esc(dep)}</button>`).join('') : '<span class="text-slate-400">None</span>'}</div><b class="mb-2 mt-4 block uppercase tracking-wide text-slate-500">Dependants</b><div class="flex flex-wrap gap-2">${dependants.length ? dependants.map((dep) => `<button type="button" data-task-preview-trigger="${esc(dep)}" class="rounded border border-slate-200 px-2 py-0.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">${esc(dep)}</button>`).join('') : '<span class="text-slate-400">None</span>'}</div></div>
      </article>`;
  };
  const openPreview = (taskId) => {
    const card = previewStore?.querySelector(`[data-task-preview="${CSS.escape(taskId)}"]`);
    if (!card || !previewBody) return;
    activeTaskId = taskId;
    previewBody.innerHTML = renderEditor(card);
    previewModal?.classList.remove('hidden');
    previewModal?.classList.add('flex');
  };
  const parseExtraAttrs = (text) => Object.fromEntries(String(text || '').split('\\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const idx = line.indexOf(':');
    return idx >= 0 ? [line.slice(0, idx).trim(), line.slice(idx + 1).trim()] : [line.trim(), ''];
  }).filter(([key]) => key));
  const replaceRefs = (value, fromId, toId) => parseDependencyIds(value).map((dep) => dep === fromId ? toId : dep);
  const parseDependencyIds = (value) => String(value || '').trim().replace(/^\[/, '').replace(/\]$/, '').split(',').map((part) => part.trim()).filter(Boolean);
  const persistGraphEdges = async (payload, nextEdges) => {
    const depsByTask = new Map();
    for (const edge of nextEdges || []) {
      if (!edge?.source || !edge?.target || edge.source === edge.target) continue;
      if (!depsByTask.has(edge.target)) depsByTask.set(edge.target, []);
      const deps = depsByTask.get(edge.target);
      if (!deps.includes(edge.source)) deps.push(edge.source);
    }
    payload.chains = {};
    payload.tasks = (payload.tasks || []).map((task) => {
      const attrs = {...(task.attrs || {})};
      const deps = depsByTask.get(task.id) || [];
      if (deps.length) attrs.depends_on = `[${deps.join(', ')}]`;
      else delete attrs.depends_on;
      return {...task, attrs};
    });
  };
  const saveGraphMutation = async (mutate) => {
    if (!taskApiUrl) return false;
    const response = await fetch(taskApiUrl);
    const payload = await response.json();
    mutate(payload);
    const save = await fetch(taskApiUrl, {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload)});
    return save.ok;
  };
  const saveTask = async () => {
    if (!taskApiUrl || !activeTaskId || !previewBody) return;
    const form = region.querySelector('#vyasa-task-preview-form');
    const data = new FormData(form);
    const nextId = String(data.get('id') || '').trim();
    if (!nextId) { if (previewStatus) previewStatus.textContent = 'Task ID required'; return; }
    const attrs = parseExtraAttrs(data.get('extra_attrs'));
    ['priority', 'points', 'estimate', 'depends_on', 'phase', 'owner'].forEach((key) => {
      const value = String(data.get(`attr:${key}`) || '').trim();
      if (value) attrs[key] = value;
    });
    if (attrs.depends_on && !attrs.depends_on.startsWith('[')) attrs.depends_on = `[${parseDependencyIds(attrs.depends_on).join(', ')}]`;
    if (previewStatus) previewStatus.textContent = 'Saving...';
    const response = await fetch(taskApiUrl);
    const payload = await response.json();
    payload.tasks = (payload.tasks || []).map((task) => {
      if (task.id !== activeTaskId) {
        if (task.attrs?.depends_on && nextId !== activeTaskId) task.attrs.depends_on = `[${replaceRefs(task.attrs.depends_on, activeTaskId, nextId).join(', ')}]`;
        return task;
      }
      return {id: nextId, title: String(data.get('title') || '').trim() || nextId, attrs};
    });
    if (nextId !== activeTaskId) {
      Object.keys(payload.chains || {}).forEach((name) => {
        payload.chains[name] = (payload.chains[name] || []).map((id) => id === activeTaskId ? nextId : id);
      });
    }
    const save = await fetch(taskApiUrl, {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload)});
    if (!save.ok) { if (previewStatus) previewStatus.textContent = 'Save failed'; return; }
    if (previewStatus) previewStatus.textContent = 'Saved. Reloading...';
    window.location.reload();
  };
  (async () => {
    if (!flowHost) return;
    ensureFlowCss();
    const [ReactNS, ReactDOMNS, FlowNS] = await getFlowLib();
    const React = ReactNS.default || ReactNS;
    const ReactDOMClient = ReactDOMNS.default || ReactDOMNS;
    const {ReactFlow, Background, Controls, Handle, Position, MarkerType, addEdge, applyNodeChanges, applyEdgeChanges} = FlowNS;
    const grid = [24, 24];
    const edgeDefaults = {type: 'bezier', markerEnd: {type: MarkerType.ArrowClosed, width: 16, height: 16}};
    const isTD = taskDirection === 'td';
    const handleTarget = isTD ? Position.Top : Position.Left;
    const handleSource = isTD ? Position.Bottom : Position.Right;
    const TaskNode = ({id, data}) => {
      const missing = Array.isArray(data?.missing) ? data.missing : [];
      const warning = missing.length ? React.createElement('span', {className: 'absolute right-3 top-3 text-xs text-amber-500', title: `Missing: ${missing.join(', ')}`}, '⚠︎') : null;
      return React.createElement('button', {type: 'button', onClick: () => openPreview(id), className: 'relative h-[92px] w-[320px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-lg dark:border-slate-700 dark:bg-slate-900'}, React.createElement(Handle, {type: 'target', position: handleTarget, className: '!h-3 !w-3 !border-slate-400 !bg-white dark:!bg-slate-900'}), warning, React.createElement('span', {className: 'block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500'}, id), React.createElement('span', {className: 'mt-2 block break-words pr-6 text-sm font-semibold text-slate-900 dark:text-slate-100', style: {display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden'}}, data.title || id), React.createElement(Handle, {type: 'source', position: handleSource, className: '!h-3 !w-3 !border-slate-400 !bg-white dark:!bg-slate-900'}));
    };
    const PortalNode = ({data}) => {
      const open = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (data?.onOpenPath) data.onOpenPath(data.target_path || []);
      };
      const stop = (event) => event.stopPropagation();
      return React.createElement('button', {type: 'button', onPointerDownCapture: stop, onMouseDownCapture: stop, onPointerUpCapture: open, onMouseUpCapture: open, onClickCapture: open, className: 'nodrag nopan relative w-[220px] rounded-xl border border-dashed border-slate-300 bg-white/90 px-3 py-2 text-left text-xs font-semibold text-slate-500 shadow-sm hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:bg-slate-900'},
      data?.side === 'in' ? React.createElement(Handle, {type: 'source', position: handleSource, isConnectable: false, className: '!h-2.5 !w-2.5 !border-slate-400 !bg-white dark:!bg-slate-900'}) : null,
      React.createElement('span', {className: 'block truncate', title: data?.title || ''}, data?.title || ''),
      React.createElement('span', {className: 'mt-1 block text-[10px] uppercase tracking-[0.16em] text-slate-400'}, data?.side === 'in' ? 'Incoming' : 'Outgoing'),
      data?.side === 'out' ? React.createElement(Handle, {type: 'target', position: handleTarget, isConnectable: false, className: '!h-2.5 !w-2.5 !border-slate-400 !bg-white dark:!bg-slate-900'}) : null,
      );
    };
    const GroupNode = ({id, data, style}) => {
      const collapsed = !!data?.collapsed;
      const openGroup = React.useCallback((e) => {
        e.stopPropagation();
        if (data?.onOpen) data.onOpen(id);
      }, [id, data]);
      const count = Array.isArray(data?.task_ids) ? data.task_ids.length : 0;
      if (collapsed) {
        return React.createElement('div', {className: 'relative flex h-full w-full items-center'},
          React.createElement(Handle, {type: 'target', position: handleTarget, isConnectable: false, className: '!h-3 !w-3 !border-slate-400 !bg-white dark:!bg-slate-800'}),
          React.createElement('button', {
            type: 'button', onClick: openGroup,
            className: 'flex h-full w-full items-center gap-3 rounded-[28px] border border-slate-300 bg-white px-5 py-3 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700',
          },
            React.createElement('span', {className: 'min-w-0 flex-1 whitespace-normal break-words text-left text-sm font-semibold leading-tight text-slate-700 dark:text-slate-200', title: data?.title || id}, data?.title || id),
            React.createElement('span', {className: 'shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400'}, count),
          ),
          React.createElement(Handle, {type: 'source', position: handleSource, isConnectable: false, className: '!h-3 !w-3 !border-slate-400 !bg-white dark:!bg-slate-800'}),
        );
      }
      return React.createElement('div', {className: 'relative h-full w-full'},
        React.createElement('div', {
          className: 'absolute flex items-center gap-2',
          style: {top: -32, left: 0},
        },
          React.createElement('span', {className: 'text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400'}, data?.title || id),
          React.createElement('button', {
            type: 'button',
            onClick: openGroup,
            className: 'rounded border border-slate-300 px-1.5 py-0 text-[11px] text-slate-400 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800',
          }, '↗'),
        ),
        React.createElement('div', {className: 'h-full w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white/40 dark:border-slate-700 dark:bg-slate-900/40'}),
      );
    };
    const nodeTypes = {task: TaskNode, group: GroupNode, portal: PortalNode};
    const makeFlowElement = (initialNodes, initialEdges, hostForSnapshot) => {
      const App = () => {
        const rawNodes = initialNodes.map((node) => node.type === 'group' ? node : {...node, type: 'task'});
        const rawEdges = initialEdges.map((edge) => ({...edge, ...edgeDefaults}));
        const baseEdgesRef = React.useRef(rawEdges);
        const projectEdgesForNodes = React.useCallback((baseEdges, nextNodes) => {
          const taskToGroup = new Map();
          const groupParent = new Map();
          const collapsedGroups = new Set();
          const visibleGroups = new Set();
          nextNodes.forEach((node) => {
            if (node.type !== 'group') return;
            if (!node.hidden) visibleGroups.add(node.id);
            if (node.data?.parent_group_id) groupParent.set(node.id, node.data.parent_group_id);
            const taskIds = Array.isArray(node.data?.task_ids) ? node.data.task_ids : [];
            taskIds.forEach((taskId) => taskToGroup.set(taskId, node.id));
            if (node.data?.collapsed) collapsedGroups.add(node.id);
          });
          const endpointForTask = (taskId) => {
            let groupId = taskToGroup.get(taskId);
            while (groupId) {
              if (collapsedGroups.has(groupId) && visibleGroups.has(groupId)) return groupId;
              groupId = groupParent.get(groupId);
            }
            return taskId;
          };
          return baseEdges.map((edge) => {
            const nextSource = endpointForTask(edge.source);
            const nextTarget = endpointForTask(edge.target);
            if (nextSource === nextTarget && (nextSource !== edge.source || nextTarget !== edge.target)) return {...edge, source: nextSource, target: nextTarget, hidden: true};
            return {...edge, source: nextSource, target: nextTarget, hidden: false};
          });
        }, []);
        const {startNodes, startEdges} = React.useMemo(() => {
          let ns = rawNodes;
          for (const gn of rawNodes.filter((n) => n.type === 'group' && n.data?.collapsed)) {
            const taskIds = new Set(Array.isArray(gn.data?.descendant_task_ids) ? gn.data.descendant_task_ids : (gn.data?.task_ids || []));
            const groupIds = new Set(Array.isArray(gn.data?.child_group_ids) ? gn.data.child_group_ids : []);
            ns = ns.map((n) => (taskIds.has(n.id) || groupIds.has(n.id)) ? {...n, hidden: true} : n);
          }
          return {startNodes: ns, startEdges: projectEdgesForNodes(rawEdges, ns)};
        }, []);
        const origGroupStyles = React.useRef(Object.fromEntries(
          initialNodes.filter((n) => n.type === 'group').map((n) => [
            n.id,
            n.data?.expanded_w ? {width: n.data.expanded_w, height: n.data.expanded_h} : n.style,
          ])
        ));
        const origGroupPositions = React.useRef(Object.fromEntries(
          initialNodes.filter((n) => n.type === 'group').map((n) => [
            n.id,
            n.data?.expanded_x != null ? {x: n.data.expanded_x, y: n.data.expanded_y} : n.position,
          ])
        ));
        const [nodes, setNodes] = React.useState(startNodes);
        const nodesRef = React.useRef(startNodes);
        React.useEffect(() => { nodesRef.current = nodes; }, [nodes]);
        const [edges, setEdges] = React.useState(startEdges);
        const [drillPath, setDrillPath] = React.useState([]);
        const drillGroupId = drillPath[drillPath.length - 1] || null;
        const openDrillGroup = React.useCallback((groupId) => {
          setDrillPath((path) => path.includes(groupId) ? path.slice(0, path.indexOf(groupId) + 1) : [...path, groupId]);
        }, []);
        const openDrillPath = React.useCallback((path) => {
          const cleanPath = Array.isArray(path) ? path.filter(Boolean) : [];
          if (cleanPath.length) setDrillPath(cleanPath);
        }, []);
        const closeDrillGroup = React.useCallback(() => setDrillPath((path) => path.slice(0, -1)), []);
        const toggleGroup = React.useCallback(async (groupId) => {
          let nextCollapsed;
          let nextNodesSnapshot = null;
          setNodes((prev) => {
            const groupNode = prev.find((n) => n.id === groupId);
            if (!groupNode) return prev;
            nextCollapsed = !groupNode.data?.collapsed;
            const childIds = new Set(Array.isArray(groupNode.data?.task_ids) ? groupNode.data.task_ids : []);
            nextNodesSnapshot = prev.map((n) => {
              if (n.id === groupId) {
                const collapsedStyle = {width: n.data?.collapsed_w || 360, height: n.data?.collapsed_h || 88};
                const nextStyle = nextCollapsed
                  ? collapsedStyle
                  : (origGroupStyles.current[groupId] || n.style);
                const nextPos = nextCollapsed ? n.position : (origGroupPositions.current[groupId] || n.position);
                return {...n, data: {...n.data, collapsed: nextCollapsed}, style: nextStyle, position: nextPos};
              }
              if (childIds.has(n.id)) return {...n, hidden: nextCollapsed};
              return n;
            });
            return nextNodesSnapshot;
          });
          if (nextNodesSnapshot) setEdges(projectEdgesForNodes(baseEdgesRef.current, nextNodesSnapshot));
          await saveGraphMutation((payload) => {
            const group = (payload.groups || []).find((g) => g.id === groupId);
            if (!group) return;
            group.attrs = {...(group.attrs || {}), collapsed: nextCollapsed ? '1' : '0'};
          });
        }, [projectEdgesForNodes]);
        const setAllGroupsCollapsed = React.useCallback(async (collapsed) => {
          const groupIds = new Set();
          let nextNodesSnapshot = null;
          setNodes((prev) => nextNodesSnapshot = prev.map((n) => {
            if (n.type !== 'group') return n;
            groupIds.add(n.id);
            const collapsedStyle = {width: n.data?.collapsed_w || 360, height: n.data?.collapsed_h || 88};
            const nextStyle = collapsed
              ? collapsedStyle
              : (origGroupStyles.current[n.id] || n.style);
            const nextPos = collapsed ? n.position : (origGroupPositions.current[n.id] || n.position);
            return {...n, data: {...n.data, collapsed}, style: nextStyle, position: nextPos};
          }).map((n) => n.parentId && groupIds.has(n.parentId) ? {...n, hidden: collapsed} : n));
          if (nextNodesSnapshot) setEdges(projectEdgesForNodes(baseEdgesRef.current, nextNodesSnapshot));
          await saveGraphMutation((payload) => {
            (payload.groups || []).forEach((group) => {
              if (!groupIds.has(group.id)) return;
              group.attrs = {...(group.attrs || {}), collapsed: collapsed ? '1' : '0'};
            });
          });
        }, [projectEdgesForNodes]);
        const nodesWithToggle = React.useMemo(() =>
          nodes.map((n) => n.type === 'group' ? {...n, data: {...n.data, onOpen: openDrillGroup}} : n),
        [nodes, openDrillGroup]);
        const buildDrillGraph = React.useCallback((groupId) => {
          const group = nodes.find((n) => n.id === groupId && n.type === 'group');
          if (!group) return null;
          const childIds = new Set(Array.isArray(group.data?.task_ids) ? group.data.task_ids : []);
          const childGroupIds = new Set(Array.isArray(group.data?.child_group_ids) ? group.data.child_group_ids : []);
          const scopeTaskIds = new Set(Array.isArray(group.data?.descendant_task_ids) ? group.data.descendant_task_ids : group.data?.task_ids || []);
          const taskToGroup = new Map();
          const childGroupByTask = new Map();
          const groupParent = new Map();
          nodes.filter((n) => n.type === 'group').forEach((g) => {
            if (g.data?.parent_group_id) groupParent.set(g.id, g.data.parent_group_id);
            (g.data?.task_ids || []).forEach((taskId) => taskToGroup.set(taskId, g.id));
            if (childGroupIds.has(g.id)) (g.data?.descendant_task_ids || g.data?.task_ids || []).forEach((taskId) => childGroupByTask.set(taskId, g.id));
          });
          const pathForGroup = (targetGroupId) => {
            const path = [];
            let current = targetGroupId;
            const seen = new Set();
            while (current && !seen.has(current)) {
              seen.add(current);
              path.unshift(current);
              current = groupParent.get(current);
            }
            return path;
          };
          const pathForTask = (taskId) => pathForGroup(taskToGroup.get(taskId));
          const endpointForScopedTask = (taskId) => {
            if (childIds.has(taskId)) return taskId;
            return childGroupByTask.get(taskId) || null;
          };
          const titleFor = (id) => {
            const ownerGroupId = taskToGroup.get(id);
            if (ownerGroupId && ownerGroupId !== groupId) return nodes.find((n) => n.id === ownerGroupId)?.data?.title || ownerGroupId;
            return nodes.find((n) => n.id === id)?.data?.title || id;
          };
          const childNodes = nodes.filter((n) => childIds.has(n.id) || childGroupIds.has(n.id));
          const minX = childNodes.length ? Math.min(...childNodes.map((n) => n.position?.x || 0)) : 0;
          const minY = childNodes.length ? Math.min(...childNodes.map((n) => n.position?.y || 0)) : 0;
          const maxX = childNodes.length ? Math.max(...childNodes.map((n) => n.position?.x || 0)) : 0;
          const maxY = childNodes.length ? Math.max(...childNodes.map((n) => n.position?.y || 0)) : 0;
          const spreadX = maxX - minX;
          const spreadY = maxY - minY;
          const hasSavedLayout = childNodes.some((n) => !!n.data?.has_saved_position);
          const useCompactLayout = !hasSavedLayout && (isTD ? (spreadY > 1600 || childNodes.length <= 4) : (spreadX > 1600 || childNodes.length <= 4));
          const xOffset = 320 - minX;
          const yOffset = 96 - minY;
          const compactPos = (index) => isTD
            ? {x: 320 + Math.floor(index / 3) * 432, y: 96 + (index % 3) * 136}
            : {x: 320 + (index % 3) * 432, y: 96 + Math.floor(index / 3) * 136};
          const drillNodes = childNodes.map((n, index) => ({
            ...n,
            type: n.type === 'group' ? 'group' : 'task',
            parentId: undefined,
            hidden: false,
            selected: false,
            position: useCompactLayout
              ? compactPos(index)
              : {x: (n.position?.x || 0) + xOffset, y: (n.position?.y || 0) + yOffset},
            data: {...(n.data || {}), onOpen: openDrillGroup, drill_x_offset: useCompactLayout ? null : xOffset, drill_y_offset: useCompactLayout ? null : yOffset, drill_origin_x: n.position?.x || 0, drill_origin_y: n.position?.y || 0, drill_start_x: useCompactLayout ? compactPos(index).x : (n.position?.x || 0) + xOffset, drill_start_y: useCompactLayout ? compactPos(index).y : (n.position?.y || 0) + yOffset},
          }));
          const portalNodes = [];
          const drillEdges = [];
          const portalEdgeSpecs = [];
          const outX = useCompactLayout ? 320 + Math.min(childNodes.length, 3) * 432 + 120 : Math.max(760, maxX - minX + 680);
          const outY = useCompactLayout ? 96 + Math.ceil(childNodes.length / 3) * 136 + 120 : Math.max(560, maxY - minY + 480);
          baseEdgesRef.current.forEach((edge) => {
            const sourceEndpoint = endpointForScopedTask(edge.source);
            const targetEndpoint = endpointForScopedTask(edge.target);
            const sourceInside = scopeTaskIds.has(edge.source);
            const targetInside = scopeTaskIds.has(edge.target);
            if (sourceEndpoint && targetEndpoint) {
              if (sourceEndpoint !== targetEndpoint) drillEdges.push({...edge, source: sourceEndpoint, target: targetEndpoint, ...edgeDefaults});
            } else if (!sourceInside && targetEndpoint) {
              const targetPath = pathForTask(edge.source);
              const portalKey = targetPath.length ? targetPath.join(':') : edge.source;
              const portalId = `portal-in-${portalKey}`;
              const initPos = isTD ? {x: 96, y: Math.min(...drillNodes.map((n) => n.position?.y || 0)) - 160} : {x: 40, y: 96};
              if (!portalNodes.some((n) => n.id === portalId)) portalNodes.push({id: portalId, type: 'portal', position: initPos, draggable: false, selectable: false, zIndex: 20, style: {pointerEvents: 'all', zIndex: 20}, data: {title: titleFor(edge.source), side: 'in', target_path: targetPath, onOpenPath: openDrillPath}});
              if (!portalEdgeSpecs.some((e) => e.source === portalId && e.target === targetEndpoint)) portalEdgeSpecs.push({...edge, id: `${portalId}->${targetEndpoint}`, source: portalId, target: targetEndpoint, ...edgeDefaults});
            } else if (sourceEndpoint && !targetInside) {
              const targetPath = pathForTask(edge.target);
              const portalKey = targetPath.length ? targetPath.join(':') : edge.target;
              const portalId = `portal-out-${portalKey}`;
              const outPos = isTD ? {x: 96, y: Math.max(...drillNodes.map((n) => n.position?.y || 0)) + 160} : {x: outX, y: 96};
              if (!portalNodes.some((n) => n.id === portalId)) portalNodes.push({id: portalId, type: 'portal', position: outPos, draggable: false, selectable: false, zIndex: 20, style: {pointerEvents: 'all', zIndex: 20}, data: {title: titleFor(edge.target), side: 'out', target_path: targetPath, onOpenPath: openDrillPath}});
              if (!portalEdgeSpecs.some((e) => e.source === sourceEndpoint && e.target === portalId)) portalEdgeSpecs.push({...edge, id: `${sourceEndpoint}->${portalId}`, source: sourceEndpoint, target: portalId, ...edgeDefaults});
            }
          });
          const centerPortals = (side) => {
            const sideNodes = portalNodes.filter((n) => n.data?.side === side);
            if (isTD) {
              const visibleX = drillNodes.map((n) => n.position?.x || 0);
              const centerX = visibleX.length ? (Math.min(...visibleX) + Math.max(...visibleX)) / 2 : 96;
              const startX = centerX - ((sideNodes.length - 1) * 280) / 2;
              sideNodes.forEach((node, index) => { node.position.x = Math.max(40, startX + index * 280); });
            } else {
              const visibleY = drillNodes.map((n) => n.position?.y || 0);
              const centerY = visibleY.length ? (Math.min(...visibleY) + Math.max(...visibleY)) / 2 : 96;
              const startY = centerY - ((sideNodes.length - 1) * 112) / 2;
              sideNodes.forEach((node, index) => { node.position.y = Math.max(40, startY + index * 112); });
            }
          };
          centerPortals('in');
          centerPortals('out');
          return {group, nodes: [...drillNodes, ...portalNodes], edges: [...drillEdges, ...portalEdgeSpecs]};
        }, [nodes, openDrillGroup, openDrillPath]);
        const DrillOverlay = ({groupId, path}) => {
          const drill = React.useMemo(() => buildDrillGraph(groupId), [groupId, buildDrillGraph]);
          const [drillNodes, setDrillNodes] = React.useState(drill?.nodes || []);
          const [drillEdges, setDrillEdges] = React.useState(drill?.edges || []);
          React.useEffect(() => {
            setDrillNodes(drill?.nodes || []);
            setDrillEdges(drill?.edges || []);
          }, [drill]);
          if (!drill) return null;
          const calcDrillRealPosition = (node) => ({
            x: node.data?.drill_x_offset == null ? (node.data?.drill_origin_x || 0) + node.position.x - (node.data?.drill_start_x || 0) : node.position.x - node.data.drill_x_offset,
            y: node.data?.drill_y_offset == null ? (node.data?.drill_origin_y || 0) + node.position.y - (node.data?.drill_start_y || 0) : node.position.y - node.data.drill_y_offset,
          });
          const saveDrillPosition = async (_event, node) => {
            if (node.type !== 'task' && node.type !== 'group') return;
            const realPosition = calcDrillRealPosition(node);
            setNodes((prev) => prev.map((n) => n.id === node.id ? {...n, position: realPosition, data: {...n.data, has_saved_position: true}} : n));
            await saveGraphMutation((payload) => {
              if (node.type === 'group') {
                const group = (payload.groups || []).find((item) => item.id === node.id);
                if (!group) return;
                group.attrs = {...(group.attrs || {}), pill_x: String(Math.round(realPosition.x)), pill_y: String(Math.round(realPosition.y))};
                return;
              }
              const task = (payload.tasks || []).find((item) => item.id === node.id);
              if (task) task.attrs = {...(task.attrs || {}), graph_x: String(Math.round(realPosition.x)), graph_y: String(Math.round(realPosition.y))};
            });
          };
          const saveDrillPositions = async (_event, movedNodes) => {
            const eligible = (movedNodes || []).filter((n) => n.type === 'task' || n.type === 'group');
            if (!eligible.length) return;
            const realPositions = Object.fromEntries(eligible.map((n) => [n.id, calcDrillRealPosition(n)]));
            setNodes((prev) => prev.map((n) => realPositions[n.id] ? {...n, position: realPositions[n.id], data: {...n.data, has_saved_position: true}} : n));
            await saveGraphMutation((payload) => {
              eligible.forEach((node) => {
                const rp = realPositions[node.id];
                if (node.type === 'group') {
                  const group = (payload.groups || []).find((item) => item.id === node.id);
                  if (group) group.attrs = {...(group.attrs || {}), pill_x: String(Math.round(rp.x)), pill_y: String(Math.round(rp.y))};
                } else {
                  const task = (payload.tasks || []).find((item) => item.id === node.id);
                  if (task) task.attrs = {...(task.attrs || {}), graph_x: String(Math.round(rp.x)), graph_y: String(Math.round(rp.y))};
                }
              });
            });
          };
          return React.createElement('div', {className: 'absolute inset-4 z-20 flex flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950'},
            React.createElement('div', {className: 'flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800'},
              React.createElement('div', {className: 'min-w-0'},
                React.createElement('div', {className: 'text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400'}, 'Tasks / Group'),
                React.createElement('div', {className: 'flex min-w-0 flex-wrap items-center gap-1 text-sm font-semibold text-slate-800 dark:text-slate-100'},
                  React.createElement('button', {type: 'button', onClick: () => setDrillPath([]), className: 'rounded px-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}, 'Overview'),
                  ...(path || []).flatMap((id, index) => {
                    const node = nodes.find((n) => n.id === id);
                    return [
                      React.createElement('span', {className: 'text-slate-300', key: `${id}-sep`}, '/'),
                      React.createElement('button', {type: 'button', key: id, onClick: () => setDrillPath((items) => items.slice(0, index + 1)), className: 'max-w-[18rem] truncate rounded px-1 hover:bg-slate-100 dark:hover:bg-slate-800'}, node?.data?.title || id),
                    ];
                  }),
                ),
              ),
              React.createElement('button', {type: 'button', onClick: closeDrillGroup, className: 'rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}, 'Back'),
            ),
            React.createElement('div', {className: 'min-h-0 flex-1'},
              React.createElement(ReactFlow, {key: groupId, nodes: drillNodes, edges: drillEdges, onNodesChange: (changes) => setDrillNodes((items) => applyNodeChanges(changes, items)), onNodeDragStop: saveDrillPosition, onSelectionDragStop: saveDrillPositions, onInit: (instance) => setTimeout(() => instance.fitView({padding: 0.28, duration: 120}), 50), nodeTypes, fitView: true, fitViewOptions: {padding: 0.28}, minZoom: 0.15, snapToGrid: true, snapGrid: grid, colorMode: document.documentElement.classList.contains('dark') ? 'dark' : 'light', className: 'h-full w-full bg-transparent'}, React.createElement(Background, {gap: grid[0], size: 1}), React.createElement(Controls)),
            ),
          );
        };
        React.useEffect(() => {
          if (hostForSnapshot) hostForSnapshot.__vyasaTaskSnapshot = {nodes, edges};
        }, [nodes, edges]);
        React.useEffect(() => {
          const onKeyDown = async (event) => {
            const host = hostForSnapshot;
            const modal = document.getElementById('vyasa-task-fullscreen-modal');
            const hostInModal = !!host?.closest?.('#vyasa-task-fullscreen-modal');
            if ((modal && !hostInModal) || (!modal && hostInModal)) return;
            const target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
            const key = String(event.key || '').toLowerCase();
            if (key === 'escape' && drillGroupId) {
              const preview = document.getElementById('vyasa-task-preview-modal');
              if (preview && !preview.classList.contains('hidden')) return;
              event.preventDefault();
              closeDrillGroup();
              return;
            }
            if (key === 'r' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
              event.preventDefault();
              const currentNodes = nodesRef.current;
              const scopeIds = new Set();
              if (drillGroupId) {
                const group = currentNodes.find((n) => n.id === drillGroupId && n.type === 'group');
                (group?.data?.task_ids || []).forEach((id) => scopeIds.add(id));
                (group?.data?.child_group_ids || []).forEach((id) => scopeIds.add(id));
              } else {
                currentNodes.forEach((n) => scopeIds.add(n.id));
              }
              await saveGraphMutation((payload) => {
                (payload.tasks || []).forEach((t) => {
                  if (!scopeIds.has(t.id)) return;
                  if (t.attrs) { delete t.attrs.graph_x; delete t.attrs.graph_y; delete t.attrs.pill_x; delete t.attrs.pill_y; }
                });
                (payload.groups || []).forEach((g) => {
                  if (!scopeIds.has(g.id)) return;
                  if (g.attrs) { delete g.attrs.graph_x; delete g.attrs.graph_y; delete g.attrs.pill_x; delete g.attrs.pill_y; }
                });
              });
              if (drillGroupId) {
                const savedPath = drillPath.slice();
                setNodes((prev) => prev.map((n) => scopeIds.has(n.id) ? {...n, data: {...(n.data || {}), has_saved_position: false}} : n));
                setDrillPath([]);
                setTimeout(() => setDrillPath(savedPath), 0);
              } else {
                if (typeof htmx !== 'undefined' && document.getElementById('main-content')) {
                  const scrollY = window.scrollY;
                  htmx.ajax('GET', window.location.href, {target: '#main-content', swap: 'outerHTML'});
                  document.addEventListener('htmx:afterSwap', () => window.scrollTo(0, scrollY), {once: true});
                } else {
                  window.location.reload();
                }
              }
              return;
            }
            if (!event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
            if (key === 'f') {
              event.preventDefault();
              setAllGroupsCollapsed(true);
            }
          };
          document.addEventListener('keydown', onKeyDown);
          return () => document.removeEventListener('keydown', onKeyDown);
        }, [drillGroupId, drillPath, closeDrillGroup, setAllGroupsCollapsed, saveGraphMutation]);
        const onNodesChange = React.useCallback((changes) => setNodes((items) => applyNodeChanges(changes, items)), []);
        const onEdgesChange = React.useCallback((changes) => setEdges((items) => applyEdgeChanges(changes, items)), []);
        const onConnect = async (params) => {
          if (!params.source || !params.target || params.source === params.target) return;
          const groupIds = new Set(nodes.filter((node) => node.type === 'group').map((node) => node.id));
          if (groupIds.has(params.source) || groupIds.has(params.target)) return;
          const nextBaseEdges = addEdge({...params, ...edgeDefaults}, baseEdgesRef.current);
          baseEdgesRef.current = nextBaseEdges;
          const nextEdges = projectEdgesForNodes(nextBaseEdges, nodes);
          setEdges(nextEdges);
          await saveGraphMutation((payload) => persistGraphEdges(payload, nextBaseEdges));
        };
        const NODE_W = 320, NODE_H = 92, GROUP_PAD = 24;
        const pendingGroupState = React.useRef(null);
        const recomputeGroupBounds = (draggedNode, prev) => {
          if (!draggedNode.parentId) return prev;
          const groupId = draggedNode.parentId;
          const children = prev.filter((n) => n.parentId === groupId && !n.hidden);
          if (!children.length) return prev;
          const childPositions = children.map((n) => n.id === draggedNode.id ? {id: n.id, pos: draggedNode.position} : {id: n.id, pos: n.position});
          const minX = Math.min(...childPositions.map((c) => c.pos.x));
          const minY = Math.min(...childPositions.map((c) => c.pos.y));
          const maxX = Math.max(...childPositions.map((c) => c.pos.x));
          const maxY = Math.max(...childPositions.map((c) => c.pos.y));
          const shiftX = minX - GROUP_PAD;
          const shiftY = minY - GROUP_PAD;
          const nextW = maxX - shiftX + NODE_W + GROUP_PAD;
          const nextH = maxY - shiftY + NODE_H + GROUP_PAD;
          origGroupStyles.current[groupId] = {width: nextW, height: nextH};
          const groupNode = prev.find((n) => n.id === groupId);
          const newGroupPos = {x: (groupNode?.position.x || 0) + shiftX, y: (groupNode?.position.y || 0) + shiftY};
          const newChildPositions = Object.fromEntries(childPositions.map((c) => [
            c.id,
            c.id === draggedNode.id ? draggedNode.position : {x: c.pos.x - shiftX, y: c.pos.y - shiftY},
          ]));
          pendingGroupState.current = {groupId, groupPos: newGroupPos, childPositions: newChildPositions};
          return prev.map((n) => {
            if (n.id === groupId) return {...n, position: newGroupPos, style: {width: nextW, height: nextH}};
            if (n.parentId === groupId && n.id !== draggedNode.id) return {...n, position: newChildPositions[n.id]};
            return n;
          });
        };
        const onNodeDrag = React.useCallback((_event, node) => {
          if (node.parentId) setNodes((prev) => recomputeGroupBounds(node, prev));
        }, []);
        const onNodeDragStop = async (_event, node) => {
          if (node.type === 'group') {
            await saveGraphMutation((payload) => {
              const group = (payload.groups || []).find((g) => g.id === node.id);
              if (!group) return;
              const isCollapsed = group.attrs?.collapsed === '1';
              if (isCollapsed) {
                group.attrs = {
                  ...(group.attrs || {}),
                  pill_x: String(Math.round(node.position.x)),
                  pill_y: String(Math.round(node.position.y)),
                  graph_x: String(Math.round(node.position.x)),
                  graph_y: String(Math.round(node.position.y)),
                };
                origGroupPositions.current[node.id] = {x: node.position.x, y: node.position.y};
              } else {
                group.attrs = {...(group.attrs || {}), graph_x: String(Math.round(node.position.x)), graph_y: String(Math.round(node.position.y))};
                origGroupPositions.current[node.id] = {x: node.position.x, y: node.position.y};
              }
            });
            return;
          }
          await saveGraphMutation((payload) => {
            const state = pendingGroupState.current;
            if (state) {
              const group = (payload.groups || []).find((g) => g.id === state.groupId);
              if (group) group.attrs = {...(group.attrs || {}), graph_x: String(Math.round(state.groupPos.x)), graph_y: String(Math.round(state.groupPos.y))};
              (payload.tasks || []).forEach((t) => {
                if (state.childPositions[t.id]) {
                  t.attrs = {...(t.attrs || {}), graph_x: String(Math.round(state.childPositions[t.id].x)), graph_y: String(Math.round(state.childPositions[t.id].y))};
                }
              });
              pendingGroupState.current = null;
            } else {
              const task = (payload.tasks || []).find((item) => item.id === node.id);
              if (!task) return;
              task.attrs = {...(task.attrs || {}), graph_x: String(Math.round(node.position.x)), graph_y: String(Math.round(node.position.y))};
            }
          });
        };
        const onEdgesDelete = async (deleted) => {
          const groupIds = new Set(nodes.filter((node) => node.type === 'group').map((node) => node.id));
          const deletedIds = new Set((deleted || [])
            .filter((edge) => !groupIds.has(edge.source) && !groupIds.has(edge.target))
            .map((edge) => edge.id));
          if (!deletedIds.size) return;
          const nextBaseEdges = baseEdgesRef.current.filter((edge) => !deletedIds.has(edge.id));
          baseEdgesRef.current = nextBaseEdges;
          const nextEdges = projectEdgesForNodes(nextBaseEdges, nodes);
          setEdges(nextEdges);
          await saveGraphMutation((payload) => persistGraphEdges(payload, nextBaseEdges));
        };
        return React.createElement('div', {className: 'relative h-full w-full'},
          React.createElement(ReactFlow, {nodes: nodesWithToggle, edges, onNodesChange, onEdgesChange, onEdgesDelete, onConnect, onNodeDrag, onNodeDragStop, nodeTypes, fitView: true, minZoom: 0.05, snapToGrid: true, snapGrid: grid, colorMode: document.documentElement.classList.contains('dark') ? 'dark' : 'light', className: 'bg-transparent'}, React.createElement(Background, {gap: grid[0], size: 1}), React.createElement(Controls)),
          drillGroupId ? React.createElement(DrillOverlay, {groupId: drillGroupId, path: drillPath}) : null,
        );
      };
      return React.createElement(App);
    };
    flowHost.__vyasaTaskMount = {makeFlowElement, ReactDOMClient};
    const root = ReactDOMClient.createRoot(flowHost);
    root.render(makeFlowElement(taskGraph.nodes, taskGraph.edges, flowHost));
  })().catch((error) => {
    if (previewStatus) previewStatus.textContent = 'Graph failed to load';
    console.error('[vyasa][tasks] react flow mount failed', error);
  });
  region.querySelector('#vyasa-task-popout')?.addEventListener('click', async () => {
    const existing = document.getElementById('vyasa-task-fullscreen-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'vyasa-task-fullscreen-modal';
    modal.className = 'fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
    modal.innerHTML = '<div class="relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col"><div class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700"><h3 class="text-lg font-semibold text-slate-800 dark:text-slate-200">' + esc(region.querySelector('h2')?.textContent || 'Tasks') + '</h3><button type="button" class="vyasa-task-fullscreen-close px-3 py-1 text-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">✕</button></div><div class="flex-1 overflow-auto p-4"><div class="vyasa-task-fullscreen-host w-full h-full rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50"></div></div></div>';
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.querySelector('.vyasa-task-fullscreen-close')?.addEventListener('click', close);
    const escHandler = (event) => {
      if (event.key === 'Escape' && document.getElementById('vyasa-task-fullscreen-modal')) {
        close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    try {
      const mountApi = flowHost?.__vyasaTaskMount;
      if (!mountApi) return;
      const host = modal.querySelector('.vyasa-task-fullscreen-host');
      const snapshot = flowHost?.__vyasaTaskSnapshot || {nodes: taskGraph.nodes, edges: taskGraph.edges};
      const fullscreenRoot = mountApi.ReactDOMClient.createRoot(host);
      fullscreenRoot.render(mountApi.makeFlowElement(snapshot.nodes, snapshot.edges, host));
    } catch (error) {
      console.error('[vyasa][tasks] popout failed', error);
    }
  });
  region.querySelector('#vyasa-task-preview-save')?.addEventListener('click', saveTask);
  region.querySelector('#vyasa-task-preview-close')?.addEventListener('click', closePreview);
  previewModal?.addEventListener('click', (event) => { if (event.target === previewModal) closePreview(); });
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-task-preview-trigger]');
    if (trigger) openPreview(trigger.dataset.taskPreviewTrigger || '');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && previewModal && !previewModal.classList.contains('hidden')) {
      event.stopImmediatePropagation();
      closePreview();
    }
  }, true);
})();
"""),
    )
def render_tasks_board_text(text: str, title: str = "Tasks", *, task_api_url: str | None = None, show_heading: bool = False, width: str = "95vw", height: str = "70vh", direction: str = "lr"):
    tasks, chains, groups = parse_tasks_document_text(text)
    return _render_tasks_board(tasks, chains, groups, title, task_api_url=task_api_url, show_heading=show_heading, width=width, height=height, direction=direction)
