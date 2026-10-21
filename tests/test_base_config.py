from pathlib import Path

import pytest

from vyasa.config import reload_config


@pytest.fixture(autouse=True)
def restore_global_config():
    yield
    reload_config()


def _sites(tmp_path, monkeypatch, root_vyasa=""):
    profile = tmp_path / "profile"
    profile.mkdir()
    (profile / "look.css").write_text("body { color: red; }\n", encoding="utf-8")
    (profile / "vyasa.toml").write_text(
        'theme_primary = "#007aff"\n'
        'blog_title = "From base"\n'
        'document_edit = false\n'
        'stylesheets = ["look.css"]\n'
        'unlisted_roots = ["../project"]\n',
        encoding="utf-8",
    )
    (tmp_path / "project").mkdir()
    root = tmp_path / "docs"
    root.mkdir()
    if root_vyasa:
        (root / ".vyasa").write_text(root_vyasa, encoding="utf-8")
    monkeypatch.chdir(root)
    monkeypatch.setenv("VYASA_ROOT", str(root))
    monkeypatch.setenv("VYASA_CLI_ROOT", str(root))
    monkeypatch.setenv("VYASA_BASE_CONFIG", str(profile / "vyasa.toml"))
    return profile, root


def test_the_base_layer_ranks_below_the_root_file_and_the_environment(tmp_path, monkeypatch):
    _sites(tmp_path, monkeypatch, root_vyasa='blog_title = "From root"\n')
    monkeypatch.setenv("VYASA_DOCUMENT_EDIT", "true")
    cfg = reload_config()

    assert cfg.get("blog_title", "VYASA_BLOG_TITLE") == "From root"
    # `--edit` sets the environment; the base file's `false` must not undo it.
    assert cfg.get("document_edit", "VYASA_DOCUMENT_EDIT") == "true"
    assert cfg.get("theme_primary", "VYASA_THEME_PRIMARY") == "#007aff"


def test_base_paths_resolve_against_the_base_file(tmp_path, monkeypatch):
    profile, _root = _sites(tmp_path, monkeypatch)
    monkeypatch.setenv("VYASA_UNLISTED_ROOTS", str(tmp_path / "docs"))
    cfg = reload_config()

    assert cfg.get_stylesheets() == [(profile / "look.css").resolve()]
    # The flag's root adds to the configured one; neither hides the other.
    assert cfg.get_unlisted_roots() == [(tmp_path / "project").resolve(), (tmp_path / "docs").resolve()]


def test_a_configured_stylesheet_is_served_by_index_only(tmp_path, monkeypatch):
    _sites(tmp_path, monkeypatch)
    reload_config()
    from vyasa.core import configured_stylesheet

    assert "color: red" in configured_stylesheet(0).body.decode()
    assert configured_stylesheet(1).status_code == 404


def test_a_local_theme_file_loads_its_tokens(tmp_path):
    from vyasa.config import load_theme_preset

    themes = tmp_path / ".vyasa-themes"
    themes.mkdir()
    (themes / "mine.toml").write_text('theme_primary = "#123456"\ntheme_paper = "#ffffff"\n', encoding="utf-8")

    assert load_theme_preset("mine", tmp_path).get("theme_paper") == "#ffffff"
