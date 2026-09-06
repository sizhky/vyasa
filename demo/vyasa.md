---
title: Vyasa Kernel
code_root: ..
code_extensions: py,js,md
---

# Vyasa Kernel

This is the smallest useful picture of how Vyasa shows a file on screen.

Three views share one set of nodes. **Flow** follows a request from the browser to a rendered page. **Fence** follows one fenced block from Markdown text to the widget on this page. **Extensions** follows startup, where an extension claims the slots that Flow and Fence later read. Select a view with the view switcher, then step through its slides.

The three views connect at one node each. Flow ends when it passes the Markdown body to the renderer, which is where Fence begins. Fence depends on Extensions, because Extensions fills the `markdown_fences` slot that Fence reads.

```items
---
items_schema: vyasa.kg/kg.schema
---
```

## How to read a slide

### Lanes and rows

A lane is a participant that can receive a call. A document and a response are values carried on arrows, so neither has a lane. Rows run from top to bottom, in the order the steps happen.

### Arrowheads

A filled arrowhead marks a synchronous call. The sender waits for the reply, and the reply is drawn as a second line on the same row.

An open arrowhead marks an asynchronous message. No reply is expected, so the row has one line. Flow and Fence each end on one asynchronous message.

### Activation bars

A vertical bar on a lane marks an execution that has not returned yet. The bar opens on the row where the call arrives and closes on the row where the reply leaves. Every row between those two rows runs while that call is still active.

The number at the top of a bar is the step that opened it. The closing reply carries no number, because a reply is not a separate step. Step numbers count exchanges rather than nesting depth, so the bar states what is nested and the number does not.

### Combined fragments

A box drawn around a group of rows is a combined fragment. The tag in the top-left corner of a box names its operator.

- `alt` runs exactly one operand, chosen by its guard. A dashed rule separates the operands.
- `opt` runs its single operand only when the guard holds.
- `loop` repeats the rows it encloses.
- `break` replaces the remainder of the enclosing interaction.
- `ref` refers to an interaction that is defined outside the view.

A guard is written in square brackets. Each guard appears once, on the outermost box that carries it. Flow uses `opt`, `break` and `alt`. Fence uses all five.

### What you can point at

Hover or click a node or an arrow to see the source line it names. Every arrow points at a real line, so a slide that no longer matches the code is a fault in the pack.

Hover or click an activation bar for the two arrows that open and close it.

Hover or click the corner tag of a fragment for its operands. Each operand row pairs its guard with a description of what that branch does in Vyasa. The card also lists the participants the box covers and the steps it spans.

## Why the graph stays small

A view never draws the whole graph. Each view names its own edge file as its source, and a lane appears only when an edge in that source touches it. The source name matters. `source=base` means every edge in the pack, so a view left on `base` gains the next view's lanes as soon as one is added.

That rule is what keeps a view readable as the pack grows: **add views, not lanes.**
