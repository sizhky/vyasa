# Vyasa Manual

Vyasa turns a folder of Markdown files into a navigable site with a live Python server, shared page chrome, and a renderer that knows about notes, diagrams, tabs, math, and folder-aware navigation. This manual is for the moment after `pip install vyasa` succeeds and you need to decide what to do next. Start here if you want the shortest path from an empty folder to a working site, then branch into the guide that matches the next question in your head. The manual stays close to the code, so every guide points back to the file that implements the behavior it describes.

## Where To Start

| If your next question is... | Open this guide | Why start there |
|---|---|---|
| How do I run it and shape the site? | [Configuration and CLI](configuration.md) | The server entry point and config precedence live there. |
| What can I write in Markdown? | [Writing in Vyasa Markdown](markdown-features.md) | It covers the authoring surface before internals. |
| How do diagrams fit into a page? | [Mermaid diagrams](mermaid-diagrams.md) or [D2 diagrams](d2-diagrams.md) | Each renderer has different knobs and runtime behavior. |
| How do I restyle the shell and article? | [Theming and CSS](theming.md) | It separates page chrome from content styling. |
| How do auth and path rules work? | [Security and access](security.md) | It explains the live app trust boundaries. |
| How does the request pipeline hang together? | [Architecture overview](architecture.md) | It maps the server, renderer, and layout flow. |
| What happens after the basics? | [Advanced behavior](advanced.md) | It covers escape hatches and operational edges. |
