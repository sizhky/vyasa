import sys
from types import SimpleNamespace

import pytest

from vyasa.config import get_config, reload_config, theme_preset_for_working_directory


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


def test_explicit_directory_ignores_working_directory_roots(tmp_path, monkeypatch):
    working = tmp_path / "working"
    configured = tmp_path / "configured"
    requested = tmp_path / "requested"
    working.mkdir()
    configured.mkdir()
    requested.mkdir()
    (working / ".vyasa").write_text(
        f'root = "{configured}"\nvyasa_roots = ["../configured"]\n'
        'ignore_cwd_as_root = true\nport = 1002\n',
        encoding="utf-8",
    )
    (requested / ".vyasa").write_text("port = 2003\n", encoding="utf-8")
    monkeypatch.chdir(working)
    monkeypatch.setenv("VYASA_ROOT", "")
    monkeypatch.setenv("VYASA_CLI_ROOT", "")
    observed = {}

    def run(*args, **kwargs):
        from vyasa.helpers import get_content_mounts

        config = get_config()
        observed["root"] = config.get_root_folder()
        observed["roots"] = config.get_vyasa_roots()
        observed["mounts"] = get_content_mounts()
        observed["port"] = config.get_port()
        worker_config = reload_config()
        observed["worker_root"] = worker_config.get_root_folder()
        observed["worker_roots"] = worker_config.get_vyasa_roots()
        observed["worker_mounts"] = get_content_mounts()
        observed["worker_port"] = worker_config.get_port()

    monkeypatch.setitem(sys.modules, "uvicorn", SimpleNamespace(run=run))
    monkeypatch.setattr(sys, "argv", ["vyasa", str(requested), "--no-browser"])

    from vyasa import main

    main.cli()

    assert observed == {
        "root": requested.resolve(),
        "roots": [],
        "mounts": [("", requested.resolve())],
        "port": 1002,
        "worker_root": requested.resolve(),
        "worker_roots": [],
        "worker_mounts": [("", requested.resolve())],
        "worker_port": 1002,
    }


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


def test_theme_debug_uses_launch_folder_theme(tmp_path, monkeypatch):
    from vyasa import main

    site = tmp_path / "site"
    site.mkdir()
    (site / ".vyasa").write_text('theme_preset = "dice"\n', encoding="utf-8")
    monkeypatch.setenv("VYASA_ROOT", str(site))
    monkeypatch.setenv("VYASA_THEME_DEBUG", "")
    monkeypatch.delenv("VYASA_THEME_PRESET", raising=False)
    monkeypatch.setitem(sys.modules, "uvicorn", SimpleNamespace(run=lambda *args, **kwargs: None))
    monkeypatch.setattr(sys, "argv", ["vyasa", str(site), "--theme-debug", "--no-browser"])

    try:
        main.cli()
        expected = theme_preset_for_working_directory(site)
        assert main.os.environ["VYASA_THEME_PRESET"] == expected
        config = reload_config()
        assert config.get_theme_preset() == expected
        assert config.get_theme_body_font()
    finally:
        monkeypatch.undo()
        reload_config()


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
