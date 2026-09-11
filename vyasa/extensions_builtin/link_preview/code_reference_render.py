"""Render a resolved code reference into preview HTML.

The server owns every line number here. The browser only presents what this
module emits: it must not repeat git lookup, symbol selection, or range
calculation.
"""

from __future__ import annotations

import html
import re
from difflib import SequenceMatcher
from itertools import zip_longest

from fasthtml.common import to_xml

from ...assets import bundle_asset_nodes_for_collector
from ...config import get_config
from ...extensions import get_extension_runtime, refresh_extension_runtime
from ...helpers import _strip_leading_frontmatter_block
from ..markdown.renderer import _render_markdown_fragment, render_code_shell
from .code_reference import (
    RENDERED_LINES_LIMIT,
    CodeReference,
    _rendered_range,
    CodeReferenceError,
    ResolvedCodeReference,
    SourceRange,
    merge_ranges,
    region_range,
    symbol_range,
    parse_line_range,
)

def _escape(value) -> str:
    return html.escape(str(value or ""), quote=True)


def _spec(pairs) -> str:
    """Compact `start-end:value` spec for the code-tools runtime."""
    return ",".join(f"{start}-{end}:{value}" for start, end, value in pairs)


def _state_spec(resolved: ResolvedCodeReference, block: SourceRange) -> str:
    """Per-line change state inside one rendered block."""
    runs: list[tuple[int, int, str]] = []
    for number in range(block.start, block.end + 1):
        state = resolved.line_state(number)
        if runs and runs[-1][2] == state and runs[-1][1] == number - 1:
            runs[-1] = (runs[-1][0], number, state)
        else:
            runs.append((number, number, state))
    return _spec(runs)


def _highlight_spec(resolved: ResolvedCodeReference, block: SourceRange) -> str:
    parts = [item.intersect(block) for item in resolved.focused]
    return ",".join(f"{item.start}-{item.end}" for item in parts if item is not None)


def _badge(kind: str, text: str, label: str = "") -> str:
    title = f' title="{_escape(label)}"' if label else ""
    return (
        f'<span class="vyasa-code-reference-badge" data-badge="{_escape(kind)}"'
        f'{title}>'
        f'<span class="sr-only">{_escape(label or kind)}: </span>{_escape(text)}</span>'
    )


def _post_href(relative_path: str, line: int = 0) -> str:
    encoded = "/".join(part for part in str(relative_path).split("/"))
    return f"/posts/{encoded}%3A{line}" if line else f"/posts/{encoded}"


def _markdown_page_href(relative_path: str) -> str:
    path = str(relative_path)
    return _post_href(path[:-3] if path.lower().endswith(".md") else path)


def _header(resolved: ResolvedCodeReference, relative_path: str) -> str:
    from ...code_source import split_origin_slug

    reference = resolved.reference
    # The origin repeats on every reference in a pack, so it reads as its own
    # label and leaves the path short. `relative_path` stays the address.
    split = split_origin_slug(relative_path)
    origin_html = (
        f'<span class="vyasa-code-reference-origin" title="{_escape(split[0])}">{_escape(split[0])}</span>'
        if split else ""
    )
    path_html = _escape(split[1] if split else relative_path)
    if resolved.renamed:
        path_html = (
            f'<span class="vyasa-code-reference-rename">{_escape(resolved.path_before)}'
            f' <span aria-hidden="true">→</span> {_escape(resolved.path_after)}'
            f'<span class="sr-only">renamed from {_escape(resolved.path_before)}</span></span>'
        )
    badges = [_badge("role", reference.role, "role")]
    if reference.change:
        revision = "worktree" if resolved.head_ref == "worktree" else resolved.head_ref[:8]
        badges.append(_badge("change", revision, "change"))
        badges.append(
            _badge("changed", f"{resolved.changed_count} changed lines", "changed lines")
        )
    if resolved.renamed:
        badges.append(_badge("rename", "renamed", "rename"))
    for diagnostic in resolved.diagnostics:
        badges.append(_badge(diagnostic.code, diagnostic.message, diagnostic.severity))
    actions = (
        f'<a class="vyasa-code-reference-action" data-vyasa-open-editor="true" '
        f'href="{_escape(_post_href(relative_path, resolved.selected.start))}">'
        "Open in editor</a>"
    )
    if relative_path.lower().endswith(".md"):
        actions += (
            f'<a class="vyasa-code-reference-action" href="{_escape(_markdown_page_href(relative_path))}">'
            "Open full file</a>"
        )
    return (
        '<header class="vyasa-code-reference-header">'
        f'{origin_html}'
        f'<span class="vyasa-code-reference-path">{path_html}</span>'
        f'<span class="vyasa-code-reference-selection">{_escape(reference.label())}</span>'
        f'<span class="vyasa-code-reference-badges">{"".join(badges)}</span>'
        f'<span class="vyasa-code-reference-actions">{actions}</span>'
        "</header>"
    )


