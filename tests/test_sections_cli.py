import sys

import pytest

from vyasa.sections import (
    extract_markdown_section,
    find_markdown_sections,
    list_markdown_sections,
    sections_command,
)


DOCUMENT = """---
title: Example
---
# Document
intro

## First
first body

### Child
child body

#### Grandchild
grandchild body

```md
## Hidden
```

## Next
next body
"""

EMPTY_DOCUMENT = """## Parent
### Child
child body

## Empty
"""


def test_lists_only_real_heading_lines():
    assert list_markdown_sections(DOCUMENT) == [
        "# Document",
        "## First",
        "### Child",
        "#### Grandchild",
        "## Next",
    ]


def test_marks_headings_with_an_empty_direct_body():
    assert list_markdown_sections(EMPTY_DOCUMENT) == [
        "## Parent *",
        "### Child",
        "## Empty *",
    ]


def test_extracts_only_direct_section_content_by_default():
    assert extract_markdown_section(DOCUMENT, "## First") == "first body"
    assert extract_markdown_section(DOCUMENT, "### Child") == "child body"


def test_extracts_nested_sections_when_requested():
    assert extract_markdown_section(DOCUMENT, "## First", include_children=True) == (
        "first body\n\n### Child\nchild body\n\n#### Grandchild\ngrandchild body\n\n"
        "```md\n## Hidden\n```"
    )


def test_selector_requires_exact_heading_markup():
    assert extract_markdown_section(DOCUMENT, "First") is None
    assert extract_markdown_section(DOCUMENT, "##First") is None


def test_finds_headings_by_case_insensitive_phrase():
    assert find_markdown_sections(DOCUMENT, "child") == [
        "### Child",
        "#### Grandchild",
    ]


def test_exact_heading_wins_over_a_longer_substring_match():
    text = DOCUMENT + "\n### Child Care\ncare body\n"
    assert find_markdown_sections(text, "### child") == ["### Child"]


def test_command_reads_document_outside_a_site(tmp_path, capsys):
    document = tmp_path / "anywhere.md"
    document.write_text(DOCUMENT, encoding="utf-8")

    assert sections_command([str(document)]) == 0
    assert capsys.readouterr().out.splitlines() == [
        "# Document",
        "## First",
        "### Child",
        "#### Grandchild",
        "## Next",
    ]

    assert sections_command([str(document), "### Child", "--include-children"]) == 0
    assert "#### Grandchild" in capsys.readouterr().out


def test_command_reports_missing_heading(tmp_path, capsys):
    document = tmp_path / "document.md"
    document.write_text(DOCUMENT, encoding="utf-8")

    assert sections_command([str(document), "Missing"]) == 1
    output = capsys.readouterr().out
    assert "error: section_not_found" in output
    assert "matches[0]:" in output


def test_command_returns_marked_heading_for_an_empty_body(tmp_path, capsys):
    document = tmp_path / "document.md"
    document.write_text(EMPTY_DOCUMENT, encoding="utf-8")

    assert sections_command([str(document), "Parent"]) == 0
    assert capsys.readouterr().out == "## Parent *\n"

    assert sections_command([str(document), "Parent", "--include-children"]) == 0
    assert capsys.readouterr().out == "### Child\nchild body\n"


def test_non_tty_ambiguous_match_returns_toon_options(tmp_path, capsys):
    document = tmp_path / "document.md"
    document.write_text(DOCUMENT, encoding="utf-8")

    assert sections_command([str(document), "child", "--include-children"]) == 2
    output = capsys.readouterr().out
    assert "error: ambiguous_section" in output
    assert "matches[2]{number,heading}:" in output
    assert "1,### Child\n2,#### Grandchild" in output
    assert "'<exact-heading>' --include-children" in output


def test_tty_ambiguous_match_uses_numbered_menu(tmp_path, capsys, monkeypatch):
    document = tmp_path / "document.md"
    document.write_text(DOCUMENT, encoding="utf-8")

    class Input:
        def isatty(self):
            return True

        def readline(self):
            return "2\n"

    monkeypatch.setattr(sys, "stdin", Input())
    assert sections_command([str(document), "child"]) == 0
    captured = capsys.readouterr()
    assert captured.out == "grandchild body\n\n```md\n## Hidden\n```\n"
    assert "1. ### Child" in captured.err
    assert "2. #### Grandchild" in captured.err


def test_main_dispatches_sections_command(monkeypatch):
    from vyasa import main, sections

    calls = []
    monkeypatch.setattr(
        sections, "sections_command", lambda argv: calls.append(argv) or 6
    )
    monkeypatch.setattr(sys, "argv", ["vyasa", "sections", "/tmp/doc.md"])

    with pytest.raises(SystemExit) as stopped:
        main.cli()

    assert stopped.value.code == 6
    assert calls == [["/tmp/doc.md"]]
