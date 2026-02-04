# Theming & Customization Guide

Use this guide to change **any part** of Vyasa's look and behavior. It covers where to place CSS, how scoping works, which elements to target, and how to change behavior safely.

## 1) Where to put your CSS

Vyasa loads custom CSS in this order (later wins):

1. **Framework CSS** (bundled in the app)
2. **Root CSS**: `custom.css` or `style.css` at your **blog root**
3. **Folder CSS**: `custom.css` or `style.css` inside a folder (scoped to that folder)

Your **blog root** is determined by `VYASA_ROOT` or a `.vyasa` config file. If neither is set, Vyasa uses the current working directory.

### Root-level CSS (site-wide)
Create or edit:

- `/your-blog-root/custom.css` (preferred)
- `/your-blog-root/style.css`

This applies everywhere.

### Folder-level CSS (scoped)
Place a `custom.css` or `style.css` in any content folder to style just that folder (and its subfolders).

Vyasa wraps that CSS inside a scoped selector:

```
#main-content.section-your-folder { ... }
```

This uses **CSS nesting**. Modern browsers support this. You can write normal selectors inside your folder CSS and Vyasa will nest them under the correct section automatically.

## 2) How to find the section scope class

Folder CSS is scoped to the `#main-content` element with a **section class** derived from the path.

Example:

- `demo/books/flat-land/chapter-01.md`
- Section class on `#main-content` becomes: `section-demo-books-flat-land`

To confirm, inspect `#main-content` in your browser DevTools and copy the class.

## 3) DOM map (what you can target)

Use these ids/classes to style specific elements.

### How to find selectors for obscure elements

If an element isn't listed here, you can find its selector quickly:

1. **Use DevTools first**: right‑click the element → *Inspect* → note the `id` or classes on the highlighted node.
2. **Search in source**: open `vyasa/core.py` (live app) and `vyasa/build.py` (static build), then search for the element’s text or a nearby class name.
3. **Search for ids/classes**: in the repo, run a text search for the class or id you saw in DevTools.
4. **Follow the builder**: most markup is created in `layout()` or `navbar()`; those functions assemble the page chrome and are the easiest places to trace where a class or id is set.
5. **Look for generated HTML**: if the element is created from Markdown, check render functions like `render_footnote_ref()` and the tab/mermaid helpers in `core.py`.

### What to do after you find a selector

Once you have the selector (id/class/tag), add a rule in `custom.css` (or a folder `custom.css` if you want section‑only styling), then reload and refine.

Example:

```html
<aside id="posts-sidebar" class="hidden xl:block w-72 ...">
```

```css
/* Root custom.css */
#posts-sidebar {
  background: #f3f4f6;
  border-radius: 12px;
  padding: 0.5rem;
}
```

If your rule doesn’t apply:

1. **Increase specificity**: target a deeper element (e.g., `#posts-sidebar ul`)
2. **Add `!important`** to the property being overridden
3. **Check scope**: if you used folder `custom.css`, confirm the page path matches the section

### Page structure

- `#page-container` - outer wrapper for the whole page
- `#site-navbar` - sticky header wrapper
- `#content-with-sidebars` - row containing sidebars + main content
- `#main-content` - the rendered post content
- `#site-footer` - footer wrapper

### Sidebars

- `#posts-sidebar` - left navigation tree
- `#toc-sidebar` - right table of contents
- `#sidebar-scroll-container` - scrollable list container
- `.toc-link` - each TOC link

### Mobile panels

- `#mobile-posts-panel`, `#mobile-toc-panel` - off-canvas panels
- `#mobile-posts-toggle`, `#mobile-toc-toggle` - toggle buttons

### Markdown content

- `h1`…`h6`, `p`, `ul`, `ol`, `blockquote`, `table`, `code`, `pre`, `img`
- `.mermaid-wrapper` and `.mermaid` for Mermaid diagrams
- `.sidenote-ref`, `.sidenote`, `.sidenote.hl` for footnotes
- `.tabs-container`, `.tabs-header`, `.tab-button`, `.tabs-content`, `.tab-panel` for tabs

## 4) Global theming (background, typography, links)