def _controls(focus_count: int, expandable: bool, full: bool) -> str:
    buttons = []
    if expandable:
        # The old previews always showed the whole file. Keep that one click
        # away instead of making the reader leave the popup for it.
        buttons.append(
            '<button type="button" data-code-reference-toggle-full '
            f'aria-pressed="{"true" if full else "false"}" '
            'aria-label="Show the whole file in this preview">'
            f'{"Focused" if full else "Full file"}</button>'
        )
    if focus_count:
        # Always offered, even for a single block. After scrolling away through
        # the file, these are how the reader gets back to the change.
        buttons.append(
            '<button type="button" data-code-reference-previous '
            'aria-label="Previous changed block">\u2039 Prev</button>'
            f'<span class="vyasa-code-reference-position" data-code-reference-position'
            f' aria-live="polite">1 / {focus_count}</span>'
            '<button type="button" data-code-reference-next '
            'aria-label="Next changed block">Next \u203a</button>'
        )
    buttons.append(
        '<button type="button" data-code-reference-copy '
        'aria-label="Copy the shown source">Copy</button>'
    )
    return f'<div class="vyasa-code-reference-controls">{"".join(buttons)}</div>'


def _source_view(resolved: ResolvedCodeReference, shown: SourceRange) -> str:
    """One continuous, scrollable view of the shown range.

    Folding saved payload but cost the reader: to read around a change they had
    to expand a row. One range means scrolling the preview scrolls the real file.
    """
    snippet = "\n".join(resolved.source_lines[shown.start - 1 : shown.end])
    return render_code_shell(
        snippet,
        resolved.language,
        start=shown.start,
        highlight_spec=_highlight_spec(resolved, shown),
        line_states=_state_spec(resolved, shown),
        line_numbers=True,
    )


def _full_file_range(resolved: ResolvedCodeReference) -> SourceRange:
    """The whole side, clipped around the focus when the file is very large."""
    whole = SourceRange(1, max(len(resolved.source_lines), 1))
    return _rendered_range(whole, resolved.focused)


def _block_anchors(resolved: ResolvedCodeReference, shown: SourceRange) -> str:
    """Navigation stops for the tick rail and the Prev/Next controls.

    These are the merged blocks, not the raw focus ranges. Six changed lines
    inside one function are one place to look, not six. `context` decides how
    close two changes must be to count as one stop.
    """
    shown = resolved.shown
    parts = [item.intersect(shown) for item in resolved.blocks]
    return ",".join(f"{item.start}-{item.end}" for item in parts if item is not None)


def _diff_rows(resolved: ResolvedCodeReference):
    """Diff rows limited to the selected range, with focus-aware trimming.

    A deleted row has no after-side number, so it is kept by the range the
    same `show` rule resolves on the before side.
    """
    reference = resolved.reference
    after = resolved.selected if reference.side != "before" else None
    before = (
        _side_range(resolved, resolved.before_source)
        if reference.side in {"before", "both"} or reference.show == "file"
        else None
    )
    rows = [
        row
        for row in resolved.diff_lines
        if (after and row.after_line and after.start <= row.after_line <= after.end)
        or (before and row.before_line and before.start <= row.before_line <= before.end)
    ]
    if reference.focus != "changed":
        return rows
    keep: set[int] = set()
    for index, row in enumerate(rows):
        if row.state == "context":
            continue
        for offset in range(-reference.context, reference.context + 1):
            keep.add(index + offset)
    trimmed = [(index, row) for index, row in enumerate(rows) if index in keep]
    return [row for _, row in trimmed] if trimmed else rows


