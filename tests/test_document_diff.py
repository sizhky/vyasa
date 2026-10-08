from dulwich import porcelain
from fasthtml.common import to_xml

from vyasa.content_backend import owning_clone, staged_text, uncommitted_paths, unstaged_paths
from vyasa.document_pages import diff_button
from vyasa.extensions_builtin.link_preview.code_reference_render import markdown_diff_html


def _repo(tmp_path):
    tmp_path.mkdir(parents=True, exist_ok=True)
    porcelain.init(str(tmp_path))
    _write_and_stage(tmp_path, "# Title\n\nOld paragraph.\n")
    porcelain.commit(str(tmp_path), message=b"init", author=b"t <t@t>", committer=b"t <t@t>")
    return tmp_path


def _write_and_stage(root, text):
    (root / "doc.md").write_text(text, encoding="utf-8")
    porcelain.add(str(root), [str(root / "doc.md")])


def test_clean_file_has_no_unstaged_change(tmp_path):
    rc, rel = owning_clone(_repo(tmp_path) / "doc.md")
    assert rel not in unstaged_paths(rc)


def test_unstaged_edit_diffs_against_index(tmp_path):
    root = _repo(tmp_path)
    _write_and_stage(root, "# Title\n\nStaged paragraph.\n")
    (root / "doc.md").write_text("# Title\n\nWorking paragraph.\n", encoding="utf-8")
    rc, rel = owning_clone(root / "doc.md")
    assert rel in unstaged_paths(rc)
    before = staged_text(rc, rel)
    assert "Staged paragraph." in before
    html = markdown_diff_html(before, (root / "doc.md").read_text(), "doc")
    assert 'data-markdown-diff-state="deleted"' in html and 'data-markdown-diff-state="added"' in html


def test_staged_only_change_has_no_diff_but_keeps_banner(tmp_path):
    root = _repo(tmp_path)
    _write_and_stage(root, "# Title\n\nStaged paragraph.\n")
    rc, rel = owning_clone(root / "doc.md")
    assert rel not in unstaged_paths(rc)
    assert rel in uncommitted_paths(rc)


def test_untracked_file_has_empty_base(tmp_path):
    root = _repo(tmp_path)
    (root / "new.md").write_text("Fresh.\n", encoding="utf-8")
    rc, rel = owning_clone(root / "new.md")
    assert rel in unstaged_paths(rc) and staged_text(rc, rel) == ""


def test_repo_nested_below_content_root(tmp_path):
    repo = _repo(tmp_path / "project")
    rc, rel = owning_clone(repo / "doc.md")
    assert rel == "doc.md" and rc.path == repo.resolve()


def test_plain_folder_has_no_clone(tmp_path):
    (tmp_path / "doc.md").write_text("x\n", encoding="utf-8")
    assert owning_clone(tmp_path / "doc.md") is None


def test_diff_button_toggles_target():
    assert 'href="/diff/notes/a"' in to_xml(diff_button("notes/a"))
    closed = to_xml(diff_button("notes/a", active=True))
    assert 'href="/posts/notes/a"' in closed and "Close diff" in closed


def test_consecutive_added_blocks_share_one_section():
    html = markdown_diff_html("# A\n", "# A\n\n## B\n\nOne.\n\n## C\n\nTwo.\n", "doc")
    assert html.count('data-markdown-diff-state="added"') == 1
    assert "Two." in html
