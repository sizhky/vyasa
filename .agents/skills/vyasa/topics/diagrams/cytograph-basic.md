# Cytograph Basic

Cytograph is Cytoscape.js interactive DAG support.
Use it for navigable graphs, dependency maps, and large concept trees.

## Inline Graph

````markdown
```cytograph
---
height: 70vh
layout: vyasa
initial_depth: 2
---
nodes:
  - id: root
    label: "Repo heart"
    state: explored
  - id: agent
    label: "Agent"
    state: frontier
  - id: run
    label: "run()"
    state: unexplored
    url: "posts/guide#run"
edges:
  - source: root
    target: agent
  - source: agent
    target: run
```
````

## Frontmatter

- `height`: canvas height, default `60vh`
- `layout`: `vyasa`, `dagre`, or `cola`; default `vyasa`
- `initial_depth`: visible depth on load; default `2`
- `source`: optional sidecar graph source

Prefer `layout: vyasa` for text-heavy reading graphs.
Use `dagre` for top-down DAG semantics.
Use `cola` for force-directed exploration.

## Node Fields

- `id`: required slug-safe identifier, no spaces
- `label`: required display text
- `state`: required `explored`, `frontier`, or `unexplored`
- `url`: optional navigation target for leaf clicks

Internal URLs use Vyasa route shape, no `.md` extension.
Example: `posts/vyasa manual/mermaid-diagrams`.

## States And Clicks

- `explored`: visited or covered
- `frontier`: children exist but not expanded
- `unexplored`: not interacted with
- Parent click toggles expansion.
- Leaf click with `url` navigates.
- External `http(s)://` URLs open in a new tab.

`state` controls fill/text color only.
Border style is graph-structure driven.
Read source drawers before proposing sidecar syntax.
