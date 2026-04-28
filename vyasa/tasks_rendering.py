import html
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from fasthtml.common import Div, H1, NotStr, P, Script


@dataclass
class TaskItem:
    id: str
    title: str
    attrs: dict[str, str] = field(default_factory=dict)


TASK_RE = re.compile(r'^\s*task\s+(\S+)\s+"([^"]+)"\s*$')
CHAIN_RE = re.compile(r"^\s*chain\s+(\S+)\s*$")
ATTR_RE = re.compile(r"^\s+([a-zA-Z_][\w-]*)\s*:\s*(.*?)\s*$")
ESTIMATE_RE = re.compile(r"^\s*(\d+)\s*d\s*$", re.IGNORECASE)
TASKS_FENCE_RE = re.compile(r"(?ms)^(?P<fence>`{3,}|~{3,})tasks(?P<info>[^\n]*)\n(?P<body>.*?)(?:\n(?P=fence))[ \t]*$")
CRITICAL_TASK_ATTRS = ("estimate", "owner", "phase", "priority")


def parse_tasks_text(text: str) -> list[TaskItem]:
    tasks: list[TaskItem] = []
    current: TaskItem | None = None
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        task_match = TASK_RE.match(line)
        if task_match:
            current = TaskItem(task_match.group(1), task_match.group(2))
            tasks.append(current)
            continue
        attr_match = ATTR_RE.match(line)
        if current and attr_match:
            current.attrs[attr_match.group(1).lower()] = attr_match.group(2).strip()
    return tasks


def parse_tasks_document_text(text: str) -> tuple[list[TaskItem], dict[str, list[str]]]:
    tasks: list[TaskItem] = []
    chains: dict[str, list[str]] = {}
    current: TaskItem | None = None
    current_chain: str | None = None
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        task_match = TASK_RE.match(line)
        if task_match:
            current = TaskItem(task_match.group(1), task_match.group(2))
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
        if current and attr_match:
            current.attrs[attr_match.group(1).lower()] = attr_match.group(2).strip()
            continue
        if current_chain and "->" in line:
            chains[current_chain].extend(part.strip() for part in line.split("->") if part.strip())
    return tasks, chains

def serialize_tasks_document(tasks: list[TaskItem], chains: dict[str, list[str]]) -> str:
    lines: list[str] = []
    for task in tasks:
        lines.append(f'task {task.id} "{task.title}"')
        for key, value in task.attrs.items():
            lines.append(f"  {key}: {value}")
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
    tasks, chains = parse_tasks_document_text(text)
    return {
        "tasks": [{"id": task.id, "title": task.title, "attrs": task.attrs} for task in tasks],
        "chains": chains,
    }


def payload_to_tasks_document(payload: dict) -> tuple[list[TaskItem], dict[str, list[str]]]:
    raw_tasks = payload.get("tasks", [])
    raw_chains = payload.get("chains", {})
    tasks = [
        TaskItem(str(item.get("id", "")).strip(), str(item.get("title", "")).strip(), {str(k): str(v) for k, v in dict(item.get("attrs", {})).items()})
        for item in raw_tasks
        if isinstance(item, dict) and str(item.get("id", "")).strip()
    ]
    chains = {
        str(name): [str(task_id) for task_id in ids if str(task_id).strip()]
        for name, ids in raw_chains.items()
        if isinstance(ids, list)
    } if isinstance(raw_chains, dict) else {}
    return tasks, chains


def missing_critical_task_attrs(task: TaskItem) -> list[str]:
    return [key for key in CRITICAL_TASK_ATTRS if not str(task.attrs.get(key, "")).strip()]

def list_tasks_fence_blocks(markdown: str) -> list[re.Match[str]]:
    return list(TASKS_FENCE_RE.finditer(markdown))


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
    tasks, chains = payload_to_tasks_document(payload)
    replacement = f'{match.group("fence")}tasks{match.group("info")}\n{serialize_tasks_document(tasks, chains).rstrip()}\n{match.group("fence")}'
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


