# Mermaid

Use fenced Mermaid blocks for Mermaid diagrams.
Read project syntax before adding new frontmatter controls.

## Basic

````markdown
```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Done]
    B -->|No| A
```
````

## Frontmatter

````markdown
```mermaid
---
width: 80vw
height: 60vh
min-height: 400px
---
graph LR
    A --> B
```
````

Controls:

- `width`: container width, default `65vw`
- `height`: container height, default `auto`
- `min-height`: minimum height, default `400px`
- `aspect_ratio`: useful for Gantt charts

## Labels

Use literal `<br/>` for Mermaid line breaks:

```mermaid
flowchart TD
    A["Request<br/>Received"] -->|"Validate<br/>Headers"| B{"Authorized<br/>User?"}
```

Do not use `\n` for label breaks.
Shorten labels before changing layout.

## Supported Types

- `flowchart` / `graph`
- `sequenceDiagram`
- `classDiagram`
- `erDiagram`
- `stateDiagram-v2`
- `gantt`
- `mindmap`
- `timeline`
- `architecture-beta`
- `sankey-beta`, `radar-beta`, `treemap-beta`, `C4Context`

## Guardrails

- Prefer standard Mermaid syntax unless Vyasa documents a wrapper option.
- Do not invent frontmatter keys.
- Split dense diagrams into multiple blocks linked by headings.
- Keep node text readable; Mermaid is not a database dump format.
