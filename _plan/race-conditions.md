# Vyasa Race Conditions

Vyasa is not rendering a page in one atomic step. It is letting the browser interleave head initialization, framework CSS, local CSS, HTML paint, HTMX swaps, and later diagram rendering. A race condition appears when two of those steps both have the right to change the UI, but the visible result depends on which one finishes last. The important point is that these are usually not "bad code" bugs; they are ordering bugs. Once you see the page as a sequence of competing arrivals instead of a single render, the failures become easier to explain.

## Why This Happens In Vyasa
Vyasa deliberately layers multiple systems: theme setup in [head-init.js](../vyasa/static/head-init.js), framework headers in [core.py](../vyasa/core.py), local overrides in [header.css](../vyasa/static/header.css), navigation swaps in [scripts.js](../vyasa/static/scripts.js), and asynchronous layout changes from Mermaid and D2. Each layer solves a real problem, but each layer also arrives on its own schedule. If a visual property is inherited instead of explicitly pinned, the browser may briefly or intermittently choose the wrong winner. That is why intermittent refresh bugs can be real even when every individual file looks reasonable in isolation.

## The Race We Just Fixed
The faded-refresh bug was not a whole-page theme failure because paragraph text stayed readable while headings and sidebar labels washed out. That told us the race lived in the selector stack for those specific surfaces, not in global page tokens. On some reloads, framework or sidebar-related selectors were effectively winning before Vyasa's intended heading and sidebar colors settled. The fix in [header.css](../vyasa/static/header.css) was genuine because it removed ambiguity: headings and sidebar text now explicitly use `var(--vyasa-ink)` instead of depending on inherited color from surrounding components.

## Other Races That Still Exist
| Race | Why it exists | Why these and nothing else? |
|---|---|---|
| Theme bootstrap vs later theme state | The initial `.dark` class is decided before paint, but later user interaction and persisted storage can still mutate that state path. | Theme is the root token switch, so any disagreement here affects every derived color. |
| Framework CSS vs Vyasa CSS | Framework headers load before local overrides, and some components still inherit color or spacing instead of setting it directly. | CSS cascade bugs only matter where a property is left open to inheritance or selector competition. |
| Hash scroll vs async layout | The browser jumps to `#anchor` before Mermaid, D2, or swapped content finish resizing the document. | Scroll position is computed from layout, so any later layout change can invalidate an earlier jump. |
| HTMX swap vs client re-init | HTMX replaces DOM first; only after that do helper functions re-bind menus, TOC state, search behavior, and diagram hooks. | Swapped content is inert until the second phase runs, so this is a structural two-step process. |
| TOC highlight vs final heading positions | TOC active state reads heading geometry, but heading geometry changes after async render and expansion. | Geometry-based state is only trustworthy after the document has largely stopped moving. |

## Open Questions
1. Should Vyasa continue relying on framework inheritance for presentation-heavy surfaces, or should critical surfaces always pin color and font explicitly?
   Options: keep inheritance for flexibility, or standardize explicit tokens for headings, nav, sidebars, and controls.
   Blocker: explicit pinning reduces surprises but also reduces theme composability.
2. Should hash navigation become a first-class lifecycle with a single "layout settled" hook instead of repeated retries in [scripts.js](../vyasa/static/scripts.js)?
   Options: keep retries, or define a post-layout event that Mermaid/D2/HTMX all feed into.
   Blocker: Vyasa currently has multiple independent async layout producers, not one central renderer.

## The General Lesson
The browser does not experience Vyasa as "render markdown, then done." It experiences Vyasa as a stream of arrivals competing to define the same page. The safest pattern is to set critical tokens before paint, make important surfaces explicit instead of inherited, and rerun position-dependent logic only after async layout work has finished.
