# Content Styling Examples

Content styling surfaces include code blocks, Mermaid diagrams, sidenotes, footnotes, tabs, and folder-scoped highlight classes.

For code block colors, use CSS variables:

```css
:root {
  --vyasa-code-bg: #111827;
  --vyasa-code-text: #e5e7eb;
}
```

Use existing `--vyasa-code-*` variables instead of rewriting code block DOM.
For custom callouts, style `[data-callout="type"]` in `custom.css`.
