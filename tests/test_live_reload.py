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


def test_watcher_revision_keys_the_sidebar_tree_without_walking(monkeypatch, tmp_path):
    import threading
    import watchfiles

    hub = core._ReloadHub()
    stop = threading.Event()
    batches = [set(), {(2, str(tmp_path / "node_modules" / "a.js"))}, {(1, str(tmp_path / "docs" / "a.md"))}]
    seen = []

    def fake_watch(*_paths, stop_event, **_kwargs):
        for batch in batches:
            yield batch
            seen.append(hub.revision)
        stop_event.set()

    monkeypatch.setattr(watchfiles, "watch", fake_watch)
    monkeypatch.setattr(core, "_watch_targets", lambda: ([str(tmp_path)], True))
    hub._run(stop)

    assert seen == [1, 1, 2]
    assert hub.ready is True
    monkeypatch.setattr(core, "_reload_hub", hub)
    monkeypatch.setattr(core.ContentTree, "fingerprint", lambda self: (_ for _ in ()).throw(AssertionError("walked")))
    assert core._posts_tree_fingerprint() == ("watch", 2)
