---
title: Vyasa Kernel
code_root: ..
code_extensions: py,js,md
---

# Vyasa Kernel

This is the smallest useful picture of how Vyasa shows a file on screen.

Three views share one set of nodes. **Flow** follows a request from the browser to a rendered page. **Fence** follows one fenced block from Markdown text to the widget on this page. **Extensions** follows startup, where an extension claims the slots that Flow and Fence later read. Select a view with the view switcher, then step through its slides.

The three views connect at one node each. Flow ends when it passes the Markdown body to the renderer, which is where Fence begins. Fence depends on Extensions, because Extensions fills the `markdown_fences` slot that Fence reads.

```items
---
items_schema: vyasa.kg/kg.schema
---
```