def _diff_html(resolved: ResolvedCodeReference) -> str:
    rows = _diff_rows(resolved)[:RENDERED_LINES_LIMIT]
    if not rows:
        return (
            '<div class="vyasa-code-reference-omission">'
            "<span class=\"vyasa-code-reference-omission-note\">No changed lines</span></div>"
        )
    marks = {"added": "+", "deleted": "-", "context": " "}
    snippet = "\n".join(f"{marks[row.state]}{row.text}" for row in rows)
    states = _spec([(index, index, row.state) for index, row in enumerate(rows, 1)])
    numbers = ",".join(
        f"{index}:{row.after_line or row.before_line}" for index, row in enumerate(rows, 1)
    )
    highlights = ",".join(
        f"{index}-{index}" for index, row in enumerate(rows, 1) if row.state != "context"
    )
    return render_code_shell(
        snippet,
        resolved.language,
        highlight_spec=highlights,
        line_states=states,
        line_number_map=numbers,
        line_numbers=True,
    )


def _side_range(resolved: ResolvedCodeReference, source: str) -> SourceRange:
    """Resolve the shown range against one side, falling back to the file."""
    reference = resolved.reference
    lines = source.splitlines()
    whole = SourceRange(1, max(len(lines), 1))
    try:
        if reference.show == "symbol":
            return symbol_range(source, resolved.file_path, reference.symbol, reference.kind)
        if reference.show == "region":
            return region_range(source, reference.region)
        if reference.show == "lines":
            return parse_line_range(reference.lines).intersect(whole) or whole
    except CodeReferenceError:
        return whole
    return whole


def _side_pane(resolved: ResolvedCodeReference, source: str, side: str, title: str) -> str:
    lines = source.splitlines()
    if not lines:
        return f'<div class="vyasa-code-reference-pane" data-code-reference-side="{side}">' \
               f'<p class="vyasa-code-reference-omission-note">{title}: no source</p></div>'
    shown = _side_range(resolved, source)
    changed = merge_ranges(
        [
            item
            for item in (
                value.intersect(shown)
                for value in _changed_for_side(resolved, side)
            )
            if item is not None
        ]
    )
    state = "deleted" if side == "before" else "added"
    states = _spec([(item.start, item.end, state) for item in changed])
    rendered = render_code_shell(
        "\n".join(lines[shown.start - 1 : shown.end]),
        resolved.language,
        start=shown.start,
        highlight_spec=",".join(f"{item.start}-{item.end}" for item in changed),
        line_states=states,
        line_numbers=True,
        title=title,
    )
    return (
        f'<div class="vyasa-code-reference-pane" data-code-reference-side="{side}">{rendered}</div>'
    )


def _changed_for_side(resolved: ResolvedCodeReference, side: str):
    from .code_reference import changed_ranges

    return changed_ranges(
        resolved.before_source.splitlines(), resolved.after_source.splitlines(), side
    )


def _diagnostic_card(code: str, message: str) -> str:
    return (
        '<div class="vyasa-code-reference-diagnostic" role="alert" '
        f'data-code-reference-diagnostic="{_escape(code)}">'
        f'<span class="vyasa-code-reference-diagnostic-code">{_escape(code)}</span>'
        f'<span>{html.escape(str(message))}</span></div>'
    )


_MARKDOWN_FENCE_RE = re.compile(r"^\s*(`{3,}|~{3,})")
_MARKDOWN_WORD_RE = re.compile(r"\s+|\w+|[^\w\s]+", re.UNICODE)
_MARKDOWN_INLINE_UNSAFE_RE = re.compile(r"`|!?\[[^\]]*\]\([^)]*\)|<[^>]+>")
_MARKDOWN_TABLE_RE = re.compile(r"(?m)^\s*\|.*\|\s*$")


