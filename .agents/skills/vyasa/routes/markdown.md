# Markdown Route

Read only the drawer needed:

- `topics/markdown/frontmatter-index-raw.md`
- `topics/markdown/includes-inline.md`
- `topics/markdown/tables-lists-tabs.md`
- `topics/markdown/toc-headings-math.md`
- `topics/markdown/callouts.md`
- `topics/markdown/items-graphs.md`
- `topics/markdown/items-query.md` for read-only Knowledge Graph questions, context comparison, and traversal paths.
- `topics/markdown/items-graphs-lite.md` for small inline `items` / `tasks` docs that do not need sidecars.
- `topics/markdown/items-behavior.md`
- `topics/story-telling-with-graphs/SKILL.md`
- `topics/markdown/visuals.md` for charts: `card`, `bar`, `stack`, and Vega-Lite specs.
- `topics/markdown/code-includes-links.md`
- `topics/markdown/misc.md`

Rules:

- Prefer existing Obsidian-compatible syntax where supported.
- For new `items` / `tasks` Knowledge Graphs, default to KG Pack sidecars. Use lite inline graph syntax when the graph is small and does not need sidecars, or when the existing document already uses inline syntax.
- When a document refers to a code file, link the symbol with `[symbol](path/to/file.ext?symbol=X&kind=Y)`. See `topics/markdown/code-includes-links.md` for the allowed `kind` values.
- Render charts with the `visuals` fences. Do not hand-write inline-CSS bars or stat tiles.
- Do not invent parser syntax until existing drawers prove no fit.
