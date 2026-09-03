"""Renderers for the visuals registry.

Each renderer receives parsed rows plus the fence options and returns HTML that
carries classes only. Colour, spacing and dark-mode live in `visuals.css`, so a
theme can restyle every visual at once.

Pro: a page author writes data, never CSS, and the numbers stay auditable.
Con: a one-off look now needs a registry entry or a CSS override, not an inline
style.
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from ...markdown_fence import escape_attr
from .parse import Row, VisualError, parse_number

TONES = ("accent", "muted", "good", "warn")


def _tone(flags: frozenset[str]) -> str:
    """First recognised flag wins, so `@accent @wide` still reads as accent."""
    return next((tone for tone in TONES if tone in flags), "base")


def _text(value: object) -> str:
    return escape_attr(str(value or "")) or ""


def _percent(part: float, whole: float) -> str:
    """
    >>> _percent(117, 583)
    '20.1%'
    >>> _percent(1, 0)
    ''
    """
    if not whole:
        return ""
    return f"{part / whole * 100:.1f}%"


def _width(value: float | None, scale: float) -> str:
    """Clamp to [0, 100] so a value above `max=` cannot overflow the track.

    >>> _width(264, 264)
    '100.0'
    >>> _width(400, 264)
    '100.0'
    >>> _width(None, 264)
    '0.0'
    """
    if not scale or value is None:
        return "0.0"
    return f"{max(0.0, min(100.0, value / scale * 100)):.1f}"


def _shell(kind: str, body: str, attrs: Mapping[str, Any]) -> str:
    title = _text(attrs.get("title"))
    note = _text(attrs.get("note"))
    head = f'<figcaption class="vyasa-visual__title">{title}</figcaption>' if title else ""
    tail = f'<figcaption class="vyasa-visual__note">{note}</figcaption>' if note else ""
    return f'<figure class="vyasa-visual vyasa-visual--{kind}">{head}{body}{tail}</figure>'


def render_error(name: str, message: str) -> str:
    return (
        '<figure class="vyasa-visual vyasa-visual--error">'
        f'<figcaption class="vyasa-visual__title">{_text(name)} block</figcaption>'
        f'<div class="vyasa-visual__error">{_text(message)}</div>'
        "</figure>"
    )


def _ordered(rows: Sequence[Row], attrs: Mapping[str, Any]) -> list[Row]:
    order = str(attrs.get("sort") or "").lower()
    if order not in {"asc", "desc"}:
        return list(rows)
    return sorted(rows, key=lambda row: parse_number(row.get("value")) or 0.0, reverse=order == "desc")


def render_bar(rows: Sequence[Row], attrs: Mapping[str, Any]) -> str:
    """Horizontal bars scaled against `max=`, defaulting to the largest value.

    `total=` turns the value column into `raw · share%`. `total=sum` uses the
    sum of the rows, which is the honest default when the rows partition a
    whole.
    """
    rows = _ordered(rows, attrs)
    if not rows:
        raise VisualError("no rows")
    values = [parse_number(row.get("value")) for row in rows]
    numeric = [value for value in values if value is not None]
    scale = parse_number(attrs.get("max")) or (max(numeric) if numeric else 0.0)
    raw_total = str(attrs.get("total") or "")
    total = sum(numeric) if raw_total.lower() == "sum" else (parse_number(raw_total) or 0.0)
    cells = []
    for row, value in zip(rows, values):
        share = _percent(value, total) if value is not None else ""
        display = row.get("value")
        if share:
            display = f"{display} · {share}" if display else share
        cells.append(
            f'<div class="vyasa-bar" role="listitem">'
            f'<span class="vyasa-bar__label">{_text(row.get("label"))}</span>'
            f'<span class="vyasa-bar__track" aria-hidden="true">'
            f'<span class="vyasa-bar__fill" data-tone="{_tone(row.flags)}" style="width:{_width(value, scale)}%"></span>'
            f"</span>"
            f'<span class="vyasa-bar__value">{_text(display)}</span>'
            f"</div>"
        )
    return _shell("bar", f'<div class="vyasa-visual__rows" role="list">{"".join(cells)}</div>', attrs)


def render_card(rows: Sequence[Row], attrs: Mapping[str, Any]) -> str:
    """Stat tiles: a big value, a small label, an optional note.

    Reads `value | label | note`, the order a reader scans them in.
    """
    if not rows:
        raise VisualError("no rows")
    tiles = []
    for row in rows:
        note = row.get("note")
        note_html = f'<div class="vyasa-card__note">{_text(note)}</div>' if note else ""
        tiles.append(
            f'<div class="vyasa-card" data-tone="{_tone(row.flags)}">'
            f'<div class="vyasa-card__value">{_text(row.get("value"))}</div>'
            f'<div class="vyasa-card__label">{_text(row.get("label"))}</div>'
            f"{note_html}</div>"
        )
    columns = str(attrs.get("columns") or "")
    style = f' style="--vyasa-card-columns:{int(columns)}"' if columns.isdigit() else ""
    return _shell("cards", f'<div class="vyasa-visual__grid"{style}>{"".join(tiles)}</div>', attrs)


def render_stack(rows: Sequence[Row], attrs: Mapping[str, Any]) -> str:
    """One horizontal bar split into shares, for parts of a single whole.

    Chosen over a pie because length is easier to compare than angle.
    """
    if not rows:
        raise VisualError("no rows")
    values = [parse_number(row.get("value")) or 0.0 for row in rows]
    total = parse_number(attrs.get("total")) or sum(values)
    if not total:
        raise VisualError("rows sum to zero")
    segments, legend = [], []
    for index, (row, value) in enumerate(zip(rows, values)):
        share = value / total * 100
        tone = _tone(row.flags) if row.flags & set(TONES) else f"series-{index % 5}"
        segments.append(
            f'<span class="vyasa-stack__segment" data-tone="{tone}" style="width:{share:.1f}%">'
            f'<span class="vyasa-stack__share">{share:.1f}%</span></span>'
        )
        legend.append(
            f'<span class="vyasa-stack__key"><span class="vyasa-stack__swatch" data-tone="{tone}" aria-hidden="true"></span>'
            f'{_text(row.get("label"))} — {_text(row.get("value"))}</span>'
        )
    return _shell(
        "stack",
        f'<div class="vyasa-stack">{"".join(segments)}</div>'
        f'<div class="vyasa-stack__legend">{"".join(legend)}</div>',
        attrs,
    )
