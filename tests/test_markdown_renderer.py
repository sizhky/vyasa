from pathlib import Path
import html
import json
import re

from vyasa.extensions import refresh_extension_runtime
from fasthtml.common import to_xml

from vyasa.config import reload_config
from vyasa.extensions_builtin.markdown.renderer import MarkdownRenderer, RenderContext, from_md
from vyasa.helpers import expand_markdown_includes_for_reading


def test_markdown_renderer_matches_from_md_wrapper():
    markdown = "## Title\n\nSee [root](../README.md)."
    context = RenderContext(current_path="demo/page")

    assert to_xml(MarkdownRenderer().render(markdown, context)) == to_xml(from_md(markdown, current_path="demo/page"))


def test_single_newlines_follow_soft_break_behavior():
    html = to_xml(from_md("a\nb\nc\nd"))

    assert "<br" not in html
    assert "<p" in html


def test_disabled_render_extensions_fall_back_to_plain_code():
    refresh_extension_runtime({})
    try:
        refresh_extension_runtime({"preset": "minimal"})

        html = to_xml(from_md("```mermaid\nflowchart TD\n```"))
        assert 'class="mermaid-container' not in html
        assert 'language-mermaid' in html

        html = to_xml(from_md("```tasks\nFoundation:\n```"))
        assert 'class="tasks-container' not in html
        assert 'language-tasks' in html
    finally:
        refresh_extension_runtime({})


def test_items_vw_width_does_not_add_implicit_outer_min_height():
    refresh_extension_runtime({})

    html = to_xml(from_md("```items\n---\ntitle: Wide\nwidth: 92vw\n---\nGroup:\n  - a :: A\n```"))

    assert 'class="tasks-container' in html
    assert "width: 92vw;" in html
    assert "min-height: 85vh" not in html
    assert "height:70vh;min-height:420px" in html


def test_items_palette_source_loads_relative_json(tmp_path):
    refresh_extension_runtime({})
    (tmp_path / "shared-palettes.json").write_text(
        json.dumps({
            "node_color_palettes": {"status": {"Todo": "#fa7115", "Done": "#2cd013"}},
            "edge_color_palettes": {"relation": {"depends_on": "#2563eb"}},
        }),
        encoding="utf-8",
    )
    html = to_xml(from_md(
        """```items
---
title: Shared Palette
color_palette_source: shared-palettes.json
---
Roadmap:
  - one :: First | status: Todo
root -> one | relation: depends_on
```""",
        current_path=str(tmp_path / "graph.md"),
    ))

    assert 'class="tasks-container' in html
    assert "#fa7115" in html
    assert "#2563eb" in html


def test_items_direction_alias_sets_layout_direction():
    refresh_extension_runtime({})

    html = to_xml(from_md("```items\n---\ntitle: LR\ndirection: lr\n---\nGroup:\n  - a :: A\n```"))

    assert 'data-tasks-layout-direction="lr"' in html


def test_rendered_heading_emits_doc_heading_class():
    html = to_xml(from_md("## Cave\n\ntext"))

    assert 'class="vyasa-doc-heading' in html


def test_relative_markdown_link_preserves_fragment():
    html = to_xml(from_md("[Goal](docs/glossary#goal)", current_path="README"))

    assert 'href="/posts/docs/glossary#goal"' in html
    assert 'href="/posts/docs/glossary%23goal"' not in html


def test_markdown_include_renders_native_markdown_lines(tmp_path, monkeypatch):
    root = tmp_path / "site"
    root.mkdir()
    (root / "doc.md").write_text("# Title\n\n- one\n- two\n", encoding="utf-8")
    monkeypatch.setenv("VYASA_ROOT", str(root))
    reload_config()

    try:
        html = to_xml(from_md("{ ./doc.md ln[1:4] }", current_path="page"))
        assert "<li" in html
        assert "language-markdown" not in html
    finally:
        reload_config()


