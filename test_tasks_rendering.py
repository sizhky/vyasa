from pathlib import Path

from vyasa.markdown_rendering import from_md
from vyasa.tasks_rendering import (
    TaskItem,
    build_task_schedule,
    chain_dependencies,
    parse_dependency_ids,
    parse_estimate_days,
    parse_tasks_document_text,
    parse_tasks_text,
    payload_to_tasks_document,
    render_tasks_board_text,
    tasks_fence_payload,
    validate_owner_overlaps,
    validate_task_dependencies,
    write_tasks_fence_payload,
)


def test_parse_tasks_text():
    tasks = parse_tasks_text(
        'task S4-001 "Agent Response Accuracy"\n'
        '  priority: P0\n'
        '  points: 5\n'
        '  estimate: 2d\n'
        '  depends_on: [S4-002]\n'
        '  phase: Foundation\n\n'
        'task S4-002 "Web Search Enhancements"\n'
        '  priority: P1\n'
    )

    assert [task.id for task in tasks] == ["S4-001", "S4-002"]
    assert tasks[0].title == "Agent Response Accuracy"
    assert tasks[0].attrs["priority"] == "P0"
    assert tasks[0].attrs["depends_on"] == "[S4-002]"
    assert tasks[1].attrs["priority"] == "P1"


def test_parse_tasks_document_text_with_chain():
    tasks, chains = parse_tasks_document_text(
        'task A "First"\n'
        '  estimate: 1d\n'
        'task B "Second"\n'
        '  estimate: 1d\n'
        'chain Main\n'
        '  A -> B\n'
    )

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


def test_payload_to_tasks_document_replaces_chain_edges_with_explicit_dependencies():
    tasks, chains = payload_to_tasks_document(
        {
            "tasks": [
                {"id": "A", "title": "First", "attrs": {"estimate": "1d"}},
                {"id": "B", "title": "Second", "attrs": {"estimate": "1d", "depends_on": "[]"}},
                {"id": "C", "title": "Third", "attrs": {"estimate": "1d", "depends_on": "[B]"}},
            ],
            "chains": {},
        }
    )

    assert chains == {}
    assert tasks[1].attrs.get("depends_on") == "[]"
    assert tasks[2].attrs.get("depends_on") == "[B]"


def test_tasks_fence_payload_roundtrip(tmp_path: Path):
    source = tmp_path / "sprint.md"
    source.write_text('## Plan\n\n```tasks\n task A "First"\n   estimate: 1d\n\n task B "Second"\n   estimate: 1d\n chain Main\n   A -> B\n```\n', encoding="utf-8")

    payload = tasks_fence_payload(source, 0)
    payload["chains"] = {}
    payload["tasks"][1]["attrs"]["depends_on"] = "[]"
    write_tasks_fence_payload(source, 0, payload)

    rewritten = source.read_text(encoding="utf-8")

    assert "```tasks" in rewritten
    assert "chain Main" not in rewritten
    assert "depends_on: []" in rewritten


def test_markdown_tasks_fence_renders_inline_board(tmp_path: Path):
    source = tmp_path / "sprint.md"
    source.write_text('## Plan\n\n```tasks\n task A "First"\n   estimate: 1d\n\n task B "Second"\n   estimate: 1d\n   depends_on: [A]\n```\n', encoding="utf-8")

    html = str(from_md(source.read_text(encoding="utf-8"), current_path="sprint"))

    assert 'id="vyasa-task-flow-host"' in html
    assert '/api/tasks/blocks/sprint?block=0' in html
    assert ">Tasks<" in html


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


def test_render_tasks_board_text_uses_preview_modal():
    html = str(
        render_tasks_board_text(
            'task A "First"\n'
            '  estimate: 1d\n\n'
            'task B "Second"\n'
            '  estimate: 1d\n'
            '  depends_on: [A]\n\n'
            'task C "Third"\n'
            '  estimate: 1d\n'
            '  depends_on: [B]\n\n'
            'task D "Fourth"\n'
            '  estimate: 1d\n'
            '  depends_on: [C]\n',
            task_api_url="/api/tasks/blocks/sprint?block=0",
        )
    )

    assert 'id="vyasa-task-preview-modal"' in html
    assert 'data-task-preview="A"' in html
    assert 'Dependencies' in html
    assert 'Dependants' in html
    assert 'Build order' not in html
    assert 'data-task-preview="D"' in html
    assert 'data-task-preview-trigger="B"' in html
    assert 'data-task-preview-trigger="C"' in html
    assert 'data-task-preview-trigger="D"' in html
    assert ">Tasks<" in html
    assert "Dependency lanes" not in html
    assert "vyasa-chain-lane" not in html
    assert 'id="vyasa-task-flow-host"' in html
    assert 'data-task-graph="' in html
    assert '<details id="vyasa-task-warnings"' in html
    assert html.count('data-task-preview-trigger="A"') == 1
