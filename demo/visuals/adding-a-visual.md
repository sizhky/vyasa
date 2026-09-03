---
title: adding a visual
---

# Adding a visual

Four steps. The registry drives the fence names, the declared capabilities, and this folder, so nothing else needs editing.

1. Write the renderer in `vyasa/extensions_builtin/visuals/render.py`. It takes `(rows, attrs)` and returns HTML carrying classes only.
2. Add one `register(Visual(...))` entry in `registry.py`: name, summary, `cell_names`, the renderer, its options, and one example.
3. Style it in `static/visuals.css` using the `--tone` variable, so every theme and both colour schemes follow without further work.
4. Add a case to `tests/test_visuals.py` and a demo page to this folder. A test asserts every registry entry has one, so step 4 is enforced.

## Constraints

- `cell_names` maps positional cells onto field names. `bar` uses `("label", "value")`; `card` uses `("value", "label", "note")`, because that is the order a reader scans them.
- Never emit an inline style except a computed width or height. Colour belongs in the stylesheet.
- Escape every author string with `escape_attr`.
- Raise `VisualError` for anything the author can fix. It becomes a visible card — see [[demo/visuals/errors|errors]].

## When not to add one

If the visual needs nested data or a grammar of its own, it does not belong in the registry: the shared row grammar would become a lie. Give it its own extension, as Vega-Lite has.

That is the line. `card`, `bar` and `stack` all read `label` and `value`. A treemap, a flame graph or a sankey needs a tree or an edge list, so each would be its own extension rather than a registry entry.
