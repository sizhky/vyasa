# Misc Markdown

Supported extras include collapsible sections, smart typography, print/PDF page breaks, line blocks, cascading folder CSS, relative links, images, YouTube embeds, and definition lists.

## Images

Markdown images are centered and default to 30% of the browser height. A declared width keeps the natural image height. Add width, height, or both after an inline or reference-style image:

```md
![Architecture](architecture.png){width=480 height=320}
![Architecture][diagram]{width=50%}

[diagram]: architecture.png
```

Bare numbers use pixels. Use a CSS unit for responsive or relative sizing, such as `width=50%` or `height=12rem`.

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
