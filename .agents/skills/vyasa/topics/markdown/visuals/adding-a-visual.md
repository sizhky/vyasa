# Adding a visual

Four steps. The registry drives fence names, declared capabilities, and the gallery,
so nothing else needs editing.

1. Write the renderer in `vyasa/extensions_builtin/visuals/render.py`.
   It takes `(rows, attrs)` and returns HTML carrying classes only.
2. Add one `register(Visual(...))` entry in `registry.py`: name, summary,
   `cell_names`, the renderer, its options, and one example.
3. Style it in `static/visuals.css` using the `--tone` variable, so every theme
   and both colour schemes follow without further work.
4. Add a case to `tests/test_visuals.py` and a section to `demo/visuals/`.
   A test asserts the gallery documents every registry entry, so step 4 is enforced.

## Constraints

- `cell_names` maps positional cells onto field names. `bar` uses
  `("label", "value")`; `card` uses `("value", "label", "note")` because that is
  the order a reader scans.
- Never emit an inline style except a computed width or height. Colour belongs in
  the stylesheet.
- Escape every author string with `escape_attr`.
- Raise `VisualError` for anything the author can fix. It becomes a visible card.

## When not to add one

If the visual needs nested data or its own grammar, it does not belong in the
registry — the shared row grammar would become a lie. Give it its own extension,
as Vega-Lite has.
