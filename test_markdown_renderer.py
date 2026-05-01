from fasthtml.common import to_xml

from vyasa.markdown_rendering import MarkdownRenderer, RenderContext, from_md


def test_markdown_renderer_matches_from_md_wrapper():
    markdown = "## Title\n\nSee [root](../README.md)."
    context = RenderContext(current_path="demo/page")

    assert to_xml(MarkdownRenderer().render(markdown, context)) == to_xml(from_md(markdown, current_path="demo/page"))