def _markdown_blocks(source: str) -> list[str]:
    """Split a document at blank lines, but keep fenced blocks whole."""
    blocks: list[str] = []
    current: list[str] = []
    fence = ""
    for line in _strip_leading_frontmatter_block(source).strip().splitlines():
        match = _MARKDOWN_FENCE_RE.match(line)
        if match and not fence:
            fence = match.group(1)
        elif fence and re.match(rf"^\s*{re.escape(fence[0])}{{{len(fence)},}}\s*$", line):
            fence = ""
        if line.strip() or fence:
            current.append(line)
            continue
        if current:
            blocks.append("\n".join(current))
            current = []
    if current:
        blocks.append("\n".join(current))
    return blocks


def _marked_words(before: str, after: str) -> tuple[str, str]:
    """Mark changed words without wrapping Markdown punctuation."""
    if (
        _MARKDOWN_FENCE_RE.match(before)
        or _MARKDOWN_FENCE_RE.match(after)
        or _MARKDOWN_INLINE_UNSAFE_RE.search(before)
        or _MARKDOWN_INLINE_UNSAFE_RE.search(after)
        or _MARKDOWN_TABLE_RE.search(before)
        or _MARKDOWN_TABLE_RE.search(after)
    ):
        return before, after
    sides = [_MARKDOWN_WORD_RE.findall(value) for value in (before, after)]
    words = [[token for token in side if not token.isspace()] for side in sides]
    changed = [set(), set()]
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, words[0], words[1], autojunk=False).get_opcodes():
        if tag == "equal":
            continue
        changed[0].update(range(i1, i2))
        changed[1].update(range(j1, j2))

    def mark(tokens: list[str], indexes: set[int], tag: str) -> str:
        word_index = 0
        output: list[str] = []
        for token in tokens:
            is_word = not token.isspace()
            should_mark = is_word and word_index in indexes and any(char.isalnum() for char in token)
            output.append(f'<{tag} class="vyasa-markdown-diff-word">{token}</{tag}>' if should_mark else token)
            word_index += int(is_word)
        return "".join(output)

    return mark(sides[0], changed[0], "del"), mark(sides[1], changed[1], "ins")


def _markdown_diff_block(markdown: str, state: str, current_path: str, collector) -> str:
    label = {"added": "Added", "deleted": "Removed", "context": "Unchanged"}[state]
    rendered = _render_markdown_fragment(markdown, current_path=current_path, asset_collector=collector)
    label_html = (
        f'<span class="vyasa-markdown-diff-label">{label}</span>'
        if state != "context"
        else ""
    )
    return (
        f'<section class="vyasa-markdown-diff-block" data-markdown-diff-state="{state}">'
        f'{label_html}{rendered}</section>'
    )


def _markdown_equal_blocks(
    blocks: list[str], opcode_index: int, opcode_count: int, context: int,
    current_path: str, collector,
) -> list[str]:
    if not blocks:
        return []
    keep = set(range(min(context, len(blocks)))) if opcode_index > 0 else set()
    if opcode_index < opcode_count - 1:
        keep.update(range(max(0, len(blocks) - context), len(blocks)))
    if len(keep) == len(blocks):
        return [_markdown_diff_block(block, "context", current_path, collector) for block in blocks]
    output: list[str] = []
    omitted = False
    for index, block in enumerate(blocks):
        if index in keep:
            output.append(_markdown_diff_block(block, "context", current_path, collector))
            omitted = False
        elif not omitted:
            output.append('<div class="vyasa-markdown-diff-omission">Unchanged content omitted</div>')
            omitted = True
    return output


