from pathlib import Path
from types import SimpleNamespace

from fasthtml.common import to_xml

from vyasa.build import build_post_tree_static, build_static_site
from vyasa.content_tree import ContentTree
from vyasa.extensions import build_extension_runtime, get_extension_runtime, set_extension_runtime
from vyasa.extensions_builtin.html_viewer import render_html_document
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


def test_html_document_runtime_uses_raw_html_route(tmp_path):
    page = tmp_path / "dashboard.html"
    page.write_text("<h1>Dashboard</h1>", encoding="utf-8")
    context = SimpleNamespace(
        path="dashboard", abbreviations=[], slug_to_title=lambda value, abbreviations=None: value.title(),
        breadcrumbs=None, document=SimpleNamespace(path=page), layout=lambda body, **kwargs: body,
        htmx=False, blog_title="Site", auth=None,
    )

    html = to_xml(render_html_document(context))

    assert 'src="/posts/dashboard.html"' in html
    assert 'sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"' in html


def test_build_post_tree_static_includes_tree_files(tmp_path):
    root = tmp_path / "site"
    root.mkdir()
    (root / "scope.tree").write_text("# hierarchy: A | B | C | D\n", encoding="utf-8")

    html = to_xml(build_post_tree_static(root, root))

    assert "/posts/scope.html" in html


def test_build_post_tree_static_hides_tree_without_extension(tmp_path):
    root = tmp_path / "site"
    root.mkdir()
    (root / "scope.tree").write_text("# hierarchy: A | B | C | D\n", encoding="utf-8")
    runtime = build_extension_runtime(
        {
            "preset": "default",
            "render": [
                "wikilinks",
                "link_preview",
                "tabs",
                "mermaid",
                "d2",
                "cytograph",
                "cryptograph",
                "tasks",
                "pdf_viewer",
                "document_actions",
                "table_of_contents",
                "scoped_custom_css",
                "code_tools",
                "default_favicon",
            ],
        }
    )
    previous = get_extension_runtime()
    set_extension_runtime(runtime)
    try:
        html = to_xml(build_post_tree_static(root, root))
    finally:
        set_extension_runtime(previous)

    assert "/posts/scope.html" not in html


def test_static_build_uses_document_type_extensions_for_pdf_and_tree(tmp_path, monkeypatch):
    root = tmp_path / "site"
    output = tmp_path / "dist"
    root.mkdir()
    (root / "guide.md").write_text("# Guide\n", encoding="utf-8")
    (root / "brochure.pdf").write_bytes(b"%PDF-1.4\n")
    (root / "scope.tree").write_text("# sheet: Scope\n# hierarchy: A | B\n\nA\n    B\n", encoding="utf-8")
    monkeypatch.setenv("VYASA_ROOT", str(root))

    build_static_site(input_dir=root, output_dir=output)

    assert (output / "posts" / "brochure.html").exists()
    assert (output / "posts" / "brochure.pdf").read_bytes() == b"%PDF-1.4\n"
    assert "PDF preview not available" in (output / "posts" / "brochure.html").read_text(encoding="utf-8")
    assert "vyasa-tree-table" in (output / "posts" / "scope.html").read_text(encoding="utf-8")


def test_static_build_wraps_html_document_without_overwriting_source(tmp_path, monkeypatch):
    root = tmp_path / "site"
    output = tmp_path / "dist"
    root.mkdir()
    (root / "dashboard.html").write_text("<h1>Dashboard</h1>", encoding="utf-8")
    monkeypatch.setenv("VYASA_ROOT", str(root))

    build_static_site(input_dir=root, output_dir=output)

    rendered = (output / "posts" / "dashboard.html").read_text(encoding="utf-8")
    assert "Dashboard (HTML)" in rendered
    assert "srcdoc=" in rendered
    assert "&lt;h1&gt;Dashboard&lt;/h1&gt;" in rendered


def test_static_build_copies_raw_and_download_files_through_filesystem_routes(tmp_path, monkeypatch):
    root = tmp_path / "site"
    output = tmp_path / "dist"
    root.mkdir()
    (root / "guide.md").write_text("# Guide\n\n[download:data.json]\n", encoding="utf-8")
    (root / "data.json").write_text('{"ok":true}\n', encoding="utf-8")
    monkeypatch.setenv("VYASA_ROOT", str(root))

    build_static_site(input_dir=root, output_dir=output)

    assert (output / "download" / "data.json").read_text(encoding="utf-8") == '{"ok":true}\n'
    assert (output / "posts" / "guide.md").read_text(encoding="utf-8").startswith("# Guide")
    assert (output / "posts" / "data.json").read_text(encoding="utf-8") == '{"ok":true}\n'
