# Misc Markdown

Supported extras include collapsible sections, smart typography, print/PDF page breaks, line blocks, cascading folder CSS, relative links, images, YouTube embeds, and definition lists.

## Tooltips

Use a named tooltip when a short phrase needs one or more explanation paragraphs:

```md
[hybrid search][?hybrid-search]

[?hybrid-search]:
    First explanation paragraph with **Markdown**.

    Second explanation paragraph.
```

Indent tooltip content by four spaces. Tooltip definitions are document-scoped and work in posts and slides.

For long-form writing where one thematic break is too light, use two back-to-back `---` lines.
Vyasa renders doubled rules distinctly from a single rule.

For normal author links inside item graphs, prefer markdown links in labels or attrs:

```md
owner: [Alice](team/alice)
spec: [API](guide#api)
```

When the whole item or group should navigate, use `href:`:

```md
- api :: API Contract | href: guide#api
Milestone | href: roadmap#milestone:
```
