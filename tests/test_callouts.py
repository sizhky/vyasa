from unittest.mock import patch

from fasthtml.common import to_xml

from vyasa.markdown_rendering import from_md
from vyasa.sidebar_helpers import extract_toc
from vyasa.helpers import _strip_inline_markdown, _unique_anchor, text_to_anchor


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
    assert 'class="vyasa-heading-permalink' in html
    assert 'icon="link"' in html
    assert toc == [(3, 'My Title', 'server-sent-events-sse')]


def test_code_include_stays_literal_inside_fenced_code():
    md = "````markdown\n{* ../demo/dollar-escape.md ln[1:24] hl[9:11,22] *}\n````"
    html = to_xml(from_md(md))

    assert '{* ../demo/dollar-escape.md ln[1:24] hl[9:11,22] *}' in html
    assert 'vyasa-code-include-placeholder' not in html


def test_markdown_after_callout_still_renders():
    md = '/// note\nBody\n///\n\n**Key columns:** Example'
    html = to_xml(from_md(md))

    assert '<strong>Key columns:</strong>' in html


def test_double_equals_renders_mark_highlight():
    html = to_xml(from_md("This is ==important== text."))

    assert '<mark class="vyasa-mark">important</mark>' in html


def test_obsidian_callout_alias_and_fold_render():
    md = '> [!warn]- Custom title\n> body'
    html = to_xml(from_md(md))

    assert 'vyasa-callout-warning' in html
    assert '<details' in html
    assert 'Custom title' in html
    assert '>body<' in html


def test_nested_obsidian_callouts_render():
    md = '> [!question] Outer\n> > [!todo] Inner\n> > **done**'
    html = to_xml(from_md(md))

    assert 'vyasa-callout-question' in html
    assert 'vyasa-callout-todo' in html
    assert '<strong>done</strong>' in html


def test_custom_callout_type_keeps_data_attribute():
    html = to_xml(from_md('> [!business-case] Title\n> body'))

    assert 'data-callout="business-case"' in html
    assert 'vyasa-callout-note' in html


def test_sibling_obsidian_callouts_do_not_merge():
    md = '> [!info] Added in FastAPI 0.134.0.\n\n> [!warning] Rotate your keys every 90 days.'
    html = to_xml(from_md(md))

    assert html.count('vyasa-callout ') >= 2
    assert '[!warning]' not in html


def test_fenced_code_inside_obsidian_callout_renders():
    md = '> [!info] Header\n> Body\n> ```python\n> print("hi")\n> ```'
    html = to_xml(from_md(md))

    assert '@@VYASA_CALLOUT_BLOCK_' not in html
    assert 'print("hi")' in html
    assert '&gt; ```' not in html


def test_raw_html_external_img_src_is_not_rewritten():
    html = to_xml(from_md('<img src="https://cataas.com/cat?width=320&height=180">', current_path="demo/headings"))

    assert 'src="https://cataas.com/cat?width=320&amp;height=180"' in html
    assert '/posts/demo/https:' not in html


def test_raw_html_relative_img_src_is_resolved_from_current_path():
    html = to_xml(from_md('<img src="./yeshwanth-stamp.png">', current_path="demo/quick-styling-inline-css"))

    assert 'src="/posts/demo/yeshwanth-stamp.png"' in html


def test_raw_html_relative_markdown_href_is_resolved_to_posts_route():
    html = to_xml(from_md('<a href="../README.md">Root</a>', current_path="demo/headings"))

    assert 'href="/posts/README"' in html


def test_raw_html_root_static_src_is_left_alone():
    html = to_xml(from_md('<img src="/static/icon.png">', current_path="demo/headings"))

    assert 'src="/static/icon.png"' in html


def test_raw_html_srcset_rewrites_only_relative_candidates():
    html = to_xml(from_md('<img srcset="./a.png 1x, https://x.test/b.png 2x">', current_path="demo/headings"))

    assert 'srcset="/posts/demo/a.png 1x, https://x.test/b.png 2x"' in html
