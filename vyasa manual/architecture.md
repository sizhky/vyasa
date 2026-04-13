# Architecture Overview

Vyasa is a live document server that keeps three concerns loosely coupled: request routing, Markdown-to-HTML rendering, and page shell composition. A request enters through the CLI-booted app in [`vyasa/main.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/main.py), routes through handlers in [`vyasa/content_routes.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/content_routes.py), and is finally wrapped by [`render_layout()`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/layout_page.py). This guide is for understanding that flow well enough to debug or extend it. The useful mental model is "one content tree, many render modes, one shared shell."

## Request Flow In One Pass

The content route finds the file or folder note, parses frontmatter, resolves the visible title, and calls `from_md()` for the actual render. The layout layer then adds navbar, sidebars, scoped CSS, TOC extraction, and page actions such as copy-markdown or present-mode links. HTMX requests reuse the same content pipeline but return a narrower shell, which is why page navigation feels lightweight without needing a separate client router.

## Why The Pieces Stay Separate

| Layer | Why it stays separate |
|---|---|
| content routes | Decide what document the request is really asking for. |
| markdown renderer | Knows how Vyasa-specific syntax becomes HTML. |
| layout renderer | Knows how the surrounding site chrome should behave. |
| auth beforeware | Blocks bad requests before expensive rendering starts. |
