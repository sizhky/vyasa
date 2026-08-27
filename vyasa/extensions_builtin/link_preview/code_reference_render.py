"""Render a resolved code reference into preview HTML.

The server owns every line number here. The browser only presents what this
module emits: it must not repeat git lookup, symbol selection, or range
calculation.
"""

from __future__ import annotations

import html

from ..markdown.renderer import render_code_shell
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
    return (
        f'<span class="vyasa-code-reference-badge" data-badge="{_escape(kind)}"'
        f'{f" title=\"{_escape(label)}\"" if label else ""}>'
        f'<span class="sr-only">{_escape(label or kind)}: </span>{_escape(text)}</span>'
    )


def _post_href(relative_path: str, line: int = 0) -> str:
    encoded = "/".join(part for part in str(relative_path).split("/"))
    return f"/posts/{encoded}%3A{line}" if line else f"/posts/{encoded}"


def _header(resolved: ResolvedCodeReference, relative_path: str) -> str:
    reference = resolved.reference
    path_html = _escape(relative_path)
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
        f'<a class="vyasa-code-reference-action" href="{_escape(_post_href(relative_path, resolved.selected.start))}">'
        "Open in editor</a>"
        f'<a class="vyasa-code-reference-action" href="{_escape(_post_href(relative_path))}">Open full file</a>'
    )
    return (
        '<header class="vyasa-code-reference-header">'
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
    if focus_count > 1:
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
    "render_code_reference_diagnostic",
    "render_resolved_code_reference",
]
