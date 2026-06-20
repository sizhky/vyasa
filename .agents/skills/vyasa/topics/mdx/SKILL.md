---
name: mdx
description: Use for Vyasa MDX authoring, React islands, sibling JS/JSX components, sidecar files, built-in Excalidraw canvases, MDX API discovery, decorated publishable APIs, compact graph reads and writes, canvas refresh, static builds, implementation changes, and MDX debugging or tests.
---

# Vyasa MDX

Use Markdown for prose and isolated React components for behavior. Preserve runtime/static parity and keep component state in content-root-safe sidecars.

## Load First

For authoring or operation, inspect only the relevant document, component, and sidecar.

For implementation changes, read:

- `vyasa/extensions_builtin/mdx/render.py`
- `vyasa/extensions_builtin/mdx/static/mdx.js`
- the closest MDX route/component module
- focused tests in `tests/test_mdx.py`

Read `vyasa/api_catalog.py` when publishing or changing an API.

## Authoring Contract

- Vyasa detects MDX behavior inside `.md` files containing supported imports, exports, or uppercase JSX islands.
- Import sibling default components with `import Name from './Name.jsx'` or `.js`.
- Keep ordinary prose, headings, links, and fences as Markdown.
- Browser component modules may import only `react`; load other browser libraries explicitly when required.
- Treat each JSX island as an independent React root; do not assume shared context between islands.
- Use `<Excalidraw id="stable-id" stateFile="./board.json" />`; every canvas must declare a stable ID.
- Prefer one sidecar for related durable data. Use `excalidrawCanvases.<id>` for multiple canvases; legacy `excalidraw` remains supported for one canvas.

## API Discovery

- Discover Vyasa-published APIs with `GET /api/catalog`.
- Discover MDX-only APIs with `GET /api/mdx/catalog`.
- Make publishable routes use `@publish_api(...)`; never maintain a separate static catalog.
- Let the decorator own route path and methods. Keep query/body contracts in the same decorator.
- Write a precise endpoint docstring; the catalog derives its description and Python signature from the handler.

## Sidecar API

Use `/api/mdx/files/{document}?ref={sidecar}` to read a sidecar. Local callers may POST complete replacement bytes atomically.

Rules:

- The document slug has no `.md` suffix.
- `ref` must stay inside configured content roots.
- Reads honor document authorization.
- Writes are localhost-only.
- Static builds copy sidecars for reads but cannot provide server write-back.

## Excalidraw Graph API

Base path:

`/api/mdx/excalidraw/{document}/canvas/{canvas_id}?ref={sidecar}`

- `GET`: return token-light `nodes` and `connections` with IDs, text, colors, and connection endpoints.
- `POST`: add cards and bound connections. Nodes require `text`; IDs and positions are optional.
- `PATCH`: update existing node/connection text or color without replacing layout metadata.
- `DELETE`: remove nodes/connections by id — `{"nodes":["id"],"connections":["id"]}`. Deleting a node cascades to its text label and any connectors bound to it.
- `POST .../refresh`: force open pages to reload. Only needed after a direct sidecar edit that did **not** change the file mtime; `POST`/`PATCH` already write the file, so open pages reload on their own — do not chain a refresh after them.

### Task-card convention

Cards can act as a todo board by background color: `#ffc9c9` (red) = todo, `#ffec99` (yellow) / `#ffa94d` (orange) = in progress, `#b2f2bb` (green) = done. To mark a task done, `PATCH` that node's `color` to `#b2f2bb`. The open page reloads automatically (the watch signal is the sidecar's mtime); no separate refresh call is required.

Create example:

```json
{"nodes":[{"id":"done","text":"Done","color":"#b2f2bb"}],"connections":[{"from":"todo","to":"done"}]}
```

Update example:

```json
{"nodes":[{"id":"todo","color":"#b2f2bb"}]}
```

Use six-digit hex colors or `transparent`. Do not manufacture raw Excalidraw element JSON when the compact endpoint covers the operation.

## Implementation Ownership

- Parsing/rendering: `vyasa/extensions_builtin/mdx/render.py`
- Browser hydration: `vyasa/extensions_builtin/mdx/static/mdx.js`
- Built-in canvas behavior: `vyasa/extensions_builtin/mdx/static/excalidraw.js`
- Sidecar safety/write-back: `vyasa/extensions_builtin/mdx/file_routes.py`
- Compact graph/create/update/refresh: `vyasa/extensions_builtin/mdx/excalidraw_routes.py`
- MDX scoped catalog: `vyasa/extensions_builtin/mdx/catalog.py`
- Vyasa publication registry: `vyasa/api_catalog.py`

Keep MDX behavior inside this extension. Do not move it into `core.py`.

## Verification

Run millisecond-scale checks only unless the user asks for browser testing:

```bash
python -m pytest -q tests/test_mdx.py tests/test_extensions.py
ruff check vyasa/api_catalog.py vyasa/extensions_builtin/mdx tests/test_mdx.py
node --check vyasa/extensions_builtin/mdx/static/mdx.js
node --check vyasa/extensions_builtin/mdx/static/excalidraw.js
```

Also run `git diff --check`. Do not open a browser unless explicitly requested.