def _markdown_diff_body(resolved: ResolvedCodeReference, current_path: str) -> str:
    runtime = get_extension_runtime() or refresh_extension_runtime(get_config().get_extensions_config())
    collector = runtime.new_asset_collector() if runtime else None
    old_blocks = _markdown_blocks(resolved.before_source)
    new_blocks = _markdown_blocks(resolved.after_source)
    opcodes = SequenceMatcher(None, old_blocks, new_blocks, autojunk=False).get_opcodes()
    rendered: list[str] = []
    for opcode_index, (tag, i1, i2, j1, j2) in enumerate(opcodes):
        if tag == "equal":
            blocks = new_blocks[j1:j2]
            rendered.extend(
                _markdown_equal_blocks(
                    blocks, opcode_index, len(opcodes), resolved.reference.context,
                    current_path, collector,
                )
                if resolved.reference.focus == "changed"
                else [_markdown_diff_block(block, "context", current_path, collector) for block in blocks]
            )
            continue
        old, new = old_blocks[i1:i2], new_blocks[j1:j2]
        for before_block, after_block in zip_longest(old, new, fillvalue=""):
            if before_block and after_block:
                marked_before, marked_after = _marked_words(before_block, after_block)
                rendered.append(
                    '<div class="vyasa-markdown-diff-pair">'
                    f'{_markdown_diff_block(marked_before, "deleted", current_path, collector)}'
                    f'{_markdown_diff_block(marked_after, "added", current_path, collector)}</div>'
                )
            elif before_block:
                rendered.append(_markdown_diff_block(before_block, "deleted", current_path, collector))
            elif after_block:
                rendered.append(_markdown_diff_block(after_block, "added", current_path, collector))
    assets = "".join(to_xml(node) for node in bundle_asset_nodes_for_collector(collector, runtime=runtime))
    return f'{assets}<div class="vyasa-markdown-diff">{"".join(rendered)}</div>'


def render_markdown_diff_reference(
    resolved: ResolvedCodeReference, relative_path: str, *, current_path: str
) -> str:
    """Render two Markdown revisions through Vyasa and mark their differences."""
    body = _markdown_diff_body(resolved, current_path)
    reference = resolved.reference
    return (
        '<div class="vyasa-code-reference vyasa-markdown-reference" '
        f'data-code-reference-role="{_escape(reference.role)}" '
        'data-code-reference-view="markdown-diff" data-code-reference-blocks="" data-code-reference-focus="">'
        f'<div class="vyasa-code-reference-chrome">{_header(resolved, relative_path)}</div>'
        f'<div class="vyasa-code-reference-body" role="region" '
        f'aria-label="Markdown changes for {_escape(reference.label())}">{body}</div></div>'
    )


def render_resolved_code_reference(
    resolved: ResolvedCodeReference,
    relative_path: str,
    *,
    full: bool = False,
) -> str:
    """Emit the preview shell contents for one resolved reference.

    `full` widens the view to the whole file without changing what the
    reference claims: the focus ranges stay the ones the author selected.
    """
    reference = resolved.reference
    whole = _full_file_range(resolved)
    shown = whole if full else resolved.shown
    expandable = resolved.shown != whole
    if reference.view == "diff":
        body = _diff_html(resolved)
        controls = ""
    elif reference.view == "split":
        body = (
            f'<div class="vyasa-code-reference-panes">'
            f'{_side_pane(resolved, resolved.before_source, "before", "Before")}'
            f'{_side_pane(resolved, resolved.after_source, "after", "After")}</div>'
        )
        controls = ""
    else:
        body = _source_view(resolved, shown)
        controls = _controls(len(resolved.blocks), expandable, full)
    return (
        f'<div class="vyasa-code-reference vyasa-code-reference-{_escape(reference.view)}"'
        f' data-code-reference-role="{_escape(reference.role)}"'
        f' data-code-reference-view="{_escape(reference.view)}"'
        f' data-code-reference-base="{_escape(resolved.base_ref)}"'
        f' data-code-reference-head="{_escape(resolved.head_ref)}"'
        f' data-code-reference-path-before="{_escape(resolved.path_before)}"'
        f' data-code-reference-path-after="{_escape(resolved.path_after)}"'
        f' data-code-reference-blocks="{_escape(_block_anchors(resolved, shown))}"'
        f' data-code-reference-focus="{_escape(_highlight_spec(resolved, resolved.shown))}"'
        f' data-code-reference-first-line="{shown.start}"'
        f' data-code-reference-last-line="{shown.end}"'
        f' data-code-reference-full="{"true" if full else "false"}">'
        f'<div class="vyasa-code-reference-chrome">{_header(resolved, relative_path)}{controls}</div>'
        f'<div class="vyasa-code-reference-body" role="region" '
        f'aria-label="Source for {_escape(reference.label())}">{body}</div>'
        "</div>"
    )


def render_code_reference_diagnostic(error: CodeReferenceError) -> str:
    return _diagnostic_card(error.code, str(error))


__all__ = [
    "CodeReference",
    "render_markdown_diff_reference",
    "render_code_reference_diagnostic",
    "render_resolved_code_reference",
]
