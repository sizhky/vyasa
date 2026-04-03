---
title: Presentations with Vyasa
slides: true
---

## Slides Start from the Document

What are slides, really, except docs wearing a cleaner shirt and trying to make eye contact before the meeting dies. Vyasa does not ask you to write a second deck. It takes the same markdown you already use for reading view and lets you enter a calmer presentation mode from the **Present** button.

The reading page stays the source of truth. The slide page is only another way to walk through the same document.

## The Split is Natural

Every `##` heading starts a new horizontal slide. Moving right means moving to the next major section, which is where your talk was going before somebody opened a sidebar argument about process.

### Vertical Slides Come from Deeper Headings

Every `###`, `####`, and deeper heading becomes a downward move under the current `##` section. This keeps detail attached to its parent instead of flattening the whole deck into one long confession of poor planning.

## Every Slide Has a Real URL

Each slide lives at its own path, such as `/slides/demo/vyasa-slides/slide-3`. That makes refresh, copy-link, and “open in another tab” behave like normal pages instead of a brittle little state machine held together by optimism.

### Present from Here

In doc view, headings expose a **Present from here** action. Vyasa uses the current heading to find the matching slide URL and opens the deck at that point.

## Navigation Stays Lightweight

Slide-to-slide movement uses the same HTMX-style page swapping Vyasa already uses for normal document navigation. Left and right arrow keys work, and mobile swipe follows the same left-right model, because even doomscroll-trained thumbs deserve a little consistency.

There are no transitions, overview screens, or deck-specific themes here. This mode is intentionally closer to focused reading than to presentation software trying to distract everyone from the content with ceremonial smoke.

## The Theme is the Document Theme

The slide page reuses the normal document shell, so fonts, background, theme preset, and `custom.css` come from the same place as reading view. If the doc theme changes, the slide page inherits that change on refresh, which is how it should work in a system that has known suffering and chosen not to add more.

### The Escape Hatches are Obvious

Breadcrumbs at the top, the underlined title, and the **Back to doc view** link all return to the normal document page with sidebars intact.

## Long Sections Still Read Like Pages

Vyasa does not trap long content inside a tiny slide viewport. If a section is tall, the page scrolls like a normal document page, because squeezing a table into a postage stamp is not a feature, it is an act of hostility.

That means code samples, tables, tabs, diagrams, and dense prose do not need to be mutilated just to fit a fixed canvas.
