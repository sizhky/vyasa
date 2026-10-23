from fasthtml.common import to_xml

from vyasa.extensions_builtin.filesystem_routes import _markdown_section_response
from vyasa.extensions_builtin.markdown.renderer import from_md


def test_heading_offers_copy_section_with_its_markdown_source():
    html = to_xml(from_md("# Top\n\n## Open Items\n\nx\n", current_path="guide/page.md"))

    assert 'data-heading-copy-section="open-items"' in html
    assert 'data-section-src="/posts/guide/page.md"' in html


def test_heading_without_a_document_has_no_copy_section():
    assert "data-heading-copy-section" not in to_xml(from_md("## Open Items\n"))


def test_section_query_returns_the_heading_and_its_children_only():
    text = "# Top\n\n## Open Items\n\nAlpha\n\n### Child\n\nBeta\n\n## Next\n\nGamma\n"

    assert _markdown_section_response(text, "open-items").body == b"## Open Items\n\nAlpha\n\n### Child\n\nBeta\n"
