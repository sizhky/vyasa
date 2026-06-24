import subprocess
from pathlib import Path

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


def test_ref_kg_document_renders_pack_from_objects(site):
    from fasthtml.common import to_xml

    from vyasa.content_backend import ref_read_scope
    from vyasa.content_tree import resolve_ref_document
    from vyasa.extensions import build_extension_runtime, get_extension_runtime, set_extension_runtime
    from vyasa.extensions_builtin.tasks import render_kg_document

    work = site.parent / "repo"
    _git(work, "checkout", "-q", "feature")
    pack = work / "roadmap.kg"
    pack.mkdir()
    (pack / "kg.schema").write_text("@graph id=roadmap title=Roadmap\n@sources\nnodes=kg.nodes\n", encoding="utf-8")
    (pack / "kg.nodes").write_text("n1: Start\n", encoding="utf-8")
    _git(work, "add", "-A")
    _git(work, "commit", "-qm", "kg")
    _git(work, "checkout", "-q", "main")

    previous = get_extension_runtime()
    set_extension_runtime(build_extension_runtime({"preset": "default"}))
    try:
        ref_doc = resolve_ref_document("repo@feature/roadmap.kg")
        assert ref_doc is not None and ref_doc.kind == "kg" and ref_doc.vpath.is_dir()
        context = type("Context", (), {
            "path": "repo@feature/roadmap.kg",
            "breadcrumbs": None,
            "document": type("Document", (), {"path": ref_doc.vpath})(),
            "layout": lambda self, body, **kwargs: (*kwargs.get("extra_head_nodes", ()), body),
            "htmx": False,
            "blog_title": "Site",
            "auth": None,
        })()
        with ref_read_scope(ref_doc.vpath):
            html = to_xml(render_kg_document(context))
    finally:
        set_extension_runtime(previous)

    assert "1 Nodes and 0 Edges" in html
    assert "0 Nodes and 0 Edges" not in html


def test_sidebar_uncommitted_dot_for_dirty_primary_clone_file(tmp_path, monkeypatch):
    import vyasa.core as core
    from fasthtml.common import A, to_xml

    from vyasa.config import reload_config

    # The uncommitted scan is scoped to the primary root, so the primary
    # must itself be a working clone with a dirty file.
    primary = tmp_path / "primary"
    primary.mkdir()
    _git(primary, "init", "-q", "-b", "main")
    _git(primary, "config", "user.email", "t@t")
    _git(primary, "config", "user.name", "t")
    (primary / "page.md").write_text("# Page\n")
    _git(primary, "add", "-A")
    _git(primary, "commit", "-qm", "c1")
    (primary / "page.md").write_text("# Page edited\n")  # dirty
    (primary / ".vyasa").write_text("")
    monkeypatch.chdir(primary)
    reload_config(primary / ".vyasa")
    core._uncommitted_slugs.cache_clear()
    try:
        slugs = core._uncommitted_slugs(core._posts_tree_fingerprint())
        assert "page" in slugs
        dirty = to_xml(core._uncommitted_row_decorator(A("Page", href="/posts/page"), slug="page"))
        clean = to_xml(core._uncommitted_row_decorator(A("X", href="/posts/x"), slug="x"))
        assert "vyasa-uncommitted-dot" in dirty
        assert "vyasa-uncommitted-dot" not in clean
    finally:
        reload_config()
        core._uncommitted_slugs.cache_clear()


def test_ref_markdown_shows_branch_badge_in_meta_line(site):
    from fasthtml.common import Span, to_xml

    from vyasa.document_pages import meta_line

    ref_badge = Span("feature", cls="vyasa-ref-badge")
    html = to_xml(meta_line("hello world", meta_extra=ref_badge))
    assert "vyasa-ref-badge" in html and ">feature<" in html and "-min read" in html
    # the clone's current branch is disk-served, so no ref doc there
    from vyasa.content_tree import resolve_ref_document
    assert resolve_ref_document("repo/a") is None


