import argparse
import csv
import re
import shlex
import sys
from dataclasses import dataclass
from io import StringIO
from pathlib import Path

from .helpers import _strip_leading_frontmatter_block, resolve_heading_anchor


@dataclass(frozen=True)
class _Heading:
    level: int
    markup: str
    text: str
    anchor: str
    start: int
    content_start: int


def _headings(text: str) -> tuple[str, list[_Heading]]:
    body = _strip_leading_frontmatter_block(text)
    headings: list[_Heading] = []
    counts: dict[str, int] = {}
    fence: tuple[str, int] | None = None
    offset = 0
    for line in body.splitlines(keepends=True):
        bare = line.rstrip("\r\n")
        if fence:
            char, width = fence
            if re.fullmatch(rf" {{0,3}}{re.escape(char)}{{{width},}}[ \t]*", bare):
                fence = None
        else:
            fence_match = re.match(r"^ {0,3}(`{3,}|~{3,})", bare)
            if fence_match:
                marker = fence_match.group(1)
                fence = marker[0], len(marker)
            else:
                match = re.match(r"^(#{1,6})[ \t]+(.+?)[ \t]*$", bare)
                if match:
                    hashes, raw_text = match.groups()
                    heading_text, anchor = resolve_heading_anchor(
                        raw_text.strip(), counts
                    )
                    headings.append(
                        _Heading(
                            len(hashes),
                            f"{hashes} {raw_text.strip()}",
                            heading_text,
                            anchor,
                            offset,
                            offset + len(line),
                        )
                    )
        offset += len(line)
    return body, headings


def list_markdown_sections(text: str) -> list[str]:
    body, headings = _headings(text)
    return [
        heading.markup + (" *" if not _section_content(body, headings, index) else "")
        for index, heading in enumerate(headings)
    ]


def find_markdown_sections(text: str, query: str) -> list[str]:
    needle = query.strip().casefold()
    headings = [heading.markup for heading in _headings(text)[1]]
    exact = [heading for heading in headings if heading.casefold() == needle]
    return exact or [heading for heading in headings if needle in heading.casefold()]


def markdown_headings(text: str) -> list[tuple[int, str, str]]:
    return [
        (heading.level, heading.text, heading.anchor) for heading in _headings(text)[1]
    ]


def _section_content(
    body: str,
    headings: list[_Heading],
    index: int,
    *,
    include_children: bool = False,
) -> str:
    heading = headings[index]
    end = len(body)
    for later in headings[index + 1 :]:
        if not include_children or later.level <= heading.level:
            end = later.start
            break
    return body[heading.content_start : end].strip()


def extract_markdown_section(
    text: str, selector: str, *, include_children: bool = False
) -> str | None:
    body, headings = _headings(text)
    for index, heading in enumerate(headings):
        if heading.markup != selector.strip():
            continue
        return _section_content(
            body, headings, index, include_children=include_children
        )
    return None


def extract_markdown_section_by_anchor(text: str, target_anchor: str) -> str | None:
    body, headings = _headings(text)
    for index, heading in enumerate(headings):
        if heading.anchor.casefold() != target_anchor.casefold():
            continue
        end = next(
            (
                later.start
                for later in headings[index + 1 :]
                if later.level <= heading.level
            ),
            len(body),
        )
        return body[heading.start : end].strip()
    return None


def _toon_rows(matches: list[str]) -> str:
    output = StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerows(enumerate(matches, 1))
    return output.getvalue().rstrip()


def _print_match_error(args: argparse.Namespace, matches: list[str]) -> int:
    if not matches:
        print(f"error: section_not_found\nquery: {args.section}\nmatches[0]:")
        print(f"help[1]:\nRun `vyasa sections {shlex.quote(str(args.document))}`")
        return 1
    command = f"vyasa sections {shlex.quote(str(args.document))} '<exact-heading>'"
    if args.include_children:
        command += " --include-children"
    print(f"error: ambiguous_section\nquery: {args.section}")
    print(f"matches[{len(matches)}]{{number,heading}}:\n{_toon_rows(matches)}")
    print(f"help[1]:\nRun `{command}`")
    return 2


def _choose_match(query: str, matches: list[str]) -> str | None:
    print(f'Multiple sections match "{query}":', file=sys.stderr)
    for number, heading in enumerate(matches, 1):
        print(f"  {number}. {heading}", file=sys.stderr)
    while True:
        print(f"Choose [1-{len(matches)}]: ", end="", file=sys.stderr, flush=True)
        choice = sys.stdin.readline()
        if not choice:
            return None
        if choice.strip().isdigit() and 1 <= int(choice) <= len(matches):
            return matches[int(choice) - 1]
        print("Enter one of the listed numbers.", file=sys.stderr)


def sections_command(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="vyasa sections", description="List or read Markdown sections"
    )
    parser.add_argument("document", type=Path, help="Path to a Markdown document")
    parser.add_argument(
        "section", nargs="?", help='Exact heading, such as "### Installation"'
    )
    parser.add_argument(
        "--include-children", action="store_true", help="Include nested sections"
    )
    args = parser.parse_args(argv)
    if args.include_children and args.section is None:
        parser.error("--include-children requires a section")
    try:
        text = args.document.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        print(f"Error reading {args.document}: {exc}", file=sys.stderr)
        return 1
    if args.section is None:
        print("\n".join(list_markdown_sections(text)))
        return 0
    matches = find_markdown_sections(text, args.section)
    if len(matches) != 1:
        if len(matches) > 1 and sys.stdin.isatty():
            selected = _choose_match(args.section, matches)
            if selected is None:
                return 1
        else:
            return _print_match_error(args, matches)
    else:
        selected = matches[0]
    content = extract_markdown_section(
        text, selected, include_children=args.include_children
    )
    assert content is not None
    print(content or f"{selected} *")
    return 0
