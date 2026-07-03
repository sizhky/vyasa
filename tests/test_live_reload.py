from pathlib import Path

from vyasa import core


def test_source_reload_paths_are_hard_reload_only_when_enabled(monkeypatch):
    source_file = Path(core.__file__).resolve()

    monkeypatch.delenv("VYASA_RELOAD", raising=False)
    assert core._is_live_reload_path(source_file) is False

    monkeypatch.setenv("VYASA_RELOAD", "true")
    assert core._is_live_reload_path(source_file) is True
    assert core._reload_event_str([(1, str(source_file))]).startswith("event: reload")


def test_source_reload_roots_include_vyasa_package_when_enabled(monkeypatch):
    source_root = Path(core.__file__).resolve().parent

    monkeypatch.setenv("VYASA_RELOAD", "true")

    assert any(source_root == root or source_root.is_relative_to(root) for root in core._live_reload_roots())
