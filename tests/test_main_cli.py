import sys
from types import SimpleNamespace

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
