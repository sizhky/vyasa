# Visuals

Fenced blocks that render charts from rows. Read the drawer for the visual you need, not all of them.

Registry: `vyasa/extensions_builtin/visuals/registry.py`. Live examples: `demo/visuals/`.

- `visuals/card.md` — stat tiles. One big number each.
- `visuals/bar.md` — horizontal bars for one series. The default choice.
- `visuals/stack.md` — one bar split into shares of a whole.
- `visuals/src.md` — feed any visual from a json, yaml, or csv file.
- `visuals/vega.md` — Vega-Lite specs, for layered or interactive charts.
- `visuals/vega-remote.md` — Vega-Lite reading data from a URL.
- `visuals/altair.md` — Altair Python code, for a spec with derived numbers.
- `visuals/adding-a-visual.md` — add an entry to the registry.

## Shared grammar

Every visual reads the same body, so learn this once:

- One row per line. Cells split on `|`. Whitespace trimmed.
- Trailing `@flag` tokens set the row tone: `@accent`, `@muted`, `@good`, `@warn`.
- A line starting with `#` is a comment.
- Options go in the fence info string, never in the body.
- Shared options: `title`, `note`, `src`, `select`, `label_key`, `value_key`.

## Rules

- Render charts with these fences. Do not hand-write inline-CSS bars or stat tiles.
- Write raw counts. Let the fence compute widths and shares.
- A malformed block renders a visible error card, so a bad chart never takes the page down.

## Fast check

`python -m pytest tests/test_visuals.py`
