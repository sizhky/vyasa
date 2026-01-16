# Markdown Writing Features

Bloggy extends Markdown with a few quality-of-life features for long-form writing.

## Sidenotes (footnotes)

Standard `[^ref]` footnotes render as sidenotes on desktop and expandable notes on smaller screens.

## Task lists

Use `- [ ]` and `- [x]` for task items. Bloggy styles them with custom checkboxes and aligns the label text.

## YouTube embeds

```markdown
[yt:VIDEO_ID]
[yt:VIDEO_ID|Caption]
```

## Tabbed content

```markdown
:::tabs
::tab{title="One"}
Content for tab one.
::
::tab{title="Two"}
Content for tab two.
::
:::
```

## Inline formatting

- Superscript: `^sup^`
- Subscript: `~sub~`
- Strikethrough: `~~strike~~`
- Pandoc-style inline attributes: `` `code`{.class #id key=value} ``

## Relative links and assets

Relative links like `[Next](../chapter.md)` resolve to `/posts/...` and keep HTMX navigation. Images and other assets can live alongside markdown files and will be served from `/posts/{path}.{ext}`.

## Mermaid diagrams

See [Mermaid Diagrams](mermaid.md) for diagram syntax, sizing frontmatter, and interactive controls.

## Content Writing Features

### Footnotes as Sidenotes
`[^1]` references compile into margin sidenotes on desktop (xl breakpoint: 1280px+) and touch-friendly expandables on smaller screens, powered by the `sidenote.css` stylesheet. On desktop, clicking a footnote reference highlights the corresponding sidenote with a temporary border animation. On mobile, clicking toggles the visibility with smooth fade-in/out. Continue to define footnotes with the standard `[^label]: ...` syntax—the renderer keeps the footnote text close to the reference and gracefully handles missing definitions with helpful placeholders. Sidenotes have amber/blue borders (light/dark) and appear in the right margin with proper spacing.

### Task Lists & YouTube Embeds
Checklists begin with `- [ ]` (open) or `- [x]` (done) and render as custom styled items with inline flex layout. Checked items display a green background with SVG checkmark, while unchecked items show a gray background. No bullet points are shown (`list-style: none`), and the checkbox is aligned to the start of the text. Embeds are just as easy: `[yt:VIDEO_ID]` or `[yt:VIDEO_ID|Caption]` drops in a responsive YouTube iframe with aspect-video ratio (16:9), rounded corners, and border. Optional captions appear below in smaller gray text. No extra HTML wrappers required—just use the simple bracket syntax.

### Tabbed Content
Group related snippets with the `:::tabs` container and `::tab{title="Label"}` blocks. Each tab is rendered into a fully interactive panel using `switchTab()` JavaScript function. Tabs feature:
- Clean header with active state (bold border-bottom, darker text)
- Smooth fade-in animation when switching tabs (0.2s ease-in)
- Height stabilization: all panels measured, container set to max height to prevent layout shifts
- Absolute positioning for inactive panels (hidden but measured for height calculation)
- Full markdown rendering support within each tab panel
- Frosted glass aesthetic matching the sidebar design

The client script stabilizes the height on DOMContentLoaded and after HTMX swaps, ensuring smooth transitions without content jumps.


### Relative Links & Asset Helpers
Relative references like `[Next chapter](../chapter-02.md)` automatically resolve to `/posts/...`, strip the `.md` extension, and gain `hx-get`, `hx-target="#main-content"`, `hx-push-url="true"`, and `hx-swap="innerHTML show:window:top"` attributes for seamless HTMX navigation. The renderer uses the current post's path to resolve relative links correctly, handling both `./` and `../` navigation. External links (starting with `http://`, `https://`, `mailto:`, etc.) automatically get `target="_blank"` and `rel="noopener noreferrer"` for security.

Images and other assets can live under the blog tree and are served through `/posts/{path}.{ext}` via the `serve_post_static` route. The `FrankenRenderer.render_image()` method rewrites relative image URLs based on the current post path (using `img_dir` calculated from `current_path`), so folder-specific assets stay tidy and work correctly. Images are styled with `max-w-full h-auto rounded-lg mb-6` classes for responsive display.

### Inline Formatting & Math
Use `^sup^`, `~sub~`, `~~strike~~`, and Pandoc-style `` `code`{.class #id lang=python} `` tokens for fine-grained styling. The preprocessing stage converts `^text^` to `<sup>text</sup>` and `~text~` to `<sub>text</sub>` before markdown parsing (but preserves `~~strikethrough~~`). The `InlineCodeAttr` token (precedence 8) parses backtick code with curly-brace attributes, supporting:
- Classes: `.variable`, `.emphasis`, `.keyword` 
- IDs: `#unique-id`
- Key-value pairs: `lang=python`

These render as `<span>` tags (not `<code>`) when attributes are present, making them perfect for semantic styling without monospace fonts.

KaTeX handles `$inline$` or `$$block$$` math with `renderMathInElement()` configured for both display styles. The bundled script at `bloggy/static/scripts.js` runs the auto-renderer on both `DOMContentLoaded` and `htmx:afterSwap` events, so math keeps rendering correctly even when HTMX swaps fragments or the theme flips. The configuration uses `throwOnError: false` for graceful degradation.
