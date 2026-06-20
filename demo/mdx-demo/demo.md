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

<Excalidraw id="mdx-roadmap" />

## Vega-Lite
This uses Vega-Lite's official interactive movies dashboard pattern: click genre bars, and the rating heatmap cross-highlights the selected genre.

<VegaDashboard specFile="./demo.vega.json" />

```mdx
import VegaDashboard from './VegaDashboard.jsx'

<Excalidraw id="mdx-roadmap" />
<VegaDashboard specFile="./demo.vega.json" />
```

## Contract
`<Excalidraw id="..." height="640" />`
- `id` — **required**, must match `[A-Za-z0-9][A-Za-z0-9_.-]{0,127}` (it becomes the sidecar filename). Same rule on client and server.
- `height` — optional pixels, defaults to `640`.
- Each component owns one sidecar JSON named from its `id` (`mdx-roadmap` writes `mdx-roadmap.state.json`). The file is the bare scene; no shared page-level file.
- Canvas edits persist only when `VYASA_MDX_EDIT` is set; UI prefs (dark mode) live in the browser, never the sidecar.

Discover all published APIs at `/api/catalog`, or only MDX APIs at `/api/mdx/catalog`.

The token-light graph is available at `/api/mdx/excalidraw/mdx-demo/demo/canvas/mdx-roadmap?ref=./mdx-roadmap.state.json`. POST new `nodes` or `connections`; PATCH existing text and colors without replacing Excalidraw layout metadata.

After editing the full sidecar directly, POST `/api/mdx/excalidraw/mdx-demo/demo/canvas/mdx-roadmap/refresh?ref=./mdx-roadmap.state.json` to refresh an open page.
