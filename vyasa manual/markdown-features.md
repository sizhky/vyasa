# Writing In Vyasa Markdown

Vyasa renders CommonMark, but the live renderer in [`vyasa/markdown_rendering.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/markdown_rendering.py) also adds a small authoring language around notes, diagrams, tabs, task metadata, and source includes. This guide is about the features that change how a page behaves, not every piece of Markdown syntax you already know. By the end, you should know which features are safe to reach for when a page needs structure, interaction, or a richer reading flow. The rule of thumb is simple: write plain Markdown first, then add Vyasa features only where the reading experience clearly improves.

## The First Layer

```markdown
---
title: Architecture Notes
slides: true
---

Main text with a note.[^1]

> [!tip] Keep callouts in Markdown
> Vyasa preprocesses Obsidian-style callouts before rendering.
```

Frontmatter controls page-level metadata, footnotes become sidenotes on large screens, and callouts are normalized by [`preprocess_callouts()`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/markdown_pipeline.py). If you need hidden depth, use `<details>`; if you need parallel views of the same concept, use `:::tabs`.

Markdown tables now render with a default per-cell max width of `33vw`, which keeps one verbose column from blowing out the whole page. If one table needs a different cap, place `<!-- table max-col=24vw -->` immediately above it.

## Homepage Previews

Vyasa uses `<!-- more -->` as the homepage preview cut. The homepage feed renders only the content above that marker, while the normal post route strips the marker and still renders the full article. If a post does not include the marker, the homepage preview falls back to the first five blank-line-separated blocks.

## Features Worth Remembering

| Feature | Why you would use it |
|---|---|
| Footnotes and sidenotes | Add side commentary without breaking the main narrative. |
| Task-list metadata | Turn plain checklist items into lightweight status cards. |
| Code includes | Pull live source into docs so examples do not drift. |
| Explicit heading ids | Stabilize anchors when titles change wording. |

## The Escape Hatches Are Obvious

Vyasa supports inline highlights, superscript, subscript, YouTube embeds, KaTeX math, relative links, and code includes without asking you to leave Markdown. The preprocessors in [`vyasa/markdown_pipeline.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/markdown_pipeline.py) protect code fences and math blocks first, so expressive inline syntax does not leak into places where it should stay literal. If you are deciding between raw HTML and a built-in feature, prefer the built-in feature first because it survives theme changes, HTMX swaps, and future renderer cleanup better.

## Fenced Code Blocks

Regular fenced blocks now accept lightweight attrs on the info string, so they can carry the same presentation hints as source includes without leaving Markdown.

```markdown
```python title="loader.py" hl=3,5-7 wrap
from pathlib import Path
print(Path.cwd())
```
```

Use `title="..."` for the small file badge, `hl=...` for highlighted source lines, and `wrap` when horizontal scrolling hurts readability more than line breaks would. Line numbers are on by default; use `nln` on a fence or include to suppress them for one snippet, or `ln` to force them back on when the site default is off. The renderer parses those attrs in [`render_block_code()`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/markdown_rendering.py), then the browser runtime applies syntax highlighting and line wrappers from [`vyasa/static/scripts.js`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/static/scripts.js).
