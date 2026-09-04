---
title: Vyasa Kernel
code_root: ..
code_extensions: py,js,md
---

# Vyasa Kernel

This is the smallest useful picture of how Vyasa shows a file on screen.

Two stories share one set of nodes. **Flow** follows a request from the browser to a rendered page. **Fence** follows one fenced block from Markdown text to the widget you are looking at. Pick a story with the view switcher, then step through its slides.

The two stories meet at one node, the Markdown renderer. Flow ends by handing the body to it. Fence starts there.

```items
---
items_schema: vyasa.kg/kg.schema
---
```

## How to read a slide

A lane is anything that can receive a call. A document and a response are values on the arrows, never lanes of their own.

One row with two lines is one exchange. The solid line is the call. The dashed line under it is the value coming back.

A rectangle down a lane is that lane's frame. It opens where a call lands and closes where its reply leaves, so anything drawn inside it happened while that call was still running. A step number counts turns, never depth, which is why the frame and not the number tells you what is nested.

Hover a node or an arrow to see the source it names. Every arrow points at a real line, so a slide that drifts from the code is a bug in the pack, not a simplification.

## Why the graph stays small

A view never draws the whole graph. Each story owns its own edge file and its own source name, and a lane appears only when an edge in that source touches it. The name matters: `source=base` means every edge in the pack, so a story left on `base` collects the next story's lanes as soon as one is added.

That is the rule that keeps the picture readable as the pack grows: **add views, not lanes.**
