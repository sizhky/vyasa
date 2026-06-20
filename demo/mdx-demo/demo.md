---
title: MDX Ecosystem Demos
source_note: "Two simple proofs: published canvas behavior and published linked-chart behavior inside Vyasa MDX."
---

import VegaDashboard from './VegaDashboard.jsx'

# MDX Ecosystem Demos

This page is intentionally simple.

Vyasa MDX can mount polished behavior from existing JavaScript ecosystems while prose stays Markdown and durable demo data stays in a sidecar JSON file.

## Excalidraw
Canvas editing, pan, zoom, selection, drawing tools, and scene state come from Excalidraw.

<Excalidraw id="mdx-roadmap" stateFile="./demo.state.json" />

## Vega-Lite
This uses Vega-Lite's official interactive movies dashboard pattern: click genre bars, and the rating heatmap cross-highlights the selected genre.

<VegaDashboard stateFile="./demo.state.json" />

```mdx
import VegaDashboard from './VegaDashboard.jsx'

<Excalidraw id="mdx-roadmap" stateFile="./demo.state.json" />
<VegaDashboard stateFile="./demo.state.json" />
```

## Contract
`demo.state.json` holds durable scene/chart data. Every canvas declares a stable `id` so tools can address it independently.

Discover all published APIs at `/api/catalog`, or only MDX APIs at `/api/mdx/catalog`.

The token-light graph is available at `/api/mdx/excalidraw/mdx-demo/demo/canvas/mdx-roadmap?ref=./demo.state.json`. POST new `nodes` or `connections`; PATCH existing text and colors without replacing Excalidraw layout metadata.

After editing the full sidecar directly, POST `/api/mdx/excalidraw/mdx-demo/demo/canvas/mdx-roadmap/refresh?ref=./demo.state.json` to refresh an open page.
