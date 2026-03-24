from pathlib import Path
from unittest.mock import patch

from fasthtml.common import to_xml

from vyasa.markdown_rendering import from_md
from vyasa.sidebar_helpers import extract_toc
from vyasa.helpers import _strip_inline_markdown, _unique_anchor, resolve_heading_anchor, text_to_anchor


def test_slash_callout_renders_info_block():
    html = to_xml(
        from_md(
            "Before\n\n/// info\n\nAdded in FastAPI 0.134.0.\n\n///\n\nAfter"
        )
    )

    assert 'vyasa-callout' in html
    assert 'vyasa-callout-info' in html
    assert 'Added in FastAPI 0.134.0.' in html
    assert 'Before' in html
    assert 'After' in html


def test_code_include_renders_selected_lines_and_highlight_metadata(tmp_path):
    docs_src = tmp_path / "docs_src" / "stream_json_lines"
    docs_src.mkdir(parents=True)
    sample = docs_src / "tutorial001_py310.py"
    sample.write_text("\n".join(f"line {n}" for n in range(1, 31)), encoding="utf-8")
    md = "{* ../../docs_src/stream_json_lines/tutorial001_py310.py ln[1:24] hl[9:11,22] *}"

    with patch("vyasa.markdown_rendering.get_root_folder", return_value=tmp_path / "content"):
        html = to_xml(from_md(md, current_path="guide/chapter.md"))

    assert 'language-python' in html
    assert 'line 1' in html and 'line 24' in html
    assert 'line 25' not in html
    assert 'data-code-source-start="1"' in html
    assert 'data-code-highlight-lines="9-11,22"' in html


def test_heading_permalink_and_explicit_id_are_used_in_html_and_toc():
    md = "### My Title { #server-sent-events-sse }"
    html = to_xml(from_md(md))
    toc = extract_toc(md, _strip_inline_markdown, text_to_anchor, _unique_anchor)

    assert 'id="server-sent-events-sse"' in html
    assert '>My Title<' in html
    assert 'href="#server-sent-events-sse"' in html
    assert '¶</a>' in html
    assert toc == [(3, 'My Title', 'server-sent-events-sse')]


def test_code_include_stays_literal_inside_fenced_code():
    md = "````markdown\n{* ../demo/dollar-escape.md ln[1:24] hl[9:11,22] *}\n````"
    html = to_xml(from_md(md))

    assert '{* ../demo/dollar-escape.md ln[1:24] hl[9:11,22] *}' in html
    assert 'vyasa-code-include-placeholder' not in html