def _render_tasks_board(tasks: list[TaskItem], chains: dict[str, list[str]], title: str, *, task_api_url: str | None = None, show_heading: bool = True, width: str = "100%", height: str = "70vh"):
    warnings = validate_task_dependencies(tasks, chains)
    schedule, schedule_warnings, critical_path = build_task_schedule(tasks, chains)
    warnings.extend(schedule_warnings)
    warnings.extend(validate_owner_overlaps(tasks, schedule))
    preview_cards = []
    edges = _task_dependency_edges(tasks, chains)
    dependants_by_task: dict[str, list[str]] = {}
    for source, target in edges:
        dependants_by_task.setdefault(source, []).append(target)
    node_w, node_h, col_gap, row_gap = 220, 92, 112, 44
    columns: dict[int, list[TaskItem]] = {}
    for task in tasks:
        columns.setdefault(schedule.get(task.id, (1, 1))[0], []).append(task)
    max_rows = max((len(items) for items in columns.values()), default=1)
    graph_w = max(columns.keys(), default=1) * (node_w + col_gap) + 80
    graph_h = max_rows * (node_h + row_gap) + 80
    positions: dict[str, tuple[int, int]] = {}
    for start_day, items in sorted(columns.items()):
        for row, task in enumerate(items):
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
    graph_payload = {
        "nodes": [
            {
                "id": task.id,
                "position": {"x": positions[task.id][0], "y": positions[task.id][1]},
                "data": {"title": task.title, "missing": missing_critical_task_attrs(task)},
            }
            for task in tasks
        ],
        "edges": [{"id": f"{source}->{target}", "source": source, "target": target} for source, target in edges],
    }
    warnings_html = "".join(f"<li>{html.escape(item)}</li>" for item in warnings)
    warnings_cls = "mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
    warnings_style = "" if warnings else "display:none;"
    warnings_open = " open" if warnings else ""
    panel_style = f'width: {html.escape(width)}; position: relative; left: 50%; transform: translateX(-50%);' if "vw" in str(width).lower() else f'width: {html.escape(width)};'
    header_nodes = [H1(title, cls="vyasa-page-title text-4xl font-bold"), P(f"{len(tasks)} task{'s' if len(tasks) != 1 else ''}", cls="mt-2 text-slate-500")] if show_heading else []
    return Div(
        *header_nodes,
        NotStr(f'<section id="vyasa-task-region" data-task-api-url="{html.escape(task_api_url or "")}" data-task-graph="{html.escape(json.dumps(graph_payload))}" class="mt-8 rounded-lg border border-slate-200 p-4 dark:border-slate-800" style="{panel_style}"><div class="flex items-center justify-between gap-4"><div><h2 class="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{html.escape(title)}</h2><p class="mt-1 text-xs text-slate-500">Drag cards. Connect right handle to left handle. Click card to edit.</p></div></div><details id="vyasa-task-warnings" class="{warnings_cls} mt-2"{warnings_open} style="{warnings_style}"><summary class="cursor-pointer font-semibold">Dependency warnings</summary><ul class="mt-2 list-disc pl-5">{warnings_html}</ul></details><div class="relative mt-2"><div class="absolute right-2 top-2 z-10 flex gap-1 rounded bg-white/80 backdrop-blur-sm dark:bg-slate-800/80"><button type="button" id="vyasa-task-popout" class="rounded border px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700" title="Fullscreen">⛶</button></div><div id="vyasa-task-flow-host" class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50" style="height: {html.escape(height)};"></div></div><div id="vyasa-task-preview-store" class="hidden">{"".join(preview_cards)}</div><div id="vyasa-task-preview-modal" class="fixed inset-0 z-[9998] hidden items-center justify-center bg-slate-950/60 p-4"><div class="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"><div class="mb-3 flex items-center justify-between gap-4"><h2 class="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Task editor</h2><div class="flex items-center gap-2"><button id="vyasa-task-preview-save" type="button" class="rounded bg-blue-600 px-3 py-1 text-sm text-white">Save</button><button id="vyasa-task-preview-close" type="button" class="rounded border border-slate-200 px-3 py-1 text-sm dark:border-slate-700">Close</button></div></div><form id="vyasa-task-preview-form" class="space-y-4"><div id="vyasa-task-preview-body"></div></form><p id="vyasa-task-preview-status" class="mt-3 text-xs text-slate-500"></p></div></div></section>'),
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
    const TaskNode = ({id, data}) => {
      const missing = Array.isArray(data?.missing) ? data.missing : [];
      const warning = missing.length ? React.createElement('span', {className: 'absolute right-3 top-3 text-xs text-amber-500', title: `Missing: ${missing.join(', ')}`}, '⚠︎') : null;
      return React.createElement('button', {type: 'button', onClick: () => openPreview(id), className: 'relative min-w-[220px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-lg dark:border-slate-700 dark:bg-slate-900'}, React.createElement(Handle, {type: 'target', position: Position.Left, className: '!h-3 !w-3 !border-slate-400 !bg-white dark:!bg-slate-900'}), warning, React.createElement('span', {className: 'block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500'}, id), React.createElement('span', {className: 'mt-2 block text-sm font-semibold text-slate-900 dark:text-slate-100'}, data.title || id), React.createElement(Handle, {type: 'source', position: Position.Right, className: '!h-3 !w-3 !border-slate-400 !bg-white dark:!bg-slate-900'}));
    };
    const nodeTypes = {task: TaskNode};
    const makeFlowElement = (initialNodes, initialEdges, hostForSnapshot) => {
      const App = () => {
        const startNodes = initialNodes.map((node) => ({...node, type: 'task'}));
        const startEdges = initialEdges.map((edge) => ({...edge, ...edgeDefaults}));
        const [nodes, setNodes] = React.useState(startNodes);
        const [edges, setEdges] = React.useState(startEdges);
        React.useEffect(() => {
          if (hostForSnapshot) hostForSnapshot.__vyasaTaskSnapshot = {nodes, edges};
        }, [nodes, edges]);
        const onNodesChange = React.useCallback((changes) => setNodes((items) => applyNodeChanges(changes, items)), []);
        const onEdgesChange = React.useCallback((changes) => setEdges((items) => applyEdgeChanges(changes, items)), []);
        const onConnect = async (params) => {
          if (!params.source || !params.target || params.source === params.target) return;
          const nextEdges = addEdge({...params, ...edgeDefaults}, edges);
          setEdges(nextEdges);
          await saveGraphMutation((payload) => persistGraphEdges(payload, nextEdges));
        };
        const onNodeDragStop = async (_event, node) => {
          await saveGraphMutation((payload) => {
            const task = (payload.tasks || []).find((item) => item.id === node.id);
            if (!task) return;
            task.attrs = {...(task.attrs || {}), graph_x: String(Math.round(node.position.x)), graph_y: String(Math.round(node.position.y))};
          });
        };
        const onEdgesDelete = async (deleted) => {
          const deletedIds = new Set((deleted || []).map((edge) => edge.id));
          const nextEdges = edges.filter((edge) => !deletedIds.has(edge.id));
          setEdges(nextEdges);
          await saveGraphMutation((payload) => persistGraphEdges(payload, nextEdges));
        };
        return React.createElement(ReactFlow, {nodes, edges, onNodesChange, onEdgesChange, onEdgesDelete, onConnect, onNodeDragStop, nodeTypes, fitView: true, snapToGrid: true, snapGrid: grid, colorMode: document.documentElement.classList.contains('dark') ? 'dark' : 'light', className: 'bg-transparent'}, React.createElement(Background, {gap: grid[0], size: 1}), React.createElement(Controls));
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
      fullscreenRoot.render(mountApi.makeFlowElement(snapshot.nodes, snapshot.edges, null));
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
    if (event.key === 'Escape' && previewModal && !previewModal.classList.contains('hidden')) closePreview();
  });
})();
"""),
    )
def render_tasks_board_text(text: str, title: str = "Tasks", *, task_api_url: str | None = None, show_heading: bool = False, width: str = "100%", height: str = "70vh"):
    tasks, chains = parse_tasks_document_text(text)
    return _render_tasks_board(tasks, chains, title, task_api_url=task_api_url, show_heading=show_heading, width=width, height=height)