def test_navbar_ref_switcher_discovers_all_git_roots(site):
    import vyasa.core as core
    from fasthtml.common import to_xml

    work = site.parent / "repo"
    _git(work, "tag", "v1")
    core._git_roots_with_refs.cache_clear()

    # Always visible, even with no current page and on a non-git page.
    for path in (None, "nonexistent"):
        sw = core._navbar_ref_switcher(path)
        assert sw is not None
        html = to_xml(sw)
        assert "repo" in html  # the git root is listed
        assert ">main<" in html and ">feature<" in html and ">v1<" in html
        assert "/posts/repo?ref=feature" in html  # ref target carries the ref as a query param
        assert "/_vyasa/refresh-refs/root/repo" in html
        assert "fetch('/_vyasa/refresh-refs',{method:'GET'})" not in html
    core._git_roots_with_refs.cache_clear()


def test_ref_tree_uses_remote_icon_for_multi_remote_group():
    import vyasa.core as core
    from fasthtml.common import Ul, to_xml

    branches = [
        ("origin/team/dev", "branch", False, "origin"),
        ("backup/team/dev", "branch", False, "backup"),
    ]
    html = to_xml(Ul(*core._render_ref_nodes(
        core._build_ref_tree(branches),
        "repo", "", "", False, "vyasa-ref:repo", [], frozenset({"origin", "backup"}),
    )))
    assert "radio-tower" in html
    assert ">origin<" in html and ">origin/<" not in html
    assert ">team/<" in html


def test_active_branch_ref_row_exposes_file_tree_refresh_action():
    import vyasa.core as core
    from fasthtml.common import Ul, to_xml

    branches = [("feature/tree", "branch", False, "")]
    html = to_xml(Ul(*core._render_ref_nodes(
        core._build_ref_tree(branches),
        "repo", "feature/tree", "repo@feature:tree/guide", True, "vyasa-ref:repo", ["feature"], frozenset(),
    )))
    assert "Refresh file tree for feature/tree" in html
    assert "vyasaRefreshRefTree" in html
    assert "repo@feature:tree" in html


def test_inactive_branch_ref_rows_do_not_expose_file_tree_refresh_action():
    import vyasa.core as core
    from fasthtml.common import Ul, to_xml

    branches = [("feature/tree", "branch", False, "")]
    html = to_xml(Ul(*core._render_ref_nodes(
        core._build_ref_tree(branches),
        "repo", "", "", False, "vyasa-ref:repo", [], frozenset(),
    )))
    assert "Refresh file tree for feature/tree" not in html
    assert "vyasaRefreshRefTree" not in html


def test_tag_ref_rows_do_not_expose_file_tree_refresh_action():
    import vyasa.core as core
    from fasthtml.common import to_xml

    html = to_xml(core._render_tags_group(
        [("v1", "tag", False, "")],
        "repo", "", "", False, "vyasa-ref:repo",
    ))
    assert "Refresh file tree for v1" not in html
    assert "vyasaRefreshRefTree" not in html


def test_git_ref_debug_logs_are_present():
    core_source = Path("vyasa/core.py").read_text(encoding="utf-8")

    assert '@rt("/_vyasa/refresh-refs/root/{root:path}")' in core_source
    assert '@rt("/_vyasa/refresh-ref-tree/{path:path}")' in core_source
    assert 'logger.info("git-ref refresh requested root={} url={}"' in core_source
    assert 'logger.info("git-ref tree refresh root={} ref={}' in core_source
    assert "if target_root and alias != target_root:" in core_source
    assert 'logger.info("git-ref sidebar build root=' in core_source
    assert 'logger.info("git-ref posts tree requested current_path=' in core_source


