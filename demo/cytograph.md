# Cytograph — Interactive DAG

Click any node to expand or collapse its children. Nodes start hidden beyond `initial_depth`.

## Basic example (dagre, depth 2)

```cytograph
---
height: 60vh
layout: dagre
initial_depth: 2
---
nodes:
  - id: root
    label: "Vyasa"
    state: explored
  - id: content
    label: "Content"
    state: explored
  - id: rendering
    label: "Rendering"
    state: frontier
  - id: server
    label: "Server"
    state: frontier
  - id: markdown
    label: "Markdown"
    state: unexplored
  - id: diagrams
    label: "Diagrams"
    state: unexplored
  - id: routes
    label: "Routes"
    state: unexplored
  - id: auth
    label: "Auth"
    state: unexplored
  - id: mermaid
    label: "Mermaid"
    state: unexplored
  - id: d2
    label: "D2"
    state: unexplored
  - id: cytograph
    label: "Cytograph"
    state: unexplored
edges:
  - source: root
    target: content
  - source: root
    target: rendering
  - source: root
    target: server
  - source: content
    target: markdown
  - source: content
    target: diagrams
  - source: server
    target: routes
  - source: server
    target: auth
  - source: diagrams
    target: mermaid
  - source: diagrams
    target: d2
  - source: diagrams
    target: cytograph
```

## Force-directed (cola layout)

```cytograph
---
height: 50vh
layout: cola
initial_depth: 1
---
nodes:
  - id: a
    label: "Agent"
    state: explored
  - id: run
    label: "run()"
    state: frontier
  - id: tools
    label: "Tools"
    state: frontier
  - id: memory
    label: "Memory"
    state: unexplored
  - id: llm
    label: "LLM"
    state: unexplored
  - id: bash
    label: "Bash"
    state: unexplored
  - id: read
    label: "Read"
    state: unexplored
  - id: write
    label: "Write"
    state: unexplored
edges:
  - source: a
    target: run
  - source: a
    target: tools
  - source: a
    target: memory
  - source: run
    target: llm
  - source: tools
    target: bash
  - source: tools
    target: read
  - source: tools
    target: write
```
