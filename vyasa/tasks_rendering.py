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


def parse_tasks_file(path: Path) -> list[TaskItem]:
    tasks: list[TaskItem] = []
    current: TaskItem | None = None
    for line in path.read_text(encoding="utf-8").splitlines():
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


def parse_tasks_document(path: Path) -> tuple[list[TaskItem], dict[str, list[str]]]:
    tasks: list[TaskItem] = []
    chains: dict[str, list[str]] = {}
    current: TaskItem | None = None
    current_chain: str | None = None
    for line in path.read_text(encoding="utf-8").splitlines():
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


def write_tasks_chains(path: Path, chains: dict[str, list[str]]) -> None:
    tasks, _ = parse_tasks_document(path)
    apply_chain_dependencies_to_tasks(tasks, chains)
    path.write_text(serialize_tasks_document(tasks, chains), encoding="utf-8")


def tasks_payload(path: Path) -> dict:
    tasks, chains = parse_tasks_document(path)
    return {
        "tasks": [{"id": task.id, "title": task.title, "attrs": task.attrs} for task in tasks],
        "chains": chains,
    }


def write_tasks_payload(path: Path, payload: dict) -> None:
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
    path.write_text(serialize_tasks_document(tasks, chains), encoding="utf-8")


def upsert_task(path: Path, task_id: str, title: str | None = None, attrs: dict | None = None) -> None:
    tasks, chains = parse_tasks_document(path)
    task = next((item for item in tasks if item.id == task_id), None)
    if task is None:
        task = TaskItem(task_id, title or task_id, {})
        tasks.append(task)
    elif title is not None:
        task.title = title
    if attrs:
        task.attrs.update({str(k): str(v) for k, v in attrs.items()})
    path.write_text(serialize_tasks_document(tasks, chains), encoding="utf-8")


def delete_task(path: Path, task_id: str) -> None:
    tasks, chains = parse_tasks_document(path)
    tasks = [task for task in tasks if task.id != task_id]
    for ids in chains.values():
        ids[:] = [item for item in ids if item != task_id]
    path.write_text(serialize_tasks_document(tasks, chains), encoding="utf-8")


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