def test_navbar_ref_switcher_hides_git_root_when_rbac_has_no_visible_path(site, monkeypatch):
    import re

    import vyasa.core as core
    from fasthtml.common import to_xml

    work = site.parent / "repo"
    (work / "public.md").write_text("# Public\n")
    rules = [
        (re.compile(r"^/posts/repo"), {"admin"}),
        (re.compile(r"^/posts/repo/public$"), {"reader"}),
    ]
    monkeypatch.setattr(core, "_rbac_rules", rules)
    core._git_roots_with_refs.cache_clear()
    try:
        assert core._navbar_ref_switcher(None, roles=[]) is None
        html = to_xml(core._navbar_ref_switcher(None, roles=["reader"]))
        assert "repo" in html and ">feature<" in html
    finally:
        core._git_roots_with_refs.cache_clear()


def test_top_level_child_git_repos_are_implicit_roots(tmp_path, monkeypatch):
    import vyasa.core as core
    from fasthtml.common import to_xml

    from vyasa.helpers import get_content_mounts, get_ref_content_mounts

    workspace = tmp_path / "workspace"
    repo = workspace / "repo"
    workspace.mkdir()
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.email", "t@t")
    _git(repo, "config", "user.name", "t")
    (repo / "a.md").write_text("# Main A\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", "c1")
    _git(repo, "checkout", "-q", "-b", "feature")
    (repo / "feat.md").write_text("# Feature\n\nonly feature\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", "c2")
    _git(repo, "checkout", "-q", "main")

    monkeypatch.chdir(workspace)
    reload_config()
    core._git_roots_with_refs.cache_clear()
    try:
        assert ("repo", repo.resolve()) not in get_content_mounts()
        assert ("repo", repo.resolve()) in get_ref_content_mounts()
        doc = resolve_ref_markdown("repo@feature/feat")
        assert doc is not None and doc.found and doc.title == "Feature"
        html = to_xml(core._navbar_ref_switcher(None))
        assert "repo" in html and ">feature<" in html
        assert "/posts/repo?ref=feature" in html
    finally:
        reload_config()
        core._git_roots_with_refs.cache_clear()


def test_branch_page_keeps_all_roots(tmp_path, monkeypatch):
    import vyasa.core as core
    from fasthtml.common import Ul, to_xml

    from vyasa.config import reload_config

    site = tmp_path / "site"
    repo = tmp_path / "repo"
    notes = tmp_path / "notes"
    for p in (site, repo, notes):
        p.mkdir()
    (site / "home.md").write_text("# Home\n")
    (notes / "note1.md").write_text("# Note One\n")
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.email", "t@t")
    _git(repo, "config", "user.name", "t")
    (repo / "a.md").write_text("# A\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", "c1")
    _git(repo, "checkout", "-q", "-b", "feature")
    (repo / "feat.md").write_text("# Feature Doc\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", "c2")
    _git(repo, "checkout", "-q", "main")
    (site / ".vyasa").write_text('vyasa_roots = ["../repo", "../notes"]\n')
    monkeypatch.chdir(site)
    reload_config(site / ".vyasa")
    core._nav_entries_cache.clear()
    try:
        html = to_xml(Ul(*core.get_posts(roles=[], current_path="repo@feature/feat")))
        # the other roots are still present...
        assert "/posts/home" in html
        assert "note1" in html or "Note One" in html
        # ...and the viewed root shows its branch content (ref-carrying link)
        assert "repo/feat?ref=feature" in html
    finally:
        reload_config()
        core._nav_entries_cache.clear()


def test_sidebar_tree_built_for_a_ref(site):
    import vyasa.core as core
    from fasthtml.common import Ul, to_xml

    items = core.build_ref_post_tree("repo", "feature", roles=[])
    assert items is not None
    html = to_xml(Ul(*items))
    assert "repo/feat?ref=feature" in html  # feature-only file, ref-carrying link
    assert "repo/a?ref=feature" in html
    # disk-served ref (current branch) -> None, caller uses disk tree
    assert core.build_ref_post_tree("repo", "main", roles=[]) is None
