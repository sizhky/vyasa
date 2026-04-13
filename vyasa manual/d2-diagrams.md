# D2 Diagrams

Vyasa treats D2 as a first-class diagram format for pages that need architecture, grouped systems, or staged reveal rather than hand-drawn prose. The renderer expects a `d2` fence in Markdown, then lets the client runtime handle sizing, zoom, theme-aware redraw, and fullscreen behavior. This guide is about authoring D2 blocks that fit naturally into a live document, not about every D2 feature. The mental model is simple: keep the diagram source in the page, use frontmatter for container behavior, and only reach for animation when the reveal itself explains something.

## A Good Starting Block

````markdown
```d2
---
title: Deployment pipeline
width: 80vw
layout: elk
animate_interval: 1200
---
direction: right
local.code -> github.dev: commit
github.master.workflows -> aws.builders: upload and run
```
````

The animation example in [`demo/d2-animation.md`](/Users/yeshwanth/Code/Personal/vyasa/demo/d2-animation.md) is worth reusing when you need a staged story instead of a static diagram. Keep `width`, `layout`, and `title` in frontmatter so the page layout can treat the diagram as a document element instead of a raw SVG blob.

## Why These Knobs Exist

| Knob | Why it matters |
|---|---|
| `layout` | Controls readability before styling does; `elk` is the safe default. |
| `title` | Gives fullscreen mode and the surrounding page a stable label. |
| `animate_interval` | Turns reveal order into part of the explanation. |
| `width` | Prevents wide systems diagrams from crushing the prose column. |