Put this in **root** `custom.css` to define a new global look:

```css
/* Global background + text */
html, body {
  background-color: #f6f3ee !important;
  color: #1f2937 !important;
}

#page-container,
#main-content {
  background-color: transparent;
  color: inherit;
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

h1, h2, h3 {
  letter-spacing: -0.02em;
}

/* Links */
a { color: #0f766e; }
a:hover { color: #115e59; }
```

## 5) Navbar and footer

The navbar is the **first child** inside `#site-navbar` and the footer content is inside `#site-footer > div`.

```css
#site-navbar > div {
  background-color: #0f766e !important;
  color: #f8fafc !important;
}

#site-footer > div {
  background-color: #1f2937 !important;
  color: #f8fafc !important;
}

#site-navbar a,
#site-footer a {
  color: #f8fafc;
}

#site-navbar a:hover,
#site-footer a:hover {
  color: #e2e8f0;
}

.dark #site-navbar > div { background-color: #0b3b3a !important; }
.dark #site-footer > div { background-color: #111827 !important; }
```

## 6) Sidebars and TOC

```css
/* Left posts sidebar */
#posts-sidebar {
  background: #f3f4f6;
  border-radius: 12px;
  padding: 0.5rem;
}

/* TOC sidebar */
#toc-sidebar {
  background: #f8fafc;
  border-radius: 12px;
  padding: 0.5rem;
}

/* TOC links */
.toc-link {
  color: #0f172a !important;
  border-radius: 8px;
}
.toc-link:hover {
  background: rgba(15, 118, 110, 0.12);
  color: #0f766e !important;
}
```

## 7) Code blocks and inline code

```css
pre {
  background: #0b1020;
  color: #e2e8f0;
  border-radius: 12px;
  padding: 1rem 1.25rem;
}

code {
  background: rgba(15, 118, 110, 0.12);
  color: #0f766e;
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
}

pre code {
  background: transparent;
  color: inherit;
  padding: 0;
}
```

## 8) Mermaid diagrams

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

## 9) Footnotes / sidenotes

```css
.sidenote-ref {
  font-size: 0.8rem;
  padding: 0 0.2rem;
  border-radius: 0.25rem;
}

.sidenote {
  font-size: 0.95rem;
  color: #334155;
}

.sidenote.hl {
  background-color: rgba(15, 118, 110, 0.12);
}
```

## 10) Tabs

Tabs are styled by built-in CSS, but you can override:

```css
.tabs-container {
  border-radius: 14px;
  border-color: #cbd5f5;
}

.tab-button.active {
  border-bottom-color: #0f766e;
  color: #0f766e;
}

.tabs-content {
  background: #ffffff;
}
```

## 11) Images and media

```css
img {
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

figure > img {
  width: 100%;
  height: auto;
}
```

## 12) Change behavior (JS + HTML)

For behavior changes (animations, interactions, logic), you have two options:

### Option A: Custom JS
Edit:

- `vyasa/static/scripts.js` for live app
- `vyasa/build.py` (static build) if you need it in static exports

### Option B: Inline HTML/JS in Markdown
If you need per-post behavior, you can embed raw HTML in markdown:

```html
<div id="my-widget"></div>
<script>
  // Your custom behavior here
</script>
```

## 13) Advanced: change the HTML structure

If you want to move elements or change layout, edit these functions:

- `vyasa/core.py::navbar()` for the header markup
- `vyasa/core.py::layout()` for page structure and sidebars
- `vyasa/build.py::static_layout()` for static builds

## 14) Troubleshooting

If your styles don't apply:

1. **Check your root**: Is `custom.css` in the actual blog root?
2. **Check if CSS is loaded**: View page source and confirm `/posts/custom.css` is present.
3. **HTMX swaps**: Folder-scoped CSS is injected into `#scoped-css-container` and swapped during navigation. If your styles disappear, ensure `custom.css` exists in that folder.
4. **Utility class conflicts**: Use more specific selectors or `!important` to override Tailwind-style classes.

---

You now have full control of Vyasa's look and behavior. Start global, then layer scoped CSS for sections, then override specific elements by id/class as needed.
