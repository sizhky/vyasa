from vyasa.config import reload_config
from fasthtml.common import to_xml
import vyasa.core as core
from vyasa.content_tree import CallableVisibility, ContentTree
from vyasa.extensions import build_extension_runtime, get_extension_runtime, set_extension_runtime


def test_content_tree_lists_mounts_and_resolves_alias_slug(monkeypatch, tmp_path):
    root = tmp_path / "site"
    extra = tmp_path / "notes"
    root.mkdir()
    extra.mkdir()
    (extra / "page.md").write_text("# Page\n", encoding="utf-8")
    (root / ".vyasa").write_text('vyasa_roots = ["../notes"]\n', encoding="utf-8")
    monkeypatch.chdir(root)
    reload_config(root / ".vyasa")

    tree = ContentTree.from_runtime()
    entries = tree.list_entries()
    resolved = tree.resolve_document("notes/page")

    assert [(entry.slug, entry.kind, entry.path) for entry in entries] == [("notes", "folder", extra.resolve())]
    assert resolved is not None
    assert resolved.kind == "markdown"
    assert resolved.path == (extra / "page.md").resolve()


def test_content_tree_preserves_vyasa_order_hidden_pruning_and_folder_notes(tmp_path):
    root = tmp_path
    (root / ".hidden").mkdir()
    (root / ".hidden" / "secret.md").write_text("# Secret\n", encoding="utf-8")
    (root / "guide").mkdir()
    (root / "guide" / "index.md").write_text("# Guide Home\n", encoding="utf-8")
    (root / "b.md").write_text("# Bee\n", encoding="utf-8")
    (root / "a.md").write_text("# Aye\n", encoding="utf-8")
    (root / ".vyasa").write_text('order = ["b", "guide", "a"]\n', encoding="utf-8")

    tree = ContentTree(root=root, show_hidden=False, excluded_dirs=set())
    entries = tree.list_entries_for_path(root)

    assert [(entry.slug, entry.kind, entry.has_folder_note) for entry in entries] == [
        ("b", "markdown", False),
        ("guide", "folder", True),
        ("a", "markdown", False),
    ]
    assert tree.find_folder_note("guide") == (root / "guide" / "index.md").resolve()


def test_content_tree_resolves_document_before_same_name_folder(tmp_path):
    root = tmp_path
    (root / "docs" / "architecture").mkdir(parents=True)
    (root / "docs" / "architecture.md").write_text("# Architecture\n", encoding="utf-8")

    resolved = ContentTree(root=root).resolve_document("docs/architecture")

    assert resolved is not None
    assert resolved.kind == "markdown"
    assert resolved.path == (root / "docs" / "architecture.md").resolve()


def test_content_tree_discovers_html_documents(tmp_path):
    page = tmp_path / "dashboard.html"
    page.write_text("<h1>Dashboard</h1>", encoding="utf-8")

    tree = ContentTree(root=tmp_path)
    resolved = tree.resolve_document("dashboard")

    assert [(entry.slug, entry.kind) for entry in tree.list_entries()] == [("dashboard", "html")]
    assert resolved is not None
    assert resolved.kind == "html"
    assert resolved.path == page.resolve()


def test_content_tree_rejects_mdx_suffix(tmp_path):
    page = tmp_path / "dashboard.mdx"
    page.write_text("# Dashboard\n\n<Widget />\n", encoding="utf-8")

    tree = ContentTree(root=tmp_path)
    resolved = tree.resolve_document("dashboard")

    assert tree.list_entries() == []
    assert resolved is None


def test_content_tree_discovers_mdx_in_named_folder_markdown(tmp_path):
    folder = tmp_path / "demo"
    folder.mkdir()
    page = folder / "demo.md"
    page.write_text("# Demo\n\n<Widget />\n", encoding="utf-8")

    resolved = ContentTree(root=tmp_path).resolve_document("demo")

    assert resolved is not None
    assert resolved.kind == "mdx"
    assert resolved.path == page.resolve()


def test_content_tree_discovers_kg_pack_as_document(tmp_path):
    pack = tmp_path / "roadmap.kg"
    pack.mkdir()
    (pack / "kg.schema").write_text("@graph id=roadmap title=Roadmap\n@sources\nnodes=kg.nodes\n", encoding="utf-8")
    (pack / "kg.nodes").write_text("n1: Start\n", encoding="utf-8")
    (pack / "notes.md").write_text("# Sidecar note\n", encoding="utf-8")

    tree = ContentTree(root=tmp_path)
    resolved = tree.resolve_document("roadmap")

    assert [(entry.slug, entry.kind) for entry in tree.list_entries()] == [("roadmap.kg", "kg")]
    assert resolved is not None
    assert resolved.kind == "kg"
    assert resolved.path == pack.resolve()


