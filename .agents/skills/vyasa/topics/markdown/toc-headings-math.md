# TOC, Headings, Math

Vyasa supports table of contents generation, custom heading IDs, permalinks, and KaTeX math.

Explicit heading ID shape:

```md
## My Title { #server-sent-events-sse }
```

For heading links, prefer real heading text or explicit IDs already authored.
Do not invent synthetic anchors unless the heading ID is explicitly present.

Headings inside code fences or `:::tabs` blocks are content, not structural boundaries.