def render_tasks_board(path: Path, title: str, save_url: str | None = None, task_api_url: str | None = None):
    tasks, chains = parse_tasks_document(path)
    chain_deps = chain_dependencies(chains)
    warnings = validate_task_dependencies(tasks, chains)
    schedule, schedule_warnings, critical_path = build_task_schedule(tasks, chains)
    warnings.extend(schedule_warnings)
    warnings.extend(validate_owner_overlaps(tasks, schedule))
    preview_cards = []
    task_lookup = {task.id: task for task in tasks}
    for index, task in enumerate(tasks, start=1):
        chips = "".join(
            _chip(k.replace("_", " "), v)
            for k, v in task.attrs.items()
            if k in {"priority", "points", "estimate", "depends_on", "owner", "phase"}
        )
        build_order = _build_order(task.id, tasks, chains)
        build_order_chips = "".join(
            f'<button type="button" data-task-preview-trigger="{html.escape(dep)}" class="rounded border border-slate-200 px-2 py-0.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">{html.escape(dep)}</button>'
            for dep in build_order
        ) or '<span class="text-slate-400">None</span>'
        start_day, end_day = schedule.get(task.id, (1, 1))
        timeline = f'D{start_day}' if start_day == end_day else f'D{start_day}-D{end_day}'
        preview_cards.append(
            f'<article data-task-preview="{html.escape(task.id)}" data-task-id="{html.escape(task.id)}" data-manual-deps="{html.escape(",".join(parse_dependency_ids(task.attrs.get("depends_on", ""))))}" data-task-title="{html.escape(task.title)}" data-task-attrs="{html.escape(json.dumps(task.attrs))}" data-build-order="{html.escape(json.dumps(build_order))}" data-task-index="{index:02d}" data-task-schedule="{html.escape(timeline)}" data-task-critical="{"yes" if task.id in critical_path else "no"}" class="vyasa-task-card hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">'
            f'<div class="flex items-start justify-between gap-4"><div><div class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{html.escape(task.id)}</div>'
            f'<h2 class="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{html.escape(task.title)}</h2></div>'
            f'<div class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{index:02d}</div></div>'
            f'<div class="mt-4 flex flex-wrap gap-2">{chips}{_chip("schedule", timeline)}{_chip("critical", "yes" if task.id in critical_path else "no")}</div>'
            f'<div class="mt-5 grid gap-4 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-[1fr_12rem]"><div><b class="mb-2 block uppercase tracking-wide text-slate-500">Build order</b><div class="flex flex-wrap gap-2">{build_order_chips}</div></div>'
            f'<div><b class="mb-2 block uppercase tracking-wide text-slate-500">Lane status</b><p>{"Critical path" if task.id in critical_path else "Parallel safe"}</p><p class="mt-1 text-xs text-slate-500">Ready after {timeline}</p></div></div>'
            f'</article>'
        )
    chain_rows = []
    for name, ids in chains.items():
        cards_html = "".join(
            f'<button type="button" draggable="true" data-task-id="{html.escape(task_id)}" class="vyasa-chain-card min-w-[12rem] cursor-grab rounded-xl border border-slate-200 bg-white p-3 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">'
            f'<b class="block text-xs text-slate-500">{html.escape(task_id)}</b>{html.escape(task_lookup.get(task_id, TaskItem(task_id, "Missing task")).title)}</button>'
            for task_id in ids
        )
        chain_rows.append(
            f'<section class="mt-4" data-chain-name="{html.escape(name)}"><h3 class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{html.escape(name)}</h3>'
            f'<div class="vyasa-chain-lane flex min-h-20 gap-2 overflow-x-auto rounded-lg border border-dashed border-slate-200 p-2 dark:border-slate-700">{cards_html}</div></section>'
        )
    chains_html = "".join(chain_rows)
    warnings_html = "".join(f"<li>{html.escape(item)}</li>" for item in warnings)
    warnings_cls = "mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
    warnings_style = "" if warnings else "display:none;"
    return Div(
        H1(title, cls="vyasa-page-title text-4xl font-bold"),
        P(f"{len(tasks)} task{'s' if len(tasks) != 1 else ''}", cls="mt-2 text-slate-500"),
        NotStr(f'<div id="vyasa-task-warnings" class="{warnings_cls}" style="{warnings_style}"><b>Dependency warnings</b><ul class="mt-2 list-disc pl-5">{warnings_html}</ul></div>'),
        NotStr(f'<section id="vyasa-chain-region" data-save-url="{html.escape(save_url or "")}" data-task-api-url="{html.escape(task_api_url or "")}" class="mt-8 rounded-lg border border-slate-200 p-4 dark:border-slate-800"><h2 class="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Dependency lanes</h2><div id="vyasa-chain-lanes">{chains_html or "<p class=\"mt-3 text-sm text-slate-500\">No chains.</p>"}</div><div id="vyasa-new-chain-drop" class="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">Drop card here for new lane</div><p id="vyasa-chain-save-status" class="mt-3 text-xs text-slate-500"></p><div id="vyasa-task-preview-store" class="hidden">{"".join(preview_cards)}</div><div id="vyasa-task-preview-modal" class="fixed inset-0 z-[9998] hidden items-center justify-center bg-slate-950/60 p-4"><div class="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"><div class="mb-3 flex items-center justify-between gap-4"><h2 class="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Task editor</h2><div class="flex items-center gap-2"><button id="vyasa-task-preview-save" type="button" class="rounded bg-blue-600 px-3 py-1 text-sm text-white">Save</button><button id="vyasa-task-preview-close" type="button" class="rounded border border-slate-200 px-3 py-1 text-sm dark:border-slate-700">Close</button></div></div><form id="vyasa-task-preview-form" class="space-y-4"><div id="vyasa-task-preview-body"></div></form><p id="vyasa-task-preview-status" class="mt-3 text-xs text-slate-500"></p></div></div><div id="vyasa-chain-modal" class="fixed inset-0 z-[9999] hidden items-center justify-center bg-slate-950/50 p-4"><div class="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"><h2 class="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">New dependency lane</h2><input id="vyasa-chain-name-input" class="mt-4 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Lane name"><div class="mt-4 flex justify-end gap-2"><button id="vyasa-chain-cancel" type="button" class="rounded border border-slate-200 px-3 py-1 text-sm dark:border-slate-700">Cancel</button><button id="vyasa-chain-create" type="button" class="rounded bg-blue-600 px-3 py-1 text-sm text-white">Create</button></div></div></div></section>'),
        Script("""
(() => {
  const region = document.getElementById('vyasa-chain-region');
  if (!region || region.dataset.bound === 'true') return;
  region.dataset.bound = 'true';
  let draggedCard = null;
  let pendingNewLaneCard = null;
  let pendingNewLaneId = '';
  const lanesRoot = region.querySelector('#vyasa-chain-lanes');
  const status = region.querySelector('#vyasa-chain-save-status');
  const previewModal = region.querySelector('#vyasa-task-preview-modal');
  const previewBody = region.querySelector('#vyasa-task-preview-body');
  const previewStore = region.querySelector('#vyasa-task-preview-store');
  const previewStatus = region.querySelector('#vyasa-task-preview-status');
  const taskApiUrl = region.dataset.taskApiUrl || '';
  let activeTaskId = '';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const closePreview = () => { activeTaskId = ''; previewModal?.classList.add('hidden'); previewModal?.classList.remove('flex'); if (previewBody) previewBody.innerHTML = ''; if (previewStatus) previewStatus.textContent = ''; };
  const renderEditor = (card) => {
    const attrs = JSON.parse(card.dataset.taskAttrs || '{}');
    const buildOrder = JSON.parse(card.dataset.buildOrder || '[]');
    const attrFields = ['priority', 'points', 'estimate', 'depends_on', 'phase', 'owner'];
    const extraAttrs = Object.entries(attrs).filter(([key]) => !attrFields.includes(key)).map(([key, value]) => `${key}: ${value}`).join('\\n');
    return `
      <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div class="grid gap-4 md:grid-cols-[1fr_6rem]">
          <label class="block text-sm"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Task ID</span><input name="id" value="${esc(card.dataset.taskId || '')}" class="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"></label>
          <div class="rounded-full bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">${esc(card.dataset.taskIndex || '')}</div>
        </div>
        <label class="mt-4 block text-sm"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Title</span><input name="title" value="${esc(card.dataset.taskTitle || '')}" class="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"></label>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          ${attrFields.map((key) => `<label class="block text-sm"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">${esc(key.replace('_', ' '))}</span><input name="attr:${esc(key)}" value="${esc(attrs[key] || '')}" class="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"></label>`).join('')}
        </div>
        <label class="mt-4 block text-sm"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Extra fields</span><textarea name="extra_attrs" rows="5" class="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="key: value&#10;another_key: value">${esc(extraAttrs)}</textarea></label>
        <div class="mt-5 grid gap-4 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-[1fr_12rem]">
          <div><b class="mb-2 block uppercase tracking-wide text-slate-500">Build order</b><div class="flex flex-wrap gap-2">${buildOrder.length ? buildOrder.map((dep) => `<button type="button" data-task-preview-trigger="${esc(dep)}" class="rounded border border-slate-200 px-2 py-0.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">${esc(dep)}</button>`).join('') : '<span class="text-slate-400">None</span>'}</div></div>
          <div><b class="mb-2 block uppercase tracking-wide text-slate-500">Lane status</b><p>${card.dataset.taskCritical === 'yes' ? 'Critical path' : 'Parallel safe'}</p><p class="mt-1 text-xs text-slate-500">Ready after ${esc(card.dataset.taskSchedule || '')}</p></div>
        </div>
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
  const collectChains = () => Object.fromEntries(Array.from(lanesRoot.querySelectorAll('[data-chain-name]')).map((section) => [
    section.dataset.chainName,
    Array.from(section.querySelectorAll('.vyasa-chain-card')).map((card) => card.dataset.taskId).filter(Boolean)
  ]));
  const saveChains = () => {
    const url = region?.dataset.saveUrl || '';
    if (!url) return;
    if (status) status.textContent = 'Saving...';
    fetch(url, {
      method: 'PUT',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({chains: collectChains()})
    }).then((response) => {
      if (!response.ok) throw new Error('save failed');
      if (status) status.textContent = 'Saved';
    }).catch(() => { if (status) status.textContent = 'Save failed'; });
  };
  const removeEmptyLanes = () => {
    lanesRoot.querySelectorAll('[data-chain-name]').forEach((section) => {
      if (!section.querySelector('.vyasa-chain-card')) section.remove();
    });
  };
  const bindLane = (lane) => {
    if (lane.dataset.bound === 'true') return;
    lane.dataset.bound = 'true';
    lane.addEventListener('dragover', (event) => event.preventDefault());
    lane.addEventListener('drop', (event) => {
      event.preventDefault();
      const id = event.dataTransfer.getData('text/plain');
      const card = draggedCard || region.querySelector(`.vyasa-chain-card[data-task-id="${CSS.escape(id)}"]`);
      if (!card) return;
      const after = Array.from(lane.querySelectorAll('.vyasa-chain-card')).find((item) => event.clientX < item.getBoundingClientRect().left + item.offsetWidth / 2);
      lane.insertBefore(card, after || null);
      removeEmptyLanes();
      refreshWarnings();
      saveChains();
    });
  };
  const refreshWarnings = () => {
    const taskIds = new Set(Array.from(document.querySelectorAll('.vyasa-task-card')).map((card) => card.dataset.taskId));
    const graph = Object.fromEntries(Array.from(taskIds).map((id) => [id, []]));
    document.querySelectorAll('.vyasa-task-card').forEach((card) => {
      (card.dataset.manualDeps || '').split(',').filter(Boolean).forEach((dep) => graph[card.dataset.taskId]?.push(dep));
    });
    lanesRoot.querySelectorAll('.vyasa-chain-lane').forEach((lane) => {
      const ids = Array.from(lane.querySelectorAll('.vyasa-chain-card')).map((card) => card.dataset.taskId).filter(Boolean);
      ids.slice(1).forEach((id, index) => graph[id]?.push(ids[index]));
    });
    const warnings = [];
    Object.entries(graph).forEach(([id, deps]) => deps.forEach((dep) => { if (!taskIds.has(dep)) warnings.push(`${id} depends on missing task ${dep}`); }));
    const visiting = new Set(), visited = new Set();
    const visit = (id, chain) => {
      if (visiting.has(id)) {
        const start = chain.indexOf(id);
        warnings.push(`Circular dependency: ${(start >= 0 ? chain.slice(start) : chain).join(' -> ')}`);
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      (graph[id] || []).filter((dep) => taskIds.has(dep)).forEach((dep) => visit(dep, chain.concat(dep)));
      visiting.delete(id); visited.add(id);
    };
    taskIds.forEach((id) => visit(id, [id]));
    const box = document.getElementById('vyasa-task-warnings');
    const list = box?.querySelector('ul');
    if (!box || !list) return;
    list.innerHTML = warnings.map((warning) => `<li>${warning.replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}</li>`).join('');
    box.style.display = warnings.length ? '' : 'none';
  };
  lanesRoot.querySelectorAll('.vyasa-chain-card').forEach((card) => {
    card.addEventListener('dragstart', (event) => {
      draggedCard = card;
      event.dataTransfer.setData('text/plain', card.dataset.taskId || '');
      card.classList.add('opacity-50');
    });
    card.addEventListener('dragend', () => { card.classList.remove('opacity-50'); draggedCard = null; });
  });
  lanesRoot.addEventListener('click', (event) => {
    const card = event.target.closest('.vyasa-chain-card');
    if (!card || !lanesRoot.contains(card)) return;
    openPreview(card.dataset.taskId || '');
  });
  lanesRoot.querySelectorAll('.vyasa-chain-lane').forEach(bindLane);
  const modal = region.querySelector('#vyasa-chain-modal');
  const input = region.querySelector('#vyasa-chain-name-input');
  const openModal = () => { modal?.classList.remove('hidden'); modal?.classList.add('flex'); if (input) input.value = ''; input?.focus(); };
  const closeModal = () => { pendingNewLaneCard = null; pendingNewLaneId = ''; modal?.classList.add('hidden'); modal?.classList.remove('flex'); };
  const createLane = () => {
    const name = input?.value?.trim();
    if (!name) return;
    const safe = name.replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const section = document.createElement('section');
    section.className = 'mt-4';
    section.dataset.chainName = name;
    section.innerHTML = `<h3 class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">${safe}</h3><div class="vyasa-chain-lane flex min-h-20 gap-2 overflow-x-auto rounded-lg border border-dashed border-slate-200 p-2 dark:border-slate-700"></div>`;
    lanesRoot.querySelector('p')?.remove();
    lanesRoot.appendChild(section);
    const lane = section.querySelector('.vyasa-chain-lane');
    bindLane(lane);
    const card = pendingNewLaneCard || (pendingNewLaneId ? region.querySelector(`.vyasa-chain-card[data-task-id="${CSS.escape(pendingNewLaneId)}"]`) : null);
    if (card && lane) lane.appendChild(card);
    pendingNewLaneCard = null;
    pendingNewLaneId = '';
    removeEmptyLanes();
    refreshWarnings();
    saveChains();
    modal?.classList.add('hidden'); modal?.classList.remove('flex');
  };
  const newDrop = region.querySelector('#vyasa-new-chain-drop');
  newDrop?.addEventListener('dragover', (event) => event.preventDefault());
  newDrop?.addEventListener('drop', (event) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    pendingNewLaneCard = draggedCard || region.querySelector(`.vyasa-chain-card[data-task-id="${CSS.escape(id)}"]`);
    pendingNewLaneId = id || pendingNewLaneCard?.dataset.taskId || '';
    if (pendingNewLaneCard || pendingNewLaneId) openModal();
  });
  region.querySelector('#vyasa-chain-cancel')?.addEventListener('click', closeModal);
  region.querySelector('#vyasa-chain-create')?.addEventListener('click', createLane);
  region.querySelector('#vyasa-task-preview-save')?.addEventListener('click', saveTask);
  region.querySelector('#vyasa-task-preview-close')?.addEventListener('click', closePreview);
  input?.addEventListener('keydown', (event) => { if (event.key === 'Enter') createLane(); if (event.key === 'Escape') closeModal(); });
  modal?.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
  previewModal?.addEventListener('click', (event) => { if (event.target === previewModal) closePreview(); });
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-task-preview-trigger]');
    if (trigger) openPreview(trigger.dataset.taskPreviewTrigger || '');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && previewModal && !previewModal.classList.contains('hidden')) closePreview();
  });
  refreshWarnings();
})();
"""),
    )
