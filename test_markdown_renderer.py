from vyasa.extensions import refresh_extension_runtime
from fasthtml.common import to_xml

from vyasa.extensions_builtin.markdown.renderer import MarkdownRenderer, RenderContext, from_md


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
