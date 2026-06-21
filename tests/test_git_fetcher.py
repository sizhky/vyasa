import subprocess

import pytest

from vyasa.config import get_config, reload_config
from vyasa.content_tree import resolve_ref_markdown
from vyasa.git_fetcher import MirrorSpec, fetch_all, fetch_clone_remotes, fetch_mirror, main


def _git(cwd, *args):
    subprocess.run(["git", "-C", str(cwd), *args], check=True, capture_output=True)


@pytest.fixture
def upstream(tmp_path):
    up = tmp_path / "up"
    up.mkdir()
    _git(up, "init", "-q", "-b", "main")
    _git(up, "config", "user.email", "t@t")
    _git(up, "config", "user.name", "t")
    (up / "a.md").write_text("# Doc A\n\nbody a\n")
    _git(up, "add", "-A")
    _git(up, "commit", "-qm", "c1")
    return up


def test_fetch_clone_then_prune_with_isolation(tmp_path, upstream):
    mirrors = tmp_path / "mirrors"
    spec = MirrorSpec("proj", str(upstream))
    assert fetch_all([spec], mirrors) == {"proj": True}
    assert (spec.mirror_path(mirrors) / "HEAD").exists()

    _git(upstream, "checkout", "-q", "-b", "feature")
    (upstream / "b.md").write_text("body b\n")
    _git(upstream, "add", "-A")
    _git(upstream, "commit", "-qm", "c2")
    _git(upstream, "checkout", "-q", "main")
    assert fetch_mirror(spec, mirrors) is True

    from vyasa.content_backend import GitBackend
    refs = {r.name for r in GitBackend(spec.mirror_path(mirrors)).list_refs()}
    assert refs == {"main", "feature"}

    _git(upstream, "branch", "-D", "feature")
    assert fetch_mirror(spec, mirrors) is True
    refs = {r.name for r in GitBackend(spec.mirror_path(mirrors)).list_refs()}
    assert refs == {"main"}  # pruned

    assert fetch_mirror(MirrorSpec("bad", "/no/such/repo"), mirrors) is False


def test_fetch_clone_remotes_fetches_all_remotes(tmp_path, upstream):
    clone = tmp_path / "clone"
    subprocess.run(["git", "clone", "-q", str(upstream), str(clone)], check=True, capture_output=True)
    _git(upstream, "checkout", "-q", "-b", "feature")
    (upstream / "b.md").write_text("body b\n")
    _git(upstream, "add", "-A")
    _git(upstream, "commit", "-qm", "c2")
    _git(upstream, "checkout", "-q", "main")

    assert fetch_clone_remotes(clone) is True
    from vyasa.content_backend import GitBackend

    refs = {r.name for r in GitBackend(clone / ".git").list_refs()}
    assert refs == {"local/main", "origin/main", "origin/feature"}


def test_fetched_mirror_is_mounted_and_served_at_ref(tmp_path, upstream, monkeypatch):
    site = tmp_path / "site"
    site.mkdir()
    mirrors = tmp_path / "mirrors"
    (site / ".vyasa").write_text(
        f'git_mirror_root = "{mirrors.as_posix()}"\n'
        f'git_repos = {{ proj = "{upstream.as_posix()}" }}\n'
    )
    monkeypatch.chdir(site)
    reload_config(site / ".vyasa")
    try:
        assert main(["--once"]) == 0
        assert get_config().get_git_mounts() == [("proj", (mirrors / "proj.git").resolve())]
        doc = resolve_ref_markdown("proj@main/a")
        assert doc is not None and doc.found
        assert doc.title == "Doc A" and doc.body == "body a\n"
    finally:
        reload_config()
