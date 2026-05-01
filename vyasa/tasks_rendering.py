import html
import json
import re
import textwrap
from dataclasses import dataclass, field
from pathlib import Path

from fasthtml.common import Div, H1, NotStr, P


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


def _render_task_region_shell(
    *,
    task_api_url: str | None,
    graph_payload: dict,
    direction: str,
    title: str,
    panel_style: str,
    warnings_cls: str,
    warnings_open: str,
    warnings_style: str,
    warnings_html: str,
    height: str,
    preview_cards: list[str],
) -> str:
    safe_api_url = html.escape(task_api_url or "")
    safe_graph_payload = html.escape(json.dumps(graph_payload))
    safe_direction = html.escape(direction.lower())
    safe_title = html.escape(title)
    safe_panel_style = html.escape(panel_style)
    safe_warnings_cls = html.escape(warnings_cls)
    safe_warnings_style = html.escape(warnings_style)
    safe_height = html.escape(height)
    preview_store = "".join(preview_cards)
    return (
        f'<section id="vyasa-task-region" data-task-api-url="{safe_api_url}" '
        f'data-task-graph="{safe_graph_payload}" data-task-direction="{safe_direction}" '
        f'class="mt-8 rounded-lg border border-slate-200 p-4 dark:border-slate-800" style="{safe_panel_style}">'
        f'<div class="flex items-center justify-between gap-4"><div><h2 class="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{safe_title}</h2>'
        '<p class="mt-1 text-xs text-slate-500">Zoom to reveal detail. Drag cards. Connect right handle to left handle.</p></div></div>'
        f'<details id="vyasa-task-warnings" class="{safe_warnings_cls} mt-2"{warnings_open} style="{safe_warnings_style}"><summary class="cursor-pointer font-semibold">Dependency warnings</summary><ul class="mt-2 list-disc pl-5">{warnings_html}</ul></details>'
        '<div class="relative mt-2"><div class="absolute right-2 top-2 z-10 flex gap-1 rounded bg-white/80 backdrop-blur-sm dark:bg-slate-800/80"><button type="button" id="vyasa-task-popout" class="rounded border px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700" title="Fullscreen">⛶</button></div>'
        f'<div id="vyasa-task-flow-host" class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50" style="height: {safe_height};"></div></div>'
        f'<div id="vyasa-task-preview-store" class="hidden">{preview_store}</div>'
        '<div id="vyasa-task-preview-modal" class="fixed inset-0 z-[9998] hidden items-center justify-center bg-slate-950/60 p-4"><div class="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"><div class="mb-3 flex items-center justify-between gap-4"><h2 class="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Task editor</h2><div class="flex items-center gap-2"><button id="vyasa-task-preview-save" type="button" class="rounded bg-blue-600 px-3 py-1 text-sm text-white">Save</button><button id="vyasa-task-preview-close" type="button" class="rounded border border-slate-200 px-3 py-1 text-sm dark:border-slate-700">Close</button></div></div><form id="vyasa-task-preview-form" class="space-y-4"><div id="vyasa-task-preview-body"></div></form><p id="vyasa-task-preview-status" class="mt-3 text-xs text-slate-500"></p></div></div></section>'
    )


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
        group_node = {
            "id": group.id,
            "type": "group",
            "position": node_pos,
            "data": {"title": group.title, "task_ids": [t.id for t in group.tasks], "descendant_task_ids": sorted(all_child_ids), "child_group_ids": child_group_ids, "parent_group_id": group.parent_group_id, "has_saved_position": pill_x is not None and pill_y is not None, "collapsed": is_collapsed, "expanded_w": gw, "expanded_h": gh, "expanded_x": gx, "expanded_y": gy, "collapsed_w": collapsed_w, "collapsed_h": collapsed_h},
            "style": {"width": collapsed_w if is_collapsed else gw, "height": collapsed_h if is_collapsed else gh},
            "hidden": bool(group.parent_group_id),
        }
        if group.parent_group_id:
            group_node["parentId"] = group.parent_group_id
        group_nodes.append(group_node)
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
    region_shell = _render_task_region_shell(
        task_api_url=task_api_url,
        graph_payload=graph_payload,
        direction=direction,
        title=title,
        panel_style=panel_style,
        warnings_cls=warnings_cls,
        warnings_open=warnings_open,
        warnings_style=warnings_style,
        warnings_html=warnings_html,
        height=height,
        preview_cards=preview_cards,
    )
    return Div(
        *header_nodes,
        NotStr(region_shell),
    )
def render_tasks_board_text(text: str, title: str = "Tasks", *, task_api_url: str | None = None, show_heading: bool = False, width: str = "95vw", height: str = "70vh", direction: str = "lr"):
    tasks, chains, groups = parse_tasks_document_text(text)
    return _render_tasks_board(tasks, chains, groups, title, task_api_url=task_api_url, show_heading=show_heading, width=width, height=height, direction=direction)
