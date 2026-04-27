from vyasa import file_search


def test_file_search_fuzzy_matches_basename_first(tmp_path):
    root = tmp_path / "site"
    root.mkdir()
    (root / "notes").mkdir()
    target = root / "notes" / "search-palette.md"
    target.write_text("# Search\n", encoding="utf-8")
    other = root / "palette-notes.md"
    other.write_text("# Notes\n", encoding="utf-8")
    file_search._CACHE.clear()

    matches, error = file_search.search_file_records("sp", [("", root)], (".md",), limit=5)

    assert error == ""
    assert matches[0] == target
    assert other not in matches[:1]


def test_file_search_uses_cached_index_between_queries(monkeypatch, tmp_path):
    root = tmp_path / "site"
    root.mkdir()
    post = root / "alpha.md"
    post.write_text("# Alpha\n", encoding="utf-8")
    calls = {"count": 0}
    original = file_search.iter_visible_files
    file_search._CACHE.clear()

    def counted(*args, **kwargs):
        calls["count"] += 1
        yield from original(*args, **kwargs)

    monkeypatch.setattr(file_search, "iter_visible_files", counted)

    assert file_search.search_file_records("alpha", [("", root)], (".md",), limit=5)[0] == (post,)
    assert file_search.search_file_records("alp", [("", root)], (".md",), limit=5)[0] == (post,)
    assert calls["count"] == 1


def test_file_search_treats_path_separators_like_spaces(tmp_path):
    root = tmp_path / "site"
    target = root / "ai-enterprise-brain" / "docs" / "phase-2" / "skills"
    target.mkdir(parents=True)
    post = target / "plan.md"
    post.write_text("# Plan\n", encoding="utf-8")
    file_search._CACHE.clear()

    matches, _ = file_search.search_file_records("ai enter skills plan", [("", root)], (".md",), limit=5)

    assert matches == (post,)
