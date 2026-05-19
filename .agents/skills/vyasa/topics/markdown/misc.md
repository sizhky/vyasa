# Misc Markdown

Supported extras include collapsible sections, smart typography, print/PDF page breaks, line blocks, cascading folder CSS, relative links, images, YouTube embeds, and definition lists.

For long-form writing where one thematic break is too light, use two back-to-back `---` lines.
Vyasa renders doubled rules distinctly from a single rule.

For normal author links inside item graphs, prefer markdown links in labels or attrs:

```md
owner: [Alice](team/alice)
spec: [API](guide#api)
```

Do not invent a special `href:` attr for this.
