# Slides Route

Rules:

- Current slides use the document itself as the deck source.
- Do not mention Reveal.js, `---`/`--` separators, or `reveal_*` unless the user says old engine.
- `##` starts a horizontal slide.
- `###+` creates a downward/detail slide under the active `##`.
- Empty `##` parent slides should be skipped.
- Slide pages inherit normal document shell, theme, fonts, and `custom.css`.
- Use full navigation for exits to normal doc routes when sidebars should survive.
- Slide splitter must be fence-aware; headings inside code fences or `:::tabs` are content.
- Keep document-scoped tooltip definitions available when reveal renders paragraph groups separately.
- After changing slide grouping, run `python -m pytest tests/test_markdown_renderer.py -q -k slide_route_keeps_tooltip_definition`.
