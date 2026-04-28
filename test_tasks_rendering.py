from pathlib import Path

from vyasa.tasks_rendering import TaskItem, build_task_schedule, chain_dependencies, delete_task, parse_dependency_ids, parse_estimate_days, parse_tasks_document, parse_tasks_file, render_tasks_board, tasks_payload, upsert_task, validate_owner_overlaps, validate_task_dependencies, write_tasks_chains


def test_parse_tasks_file(tmp_path: Path):
    source = tmp_path / "sprint.tasks"
    source.write_text(
        '''
task S4-001 "Agent Response Accuracy"
  priority: P0
  points: 5
  estimate: 2d
  depends_on: [S4-002]
  phase: Foundation

task S4-002 "Web Search Enhancements"
  priority: P1
'''.strip(),
        encoding="utf-8",
    )

    tasks = parse_tasks_file(source)

    assert [task.id for task in tasks] == ["S4-001", "S4-002"]
    assert tasks[0].title == "Agent Response Accuracy"
    assert tasks[0].attrs["priority"] == "P0"
    assert tasks[0].attrs["depends_on"] == "[S4-002]"
    assert tasks[1].attrs["priority"] == "P1"


def test_parse_tasks_document_with_chain(tmp_path: Path):
    source = tmp_path / "sprint.tasks"
    source.write_text(
        '''
task A "First"
  estimate: 1d
task B "Second"
  estimate: 1d
chain Main
  A -> B
'''.strip(),
        encoding="utf-8",
    )

    tasks, chains = parse_tasks_document(source)

    assert [task.id for task in tasks] == ["A", "B"]
    assert chains == {"Main": ["A", "B"]}
    assert chain_dependencies(chains) == {"B": ["A"]}


def test_parse_dependency_ids():
    assert parse_dependency_ids("[S4-001, S4-002]") == ["S4-001", "S4-002"]
    assert parse_dependency_ids("S4-001") == ["S4-001"]
    assert parse_dependency_ids("[]") == []


def test_validate_task_dependencies_reports_missing_and_cycles():
    tasks = [
        TaskItem("A", "A task", {"depends_on": "[B, Z]"}),
        TaskItem("B", "B task", {"depends_on": "[A]"}),
    ]

    warnings = validate_task_dependencies(tasks)

    assert "A depends on missing task Z" in warnings
    assert "Circular dependency: A -> B -> A" in warnings


def test_build_task_schedule_uses_dependency_end_day():
    tasks = [
        TaskItem("A", "A task", {"estimate": "2d"}),
        TaskItem("B", "B task", {"estimate": "3d", "depends_on": "[A]"}),
        TaskItem("C", "C task", {"estimate": "1d", "depends_on": "[B]"}),
    ]

    schedule, warnings, critical_path = build_task_schedule(tasks)

    assert warnings == []
    assert schedule == {"A": (1, 2), "B": (3, 5), "C": (6, 6)}
    assert critical_path == {"A", "B", "C"}


def test_build_task_schedule_uses_chain_order():
    tasks = [
        TaskItem("A", "A task", {"estimate": "1d"}),
        TaskItem("B", "B task", {"estimate": "1d"}),
    ]

    schedule, warnings, _ = build_task_schedule(tasks, {"Main": ["A", "B"]})

    assert warnings == []
    assert schedule == {"A": (1, 1), "B": (2, 2)}


def test_write_tasks_chains_replaces_chain_blocks(tmp_path: Path):
    source = tmp_path / "sprint.tasks"
    source.write_text('task A "First"\n  estimate: 1d\n\ntask B "Second"\n  estimate: 1d\n\nchain Old\n  A\n', encoding="utf-8")

    write_tasks_chains(source, {"New": ["A", "B"]})

    assert source.read_text(encoding="utf-8") == 'task A "First"\n  estimate: 1d\n\ntask B "Second"\n  estimate: 1d\n  depends_on: [A]\n\nchain New\n  A -> B\n'


def test_task_crud_helpers(tmp_path: Path):
    source = tmp_path / "sprint.tasks"
    source.write_text('task A "First"\n  estimate: 1d\n', encoding="utf-8")

    upsert_task(source, "B", "Second", {"estimate": "2d", "owner": "Core"})
    payload = tasks_payload(source)
    delete_task(source, "A")

    assert payload["tasks"][1] == {"id": "B", "title": "Second", "attrs": {"estimate": "2d", "owner": "Core"}}
    assert 'task A "First"' not in source.read_text(encoding="utf-8")


def test_parse_estimate_days():
    assert parse_estimate_days("3d") == 3
    assert parse_estimate_days(" 12D ") == 12
    assert parse_estimate_days("4h") is None


def test_validate_owner_overlaps():
    tasks = [
        TaskItem("A", "A task", {"owner": "Jane"}),
        TaskItem("B", "B task", {"owner": "Jane"}),
        TaskItem("C", "C task", {"owner": "Sam"}),
    ]
    schedule = {"A": (1, 3), "B": (2, 4), "C": (2, 4)}

    warnings = validate_owner_overlaps(tasks, schedule)

    assert warnings == ["Jane overlap: A D1-D3 conflicts with B D2-D4"]


def test_render_tasks_board_uses_preview_modal_instead_of_bottom_card_wall(tmp_path: Path):
    source = tmp_path / "sprint.tasks"
    source.write_text(
        'task A "First"\n  estimate: 1d\n\ntask B "Second"\n  estimate: 1d\n\ntask C "Third"\n  estimate: 1d\n\ntask D "Fourth"\n  estimate: 1d\n\nchain Main\n  A -> B -> C -> D\n',
        encoding="utf-8",
    )

    html = str(render_tasks_board(source, "Sprint"))

    assert 'id="vyasa-task-preview-modal"' in html
    assert 'data-task-preview="A"' in html
    assert 'data-task-preview-trigger="A"' in html
    assert 'Build order' in html
    assert 'data-task-preview="D"' in html
    assert 'data-task-preview-trigger="B"' in html
    assert 'class="mt-8 space-y-3"' not in html
    assert 'S4-011' not in html
    assert html.count('data-task-preview-trigger="A"') == 3
