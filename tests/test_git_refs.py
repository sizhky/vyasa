import subprocess

import pytest

from vyasa.config import reload_config
from vyasa.content_tree import resolve_ref_markdown


def _git(cwd, *args):
    subprocess.run(["git", "-C", str(cwd), *args], check=True, capture_output=True)


@pytest.fixture
def site(tmp_path, monkeypatch):
    """A primary site that mounts a sibling git clone as the `repo` root.
    The clone is checked out on `main`; `feature` adds feat.md."""
    site = tmp_path / "site"
    repo = tmp_path / "repo"
    site.mkdir()
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.email", "t@t")
    _git(repo, "config", "user.name", "t")
    (repo / "a.md").write_text("# Main A\n\nmain body\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", "c1")
    _git(repo, "checkout", "-q", "-b", "feature")
    (repo / "feat.md").write_text("# Feature\n\nonly feature\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", "c2")
    _git(repo, "checkout", "-q", "main")
    (site / ".vyasa").write_text('vyasa_roots = ["../repo"]\n')
    monkeypatch.chdir(site)
    reload_config(site / ".vyasa")
    yield site
    reload_config()


def test_ref_markdown_reads_non_current_ref_from_objects(site):
    doc = resolve_ref_markdown("repo@feature/feat")
    assert doc is not None and doc.found
    assert doc.title == "Feature" and doc.body == "only feature\n"
    assert doc.relative == "feat.md" and len(doc.sha) == 40


def test_ref_markdown_soft_missing_when_path_absent_on_ref(site):
    doc = resolve_ref_markdown("repo@feature/missing")
    assert doc is not None and doc.found is False
    assert doc.title  # a slug-derived title is still produced


def test_ref_equal_to_checked_out_branch_falls_back_to_disk(site):
    # ref == current branch -> working tree (disk) -> None tells the caller
    # to use the normal disk pipeline.
    assert resolve_ref_markdown("repo@main/a") is None


def test_no_ref_uses_disk_pipeline(site):
    assert resolve_ref_markdown("repo/a") is None


def test_non_markdown_kinds_and_blobs_at_a_ref(site):
    from vyasa.content_tree import resolve_ref_blob, resolve_ref_document
    from vyasa.extensions import build_extension_runtime, get_extension_runtime, set_extension_runtime

    work = site.parent / "repo"
    _git(work, "checkout", "-q", "feature")
    (work / "doc.html").write_text("<h1>HTML</h1>")
    (work / "file.pdf").write_bytes(b"%PDF-1.4 fake")
    _git(work, "add", "-A")
    _git(work, "commit", "-qm", "c3")
    _git(work, "checkout", "-q", "main")

    previous = get_extension_runtime()
    set_extension_runtime(build_extension_runtime({"preset": "default"}))
    try:
        assert resolve_ref_document("repo@feature/doc").kind == "html"
        assert resolve_ref_document("repo@feature/file").kind == "pdf"
        assert resolve_ref_document("repo@feature/feat").kind == "markdown"
        assert resolve_ref_blob("repo@feature/doc", ".html") == b"<h1>HTML</h1>"
        assert resolve_ref_blob("repo@feature/file", ".pdf") == b"%PDF-1.4 fake"
        assert resolve_ref_blob("repo@main/a", ".md") is None  # disk-served -> FileResponse
    finally:
        set_extension_runtime(previous)


def test_sidebar_tree_built_for_a_ref(site):
    import vyasa.core as core
    from fasthtml.common import Ul, to_xml

    items = core.build_ref_post_tree("repo", "feature", roles=[])
    html = to_xml(Ul(*items))
    assert "repo%40feature/feat" in html  # feature-only file, ref-carrying link
    assert "repo%40feature/a" in html
    # disk-served ref (current branch) -> None, caller uses disk tree
    assert core.build_ref_post_tree("repo", "main", roles=[]) is None
