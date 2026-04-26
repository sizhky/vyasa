from fasthtml.common import to_xml

from vyasa.tree_file_rendering import parse_tree_document, render_tree_document
from vyasa.tree_service import get_tree_entries


def test_tree_document_parses_indentation_as_hierarchy():
    document = parse_tree_document(
        """# conveyor-belt-monitor

[Edge Inference Pipeline]
    Snapshot Scheduler
        Cron Trigger (15s cycle)            S   BE  W  P1
        Frame Grab (6-camera batch)         M   BE  W  P1
"""
    )

    assert document.title == "conveyor-belt-monitor"
    assert document.roots[0].label == "Edge Inference Pipeline"
    assert document.roots[0].children[0].label == "Snapshot Scheduler"
    leaf = document.roots[0].children[0].children[0]
    assert leaf.label == "Cron Trigger (15s cycle)"
    assert leaf.meta == ["S", "BE", "W", "P1"]


def test_tree_document_renders_hierarchy_html():
    document = parse_tree_document(
        """[Alert Delivery]
    Telegram Bot
        Bot Token Setup XS BE W P1
"""
    )

    html = to_xml(render_tree_document(document))

    assert "vyasa-tree-doc" in html
    assert "vyasa-tree-section-row" in html
    assert "Telegram Bot" in html
    assert '<span class="vyasa-tree-chip">P1</span>' in html


def test_tree_meta_parser_keeps_uppercase_label_suffixes():
    document = parse_tree_document("Schema Alignment with EB            S   BE  W  P2")
    node = document.roots[0]

    assert node.label == "Schema Alignment with EB"
    assert node.meta == ["S", "BE", "W", "P2"]


def test_tree_meta_parser_reads_tabular_tail():
    document = parse_tree_document(
        "Cron Trigger (15s cycle)\t3\tS\tBackend\tWeb\tPhase 1"
    )
    node = document.roots[0]

    assert node.label == "Cron Trigger (15s cycle)"
    assert node.meta == ["3", "S", "Backend", "Web", "Phase 1"]


def test_tree_document_with_columns_renders_table():
    document = parse_tree_document(
        """# sheet: Scope
# hierarchy: Module | Feature | Sub Feature
# columns: #pages | Complexity | Component | Form Factor | Milestone

Edge Inference Pipeline
    Snapshot Scheduler
        Cron Trigger (15s cycle)\t3\tS\tBackend\tWeb\tPhase 1
        Frame Grab (6-camera batch)\t3\tM\tBackend\tWeb\tPhase 1
"""
    )

    html = to_xml(render_tree_document(document))

    assert "vyasa-tree-table" in html
    assert "<th>Module</th>" in html
    assert "<th>#pages</th>" in html
    assert 'rowspan="2"' in html
    assert "<td" in html and "Cron Trigger (15s cycle)" in html
    assert "vyasa-tree-chip" not in html


def test_tree_entries_include_tree_files(tmp_path):
    root = tmp_path
    (root / "scope.tree").write_text("[Scope]\n", encoding="utf-8")
    (root / "note.md").write_text("# Note\n", encoding="utf-8")

    entries = get_tree_entries(root, root, False, set(), (".md", ".tree"))

    assert {entry.name for entry in entries} == {"note.md", "scope.tree"}
