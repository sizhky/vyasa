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