def test_markdown_include_renders_named_section(tmp_path, monkeypatch):
    root = tmp_path / "site"
    root.mkdir()
    (root / "doc.md").write_text("# Top\n\n## Keep Me\n\nhello\n\n## Skip Me\n\nbye\n", encoding="utf-8")
    monkeypatch.setenv("VYASA_ROOT", str(root))
    reload_config()

    try:
        html = to_xml(from_md("{ ./doc.md#keep-me }", current_path="page"))
        assert "Keep Me" in html
        assert "hello" in html
        assert "Skip Me" not in html
    finally:
        reload_config()


def test_markdown_include_section_renders_mermaid_and_bubbles_assets(tmp_path, monkeypatch):
    root = tmp_path / "site"
    root.mkdir()
    (root / "doc.md").write_text(
        "# Top\n\n## Diagram\n\n```mermaid\nflowchart TD\n  A --> B\n```\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("VYASA_ROOT", str(root))
    reload_config()

    try:
        html = to_xml(from_md("{ ./doc.md#diagram }", current_path="page"))
        assert 'class="mermaid-container' in html
        assert "/static/extensions/mermaid/mermaid.js" in html
        assert "--&amp;gt;" not in html
    finally:
        reload_config()


def test_items_edges_keep_their_color_key_as_visible_label():
    from vyasa.extensions_builtin.tasks.model import parse_tasks_text

    model = parse_tasks_text(
        """```items
---
title: ServiceLoop
edge_color_palette: relation
  depends_on: "#2563eb"
---
Goal:
  - goal-01 :: One request lifecycle | kind: goal
OpenQuestion:
  - oq-01 :: Intake schema | kind: question
goal-01 -> oq-01 | relation: depends_on
```"""
    )

    assert model["dependency_edges"][0]["label"] == "depends_on"


def test_items_render_uses_edge_color_key_as_visible_label():
    refresh_extension_runtime({})

    rendered = to_xml(
        from_md(
            """```items
---
title: ServiceLoop
edge_color_palette: relation
  depends_on: "#2563eb"
---
Goal:
  - goal-01 :: One request lifecycle | kind: goal
OpenQuestion:
  - oq-01 :: Intake schema | kind: question
goal-01 -> oq-01 | relation: depends_on
```"""
        )
    )
    match = re.search(r"""data-tasks-payload=(["'])(.*?)\1""", rendered)

    assert match is not None
    payload = json.loads(html.unescape(match.group(2)))
    assert payload["dependency_edges"][0]["label"] == "depends_on"


def test_items_render_payload_contains_lens_models():
    refresh_extension_runtime({})

    rendered = to_xml(
        from_md(
            """```items
---
title: Travel
default_lens: city
view_lenses:
  - id: city
    label: City View
    groups_from: city
---
Places:
  - tsukiji :: Tsukiji | city: Tokyo
  - fushimi :: Fushimi | city: Kyoto
```"""
        )
    )
    match = re.search(r"""data-tasks-payload=(["'])(.*?)\1""", rendered)

    assert match is not None
    payload = json.loads(html.unescape(match.group(2)))
    assert payload["default_lens"] == "city"
    assert payload["view_lenses"][0]["label"] == "City View"
    assert payload["lens_models"]["city"]["model"]["groups"][0]["label"] == "Kyoto"


def test_markdown_fragment_include_does_not_leak_root_wrapper(tmp_path, monkeypatch):
    root = tmp_path / "site"
    root.mkdir()
    (root / "doc.md").write_text("## Part\n\npara\n", encoding="utf-8")
    monkeypatch.setenv("VYASA_ROOT", str(root))
    reload_config()

    try:
        html = to_xml(from_md("> [!note] Title\n> body\n\n{ ./doc.md#part }", current_path="page"))
        assert html.count('<div class="w-full">') == 1
    finally:
        reload_config()


def test_expand_markdown_includes_for_reading_counts_md_sections(tmp_path, monkeypatch):
    root = tmp_path / "site"
    root.mkdir()
    (root / "doc.md").write_text("# Top\n\n## Part\n\nalpha beta gamma\n", encoding="utf-8")
    monkeypatch.setenv("VYASA_ROOT", str(root))
    reload_config()

    try:
        expanded = expand_markdown_includes_for_reading("{ ./doc.md#part }", current_path="page", root_folder=root)
        assert "alpha beta gamma" in expanded
        assert "{ ./doc.md#part }" not in expanded
    finally:
        reload_config()
