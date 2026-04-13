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

## Features Worth Remembering

| Feature | Why you would use it |
|---|---|
| Footnotes and sidenotes | Add side commentary without breaking the main narrative. |
| Task-list metadata | Turn plain checklist items into lightweight status cards. |
| Code includes | Pull live source into docs so examples do not drift. |
| Explicit heading ids | Stabilize anchors when titles change wording. |

## The Escape Hatches Are Obvious

Vyasa supports inline highlights, superscript, subscript, YouTube embeds, KaTeX math, relative links, and code includes without asking you to leave Markdown. The preprocessors in [`vyasa/markdown_pipeline.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/markdown_pipeline.py) protect code fences and math blocks first, so expressive inline syntax does not leak into places where it should stay literal. If you are deciding between raw HTML and a built-in feature, prefer the built-in feature first because it survives theme changes, HTMX swaps, and future renderer cleanup better.
