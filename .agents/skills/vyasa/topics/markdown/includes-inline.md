# Includes And Inline Syntax

Markdown includes can render source snippets and named sections.
Inside code-include syntax, `.md` is valid source input.

## Code Includes

```md
{ ./guide.md ln[1:80] }
{ ./guide.md#part }
```

The first renders native markdown for the line range.
The second renders the named section.

Rules:

- Use `.md` sources when the included content should render as markdown.
- Use anchors for named sections.
- Use line ranges when the exact snippet matters.
- Keep source paths relative to the current markdown file unless an existing example proves another convention.

## Inline Code Class

```md
`highlighted`{.highlight}
```

Renders as a span with class `highlight`.
Useful with folder-level `custom.css`.

## YouTube

```md
[yt:dQw4w9WgXcQ|Optional caption]
```

Renders as a responsive embedded video player.

## Other Inline Features

Inline extensions include footnotes, sidenotes, abbreviations, keyboard shortcuts, citations, and inline code classes when supported.
Check existing parser behavior before adding another inline form.