def test_content_tree_keeps_kg_pack_slug_when_markdown_shares_stem(tmp_path):
    pack = tmp_path / "chapter-1.kg"
    pack.mkdir()
    (pack / "kg.schema").write_text("@graph id=chapter title=Chapter\n@sources\nnodes=kg.nodes\n", encoding="utf-8")
    (pack / "kg.nodes").write_text("n1: Start\n", encoding="utf-8")
    (tmp_path / "chapter-1.md").write_text("# Chapter\n", encoding="utf-8")

    tree = ContentTree(root=tmp_path)

    assert [(entry.slug, entry.kind) for entry in tree.list_entries()] == [
        ("chapter-1.kg", "kg"),
        ("chapter-1", "markdown"),
    ]
    assert tree.resolve_document("chapter-1.kg").kind == "kg"
    assert tree.resolve_document("chapter-1").kind == "markdown"


def test_sidebar_renders_kg_pack_row_when_markdown_shares_stem(monkeypatch, tmp_path):
    pack = tmp_path / "chapter-1.kg"
    pack.mkdir()
    (pack / "kg.schema").write_text("@graph id=chapter title=Chapter\n@sources\nnodes=kg.nodes\n", encoding="utf-8")
    (pack / "kg.nodes").write_text("n1: Start\n", encoding="utf-8")
    (tmp_path / "chapter-1.md").write_text("# Chapter\n", encoding="utf-8")
    (tmp_path / ".vyasa").write_text("", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    reload_config(tmp_path / ".vyasa")
    core._nav_entries_cache.clear()

    try:
        html = to_xml(core.build_post_tree(tmp_path))
    finally:
        reload_config()

    assert "/posts/chapter-1.kg" in html
    assert "/posts/chapter-1" in html


def test_sidebar_uses_mdx_icon_for_markdown_with_component(monkeypatch, tmp_path):
    page = tmp_path / "demo.md"
    page.write_text("# Demo\n\n<Widget />\n", encoding="utf-8")
    (tmp_path / ".vyasa").write_text("", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    reload_config(tmp_path / ".vyasa")
    core._nav_entries_cache.clear()

    try:
        html = to_xml(core.build_post_tree(tmp_path))
    finally:
        reload_config()

    assert 'icon="file-code"' in html


def test_sidebar_navigation_uses_enabled_document_suffixes(monkeypatch, tmp_path):
    captured = {}
    monkeypatch.setattr(core, "enabled_document_suffixes", lambda: (".md", ".html"))
    monkeypatch.setattr(
        core,
        "get_tree_entries",
        lambda folder, root, show_hidden, excluded_dirs, suffixes: captured.setdefault("suffixes", suffixes) or [],
    )
    core._nav_entries_cache.clear()

    core._get_nav_entries(tmp_path, tmp_path, False, set())

    assert captured["suffixes"] == (".md", ".html")


def test_content_tree_visibility_filters_file_entries(tmp_path):
    root = tmp_path
    (root / "public.md").write_text("# Public\n", encoding="utf-8")
    (root / "private.md").write_text("# Private\n", encoding="utf-8")
    visibility = CallableVisibility(lambda route, roles, rules: route != "/posts/private")

    tree = ContentTree(root=root, show_hidden=False, excluded_dirs=set(), visibility=visibility)

    assert [entry.slug for entry in tree.list_entries_for_path(root)] == ["public"]


def test_content_tree_fingerprint_changes_on_content_edit(tmp_path):
    root = tmp_path
    page = root / "page.md"
    page.write_text("# One\n", encoding="utf-8")
    tree = ContentTree(root=root)
    before = tree.fingerprint()

    page.write_text("# Two\n\nMore.\n", encoding="utf-8")

    assert tree.fingerprint() >= before


def test_content_tree_hides_pdf_and_tree_when_extensions_disabled(tmp_path):
    root = tmp_path / "site"
    root.mkdir()
    (root / "guide.md").write_text("# Guide\n", encoding="utf-8")
    (root / "brochure.pdf").write_text("pdf", encoding="utf-8")
    (root / "scope.tree").write_text("# hierarchy: A | B\n", encoding="utf-8")
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
        tree = ContentTree(root=root)
        assert [entry.slug for entry in tree.list_entries()] == ["guide"]
        assert tree.resolve_document("brochure") is None
        assert tree.resolve_document("scope") is None
    finally:
        set_extension_runtime(previous)
