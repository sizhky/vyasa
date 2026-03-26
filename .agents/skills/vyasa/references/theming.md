# Vyasa Theming & CSS

## Where to put CSS

Vyasa loads CSS in this order (later wins):

1. Framework CSS (built-in)
2. `custom.css` or `style.css` at the **blog root** — applies site-wide
3. `custom.css` or `style.css` inside any content **folder** — scoped to that folder and its subfolders

Your blog root is the directory you pass to `vyasa` (or `VYASA_ROOT`).

## Folder-scoped CSS

Folder CSS is automatically wrapped in a scoped selector:

```css
#main-content.section-your-folder { ... }
```

The section class is derived from the folder path with slashes replaced by hyphens. For a post at `docs/api/reference.md`, the scope class is `section-docs-api`.

Write your rules normally inside the file — Vyasa nests them under the correct scope automatically.

## Folder-level `global.css`

If a folder needs page-level styling, use `global.css` in that folder. Vyasa links it as a normal stylesheet, so it can safely style `html`, `body`, navbar/sidebar chrome, and top-level rules like `@font-face` and `@keyframes`.

Rule of thumb:
- `global.css` is for the page
- `custom.css` is for the post

## Narrative/book navigation

Vyasa has built-in previous/next navigation for markdown files with visible sibling markdown files in the same folder.
It follows the folder's effective Vyasa order, not raw filename sort.

Theme it with:

```css
.vyasa-prev-next
.vyasa-prev-link
.vyasa-next-link
```

## DOM selectors

### Page structure

| Selector | Element |
|----------|---------|
| `#page-container` | Outer wrapper |
| `#site-navbar` | Sticky header |
| `#content-with-sidebars` | Row with sidebars + content |
| `#main-content` | Rendered post body |
| `#site-footer` | Footer wrapper |

### Sidebars

| Selector | Element |
|----------|---------|
| `#posts-sidebar` | Left navigation tree |
| `#toc-sidebar` | Right table of contents |
| `#sidebar-scroll-container` | Scrollable list inside sidebar |
| `.toc-link` | Each TOC entry |

### Mobile

| Selector | Element |
|----------|---------|
| `#mobile-posts-panel` | Off-canvas nav panel |
| `#mobile-toc-panel` | Off-canvas TOC panel |
| `#mobile-posts-toggle` | Hamburger nav button |
| `#mobile-toc-toggle` | TOC toggle button |

### Content elements

| Selector | Element |
|----------|---------|
| `h1`–`h6`, `p`, `ul`, `ol`, `blockquote`, `table`, `img` | Standard markdown output |
| `.mermaid-wrapper`, `.mermaid` | Mermaid diagram container |
| `.sidenote-ref` | Footnote superscript link |
| `.sidenote` | Footnote sidenote |
| `.sidenote.hl` | Highlighted (active) sidenote |
| `.tabs-container` | Tab block wrapper |
| `.tabs-header` | Tab button row |
| `.tab-button` | Individual tab button |
| `.tab-button.active` | Active tab button |
| `.tabs-content` | Tab content area |
| `.tab-panel` | Individual tab panel |

## Example: global theme

Place in **root** `custom.css`:

```css
/* Background and text */
html, body {
  background-color: #f6f3ee !important;
  color: #1f2937 !important;
}

.dark html, .dark body {
  background-color: #0b0f14 !important;
  color: #e2e8f0 !important;
}

/* Typography */
body {
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  line-height: 1.7;
}

/* Links */
a { color: #0f766e; }
a:hover { color: #115e59; }
```

## Example: navbar and footer

```css
#site-navbar > div {
  background-color: #0f766e !important;
  color: #f8fafc !important;
}

#site-footer > div {
  background-color: #1f2937 !important;
  color: #f8fafc !important;
}

.dark #site-navbar > div { background-color: #0b3b3a !important; }
.dark #site-footer > div { background-color: #111827 !important; }
```

## Example: sidebars

```css
#posts-sidebar {
  background: #f3f4f6;
  border-radius: 12px;
  padding: 0.5rem;
}

#toc-sidebar {
  background: #f8fafc;
  border-radius: 12px;
  padding: 0.5rem;
}

.toc-link { color: #0f172a !important; }
.toc-link:hover {
  background: rgba(15, 118, 110, 0.12);
  color: #0f766e !important;
}
```

## Example: code blocks

```css
:root {
  --vyasa-code-bg: #fafafa;
  --vyasa-code-fg: #1f2937;
  --vyasa-code-border: rgba(31, 41, 55, 0.12);
  --vyasa-code-highlight-bg: rgba(245, 42, 101, 0.12);
  --vyasa-code-highlight-accent: #f52a65;
}
```

Vyasa exposes code block palette variables through CSS, so users can override the built-in theme from root or folder `custom.css` without editing Vyasa itself.

For custom callout styling, target `.vyasa-callout[data-callout="your-type"]`. You can swap the built-in icon by hiding `.vyasa-callout-icon svg` and applying your own SVG/background in `custom.css`.

## Example: Mermaid diagrams

```css
.mermaid-wrapper {
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.dark .mermaid-wrapper {
  background: #0f172a;
  border-color: #1f2937;
}
```

## Example: sidenotes / footnotes

```css
.sidenote-ref {
  font-size: 0.8rem;
  border-radius: 0.25rem;
}

.sidenote { font-size: 0.95rem; color: #334155; }
.sidenote.hl { background-color: rgba(15, 118, 110, 0.12); }
```

## Example: tabs

```css
.tab-button.active {
  border-bottom-color: #0f766e;
  color: #0f766e;
}

.tabs-content { background: #ffffff; }
```

## Example: folder-scoped highlight class

In `docs/custom.css`:

```css
span.highlight {
  background-color: #fff831;
  padding: 0 4px;
  border-radius: 3px;
  font-weight: bold;
}
```

Used in markdown as: `` `word`{.highlight} ``

## Layout width

Controlled by `.vyasa`:

```toml
layout_max_width = "90vw"   # or "1200px", "max-w-7xl"
```

Responsive behavior:
- Below 1280px: full width (configured value ignored)
- 1280–1520px: eases from 100% to configured value
- Above 1520px: configured value fully applied

## Troubleshooting

- **Rule not applying**: Check specificity. Use a more specific selector or `!important`.
- **Folder CSS disappears on navigation**: HTMX swaps the scoped CSS container. Ensure `custom.css` exists in the folder.
- **Can't find selector**: Inspect the element in browser DevTools to get the id/class, then add your rule.

## Responsive breakpoints

| Range | Behavior |
|-------|----------|
| < 768px | Mobile: sidebars hidden, mobile menu shown |
| 768–1279px | Tablet: sidebars visible, no sidenote margins |
| 1280px+ | Desktop: full three-panel layout with sidenotes |
