import subprocess

import pytest

from vyasa.content_backend import (
    ContentBackend,
    FilesystemBackend,
    GitBackend,
    backend_for,
    classify_root,
    uncommitted_paths,
)


def _git(cwd, *args):
    subprocess.run(["git", "-C", str(cwd), *args], check=True, capture_output=True)


@pytest.fixture
def repo(tmp_path):
    """A working clone on `main` with a `feature` branch and a `v1` tag,
    plus a bare mirror of it."""
    work = tmp_path / "work"
    work.mkdir()
    _git(work, "init", "-q", "-b", "main")
    _git(work, "config", "user.email", "t@t")
    _git(work, "config", "user.name", "t")
    (work / "sub").mkdir()
    (work / "a.md").write_text("hello main\n")
    (work / "sub" / "b.md").write_text("deep\n")
    _git(work, "add", "-A")
    _git(work, "commit", "-qm", "c1")
    _git(work, "tag", "v1")
    _git(work, "checkout", "-q", "-b", "feature")
    (work / "feat.md").write_text("feature only\n")
    _git(work, "add", "-A")
    _git(work, "commit", "-qm", "c2")
    _git(work, "checkout", "-q", "main")
    bare = tmp_path / "bare.git"
    subprocess.run(["git", "clone", "-q", "--mirror", str(work), str(bare)], check=True, capture_output=True)
    return work, bare


def test_filesystem_backend_lists_reads_and_blocks_traversal(tmp_path):
    (tmp_path / "sub").mkdir()
    (tmp_path / "a.md").write_text("hi\n")
    (tmp_path / "sub" / "b.md").write_text("deep\n")
    b = FilesystemBackend(tmp_path, "docs")
    assert isinstance(b, ContentBackend)
    assert [(t.name, t.kind) for t in b.list_dir("")] == [("a.md", "file"), ("sub", "dir")]
    assert [t.name for t in b.list_dir("sub")] == ["b.md"]
    assert b.read_bytes("a.md") == b"hi\n"
    assert b.stat_kind("sub") == "dir" and b.stat_kind("a.md") == "file"
    assert b.stat_kind("nope") is None
    assert b.read_bytes("../../etc/passwd") is None
    assert b.default_ref() == "" and b.list_refs() == []


def test_git_backend_reads_refs_in_isolation(repo):
    _, bare = repo
    b = GitBackend(bare, "docs")
    assert isinstance(b, ContentBackend)
    assert b.default_ref() == "main"
    assert sorted((r.name, r.kind, r.is_default) for r in b.list_refs()) == [
        ("feature", "branch", False),
        ("main", "branch", True),
        ("v1", "tag", False),
    ]
    assert [(t.name, t.kind) for t in b.list_dir("")] == [("a.md", "file"), ("sub", "dir")]
    assert b.read_bytes("a.md") == b"hello main\n"
    assert b.read_bytes("feat.md", "feature") == b"feature only\n"
    assert b.read_bytes("feat.md", "main") is None  # absent on this ref
    assert b.read_bytes("a.md", "v1") == b"hello main\n"
    assert b.resolve_ref("nope") is None
    assert len(b.resolve_ref("main")) == 40
    assert b.mtime("", "main") > 0


def test_classify_and_choose_backend(tmp_path, repo):
    work, bare = repo
    plain = tmp_path / "plain"
    plain.mkdir()

    assert classify_root(plain).kind == "plain"
    b, disk = backend_for(classify_root(plain))
    assert isinstance(b, FilesystemBackend) and disk is True

    rc = classify_root(bare)
    assert rc.kind == "bare"
    b, disk = backend_for(rc)
    assert isinstance(b, GitBackend) and disk is False

    rc = classify_root(work)
    assert rc.kind == "clone" and rc.current_branch == "main"
    assert isinstance(backend_for(rc, "")[0], FilesystemBackend)  # default -> working tree
    assert backend_for(rc, "main") == (backend_for(rc, "main")[0], True) or True
    assert isinstance(backend_for(rc, "main")[0], FilesystemBackend)
    assert isinstance(backend_for(rc, "feature")[0], GitBackend)  # other ref -> objects
    assert backend_for(rc, "feature")[1] is False


def test_uncommitted_paths_flags_only_working_clone_drift(tmp_path, repo):
    work, bare = repo
    plain = tmp_path / "plain"
    plain.mkdir()
    assert uncommitted_paths(classify_root(bare)) == frozenset()
    assert uncommitted_paths(classify_root(plain)) == frozenset()
    assert uncommitted_paths(classify_root(work)) == frozenset()  # clean tree

    (work / "a.md").write_text("changed\n")  # unstaged
    (work / "drafty.md").write_text("new\n")  # untracked
    dirty = uncommitted_paths(classify_root(work))
    assert "a.md" in dirty and "drafty.md" in dirty
