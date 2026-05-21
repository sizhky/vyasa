# Cytograph Sources

For source-backed Cytograph graphs, prefer a sidecar `source:` for large trees.
Do not embed hundreds of nodes in a markdown fence.

## Fence

````markdown
```cytograph
---
source: ./tree.cytree
layout: vyasa
initial_depth: 1
---
```
````

`source:` is resolved relative to the current markdown file.
If `source:` is used and `initial_depth` is omitted, Vyasa defaults it to `1`.

## JSON Shape

```json
{
  "nodes": [
    { "id": "root", "label": "Root", "state": "explored" }
  ],
  "edges": [
    { "source": "root", "target": "child" }
  ]
}
```

Use JSON when the graph is not naturally tree-shaped.

## `.cytree`

Prefer `.cytree` for large tree-shaped sources.
It is smaller because hierarchy, ids, and shared URL bases are implicit.

- `! ` means `explored`
- `* ` means `frontier`
- blank marker means `unexplored`
- `@base <path>` sets shared URL base for sibling lines
- `-> #fragment` reuses active base
- `-> =` means same document as current base, no fragment

```text
! Vyasa
  * Writing and Markdown
    @base posts/vyasa manual/markdown-features
    * Markdown Features -> =
    * Headings and anchors -> #headings
      Plain-text headings -> #headings
```

Do not hand-author ids in compact `.cytree`; node ids derive from the label path.

## Route Rules

- Non-markdown sources should resolve to raw file URLs like `/download/...`.
- Do not use `/posts/...` for non-markdown sources; it renders HTML and breaks the loader.
- The full source graph is fetched once.
- Only visible nodes and edges are materialized into Cytoscape.
- `All` expands visible/materialized parents, not the whole backing tree.
