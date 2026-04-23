from pathlib import Path
from types import SimpleNamespace

from fasthtml.common import to_xml

from vyasa import core
from vyasa.search_views import posts_search_block, search_preview_href


def test_posts_search_block_includes_preview_button():
    html = to_xml(posts_search_block("<div />"))

    assert "posts-search-preview-button" in html
    assert "data-search-preview-base=\"/search/preview\"" in html
    assert "→" in html


def test_search_preview_href_encodes_regex_terms_as_path():
    assert search_preview_href("/use-case$|use-case\\//") == "/search/preview/%2Fuse-case%24%7Cuse-case%5C%2F%2F"


def test_search_preview_page_renders_blog_style_cards(monkeypatch, tmp_path):
    root = tmp_path / "site"
    root.mkdir()
    post = root / "hello.md"
    post.write_text("# Hello\n\nThis is the preview body.\n", encoding="utf-8")
    pdf = root / "brochure.pdf"
    pdf.write_text("fake pdf", encoding="utf-8")

    monkeypatch.setattr(core, "get_content_mounts", lambda: [("", root)])
    monkeypatch.setattr(core, "get_root_folder", lambda: root)
    monkeypatch.setattr(core, "get_blog_title", lambda: "Demo")
    monkeypatch.setattr(core, "content_slug_for_path", lambda path, strip_suffix=True: "hello" if path == post else None)
    monkeypatch.setattr(core, "_find_search_matches", lambda query, limit=200: ([post, pdf], ""))
    monkeypatch.setattr(core, "get_roles_from_auth", lambda *args, **kwargs: None)
    monkeypatch.setattr(core, "layout", lambda *content, **kwargs: content)

    rendered = core.render_search_preview_page(None, SimpleNamespace(scope={}), q="hello")
    html = to_xml(rendered)

    assert "Search previews: hello" in html
    assert "This is the preview body." in html
    assert "brochure.pdf" not in html


def test_search_preview_page_uses_markdown_only_matches(monkeypatch, tmp_path):
    root = tmp_path / "site"
    root.mkdir()
    post = root / "hello.md"
    post.write_text("# Hello\n\nThis is the preview body.\n", encoding="utf-8")
    pdf = root / "brochure.pdf"
    pdf.write_text("fake pdf", encoding="utf-8")

    monkeypatch.setattr(core, "get_content_mounts", lambda: [("", root)])
    monkeypatch.setattr(core, "get_root_folder", lambda: root)
    monkeypatch.setattr(core, "get_blog_title", lambda: "Demo")
    monkeypatch.setattr(core, "content_slug_for_path", lambda path, strip_suffix=True: "hello" if path == post else "brochure" if path == pdf else None)
    monkeypatch.setattr(core, "_find_search_matches", lambda query, limit=200: ([pdf], ""))
    monkeypatch.setattr(core, "_find_search_preview_matches", lambda query, limit=200: ([post], ""))
    monkeypatch.setattr(core, "get_roles_from_auth", lambda *args, **kwargs: None)
    monkeypatch.setattr(core, "layout", lambda *content, **kwargs: content)

    rendered = core.render_search_preview_page(None, SimpleNamespace(scope={}), q="hello")
    html = to_xml(rendered)

    assert "This is the preview body." in html
    assert "No previewable pages matched this search." not in html


def test_search_preview_path_route_decodes_encoded_query(monkeypatch):
    seen = {}

    def fake_render(htmx, request, q=""):
        seen["q"] = q
        return q

    monkeypatch.setattr(core, "render_search_preview_page", fake_render)

    result = core.search_preview_results_path("%2Fuse-case%24%7Cuse-case%5C%2F%2F", None, None)

    assert result == "/use-case$|use-case\\//"
    assert seen["q"] == "/use-case$|use-case\\//"
