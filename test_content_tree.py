from vyasa.config import reload_config
from vyasa.content_tree import CallableVisibility, ContentTree


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
