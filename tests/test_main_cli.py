import sys
from types import SimpleNamespace

import pytest

from vyasa.config import reload_config


def test_reload_source_flag_configures_uvicorn_reloader(tmp_path, monkeypatch):
    site = tmp_path / "site"
    site.mkdir()
    calls = {}

    def run(*args, **kwargs):
        calls["args"] = args
        calls["kwargs"] = kwargs

    monkeypatch.setitem(sys.modules, "uvicorn", SimpleNamespace(run=run))
    monkeypatch.setattr(sys, "argv", ["vyasa", str(site), "--no-browser", "--reload-source"])

    from vyasa import main

    try:
        main.cli()
        kwargs = calls["kwargs"]
        assert kwargs["reload"] is True
        assert str(main.Path(main.__file__).resolve().parent) in kwargs["reload_dirs"]
        assert "*.py" in kwargs["reload_includes"]
        assert "*.js" in kwargs["reload_includes"]
        assert "*.css" in kwargs["reload_includes"]
    finally:
        reload_config()


def test_reload_source_env_configures_uvicorn_reloader(tmp_path, monkeypatch):
    site = tmp_path / "site"
    site.mkdir()
    calls = {}

    monkeypatch.setenv("VYASA_RELOAD_SOURCE", "true")
    monkeypatch.setitem(
        sys.modules, "uvicorn",
        SimpleNamespace(run=lambda *args, **kwargs: calls.update(kwargs)),
    )
    monkeypatch.setattr(sys, "argv", ["vyasa", str(site), "--no-browser"])

    from vyasa import main

    try:
        main.cli()
        assert calls["reload"] is True
        assert str(main.Path(main.__file__).resolve().parent) in calls["reload_dirs"]
    finally:
        reload_config()


def test_feedback_subcommand_dispatches_once(monkeypatch):
    from vyasa import main
    from vyasa.extensions_builtin.feedback import cli as feedback_cli

    calls = []
    monkeypatch.setattr(feedback_cli, "feedback_command", lambda argv: calls.append(argv) or 7)
    monkeypatch.setattr(sys, "argv", ["vyasa", "feedback", "poll", "plan"])

    with pytest.raises(SystemExit) as stopped:
        main.cli()

    assert stopped.value.code == 7
    assert calls == [["poll", "plan"]]


def test_feedback_flag_enables_extension(tmp_path, monkeypatch):
    from vyasa import main

    site = tmp_path / "site"
    site.mkdir()
    calls = []
    monkeypatch.setitem(sys.modules, "uvicorn", SimpleNamespace(run=lambda *args, **kwargs: None))
    monkeypatch.setattr(main, "refresh_extension_runtime", lambda config: calls.append(config))
    monkeypatch.setattr(sys, "argv", ["vyasa", str(site), "--feedback", "--no-browser"])

    main.cli()

    assert "feedback" in calls[-1]["routes_add"]
