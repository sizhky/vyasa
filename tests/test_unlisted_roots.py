from pathlib import Path

import pytest

from vyasa.config import reload_config
from vyasa.helpers import addressable_content_roots, content_path_for_slug


@pytest.fixture(autouse=True)
def restore_global_config():
    yield
    reload_config()


def _project(tmp_path, monkeypatch, *, cli_root=False):
    project = tmp_path / "rules-engine"
    docs = project / ".sutragana" / "docs"
    (docs / "canvas").mkdir(parents=True)
    (docs / "canvas" / "index.md").write_text("# Doc\n", encoding="utf-8")
    (project / "poc" / "graphs").mkdir(parents=True)
    (project / "poc" / "graphs" / "claim.json").write_text('{"a": 1}\n', encoding="utf-8")
    (tmp_path / "outside.json").write_text("{}\n", encoding="utf-8")
    monkeypatch.chdir(docs)
    monkeypatch.setenv("VYASA_ROOT", str(docs))
    if cli_root:
        monkeypatch.setenv("VYASA_CLI_ROOT", str(docs))
    monkeypatch.setenv("VYASA_UNLISTED_ROOTS", str(project))
    reload_config()
    return project, docs


def test_an_unlisted_root_is_addressable_by_its_folder_name(tmp_path, monkeypatch):
    project, _docs = _project(tmp_path, monkeypatch, cli_root=True)

    assert ("rules-engine", project.resolve()) in addressable_content_roots()
    assert content_path_for_slug("rules-engine/poc/graphs/claim.json") == (project / "poc/graphs/claim.json").resolve()


def test_an_unlisted_root_never_shadows_a_name_the_primary_root_uses(tmp_path, monkeypatch):
    _project_dir, docs = _project(tmp_path, monkeypatch)
    (docs / "rules-engine").mkdir()
    reload_config()

    assert all(alias != "rules-engine" for alias, _ in addressable_content_roots() if alias)


def test_an_absolute_file_link_becomes_its_content_url_only_inside_a_root(tmp_path, monkeypatch):
    from vyasa.extensions_builtin.markdown.renderer import _content_href_for_file_path

    project, _docs = _project(tmp_path, monkeypatch, cli_root=True)
    inside = project / "poc" / "graphs" / "claim.json"

    assert _content_href_for_file_path(f"{inside}:3") == "/posts/rules-engine/poc/graphs/claim.json:3"
    assert _content_href_for_file_path(str(tmp_path / "outside.json")) is None
    assert _content_href_for_file_path("/posts/canvas/index") is None
