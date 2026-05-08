from pathlib import Path

from fasthtml.common import to_xml

from vyasa.build import build_post_tree_static
from vyasa.content_tree import ContentTree
from vyasa.tree_tables import parse_tree_table, render_tree_table_html


def test_parse_tree_table_extracts_hierarchy_and_rows():
    tree_text = (
        "# sheet: Scope\n"
        "# hierarchy: Persona | Module | Feature | Sub Feature\n"
        "# columns: Hours | Complexity\n\n"
        "Ops\n"
        "    Intake\n"
        "        Check In\n"
        "            Capture details\t12\tM\n"
    )

    parsed = parse_tree_table(tree_text)

    assert parsed["sheet"] == "Scope"
    assert parsed["hierarchy"] == ["Persona", "Module", "Feature", "Sub Feature"]
    assert parsed["columns"] == ["Hours", "Complexity"]
    assert parsed["rows"] == [{"path": ["Ops", "Intake", "Check In", "Capture details"], "values": ["12", "M"]}]


def test_render_tree_table_html_outputs_table_cells():
    html = render_tree_table_html(
        "# hierarchy: A | B | C | D\n# columns: Hours\n\nA\n    B\n        C\n            D\t9\n",
        include_heading=False,
    )

    assert "vyasa-tree-table" in html
    assert "<th>Hours</th>" in html
    assert "<td class=\"vyasa-tree-table-h3\">C</td>" in html
    assert ">9</td>" in html


def test_content_tree_resolves_tree_documents(tmp_path):
    root = tmp_path / "site"
    root.mkdir()
    (root / "scope.tree").write_text("# hierarchy: A | B | C | D\n", encoding="utf-8")

    resolved = ContentTree(root=root).resolve_document("scope")

    assert resolved is not None
    assert resolved.kind == "tree"
    assert resolved.path == (root / "scope.tree").resolve()


def test_build_post_tree_static_includes_tree_files(tmp_path):
    root = tmp_path / "site"
    root.mkdir()
    (root / "scope.tree").write_text("# hierarchy: A | B | C | D\n", encoding="utf-8")

    html = to_xml(build_post_tree_static(root, root))

    assert "/posts/scope.html" in html
