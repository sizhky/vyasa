# The one-slot `context` model — time and branches from a single field

## The idea

Today a fact is a triple: `(subject, relation, object)`.
Add one slot — the **context** the fact is asserted in: `(subject, relation, object, context)`.
That's it. No "time" anywhere.

## Contexts are just nodes with one optional link

A context can declare `after` — the context it follows. That single link is the *only* structure:

- a **chain** of `after` links (d1 ← d2 ← d3 …) is a timeline
- a **fork** (two contexts both `after` d3) is a branch / what-if
- **no** `after` (unordered labels) is a set of perspectives

So you never build a time engine. You build a small graph *of contexts*, and time is just the
shape "one long chain."

## Projection = pick a leaf + resolve

To read the graph: pick one context as the **leaf**, walk its `after` chain back to the root, and
for each `(subject, relation)` take the value from the **latest context in that chain** that asserts it
(latest-wins). Everything outside that chain is invisible.

| pick leaf… | you get |
|---|---|
| `d3` | the world as of day 3 (time / as-of) |
| `d5` | today (newest leaf on the main chain) |
| `wt` | the "what if we'd kept the tree" branch — a different world, same data |

Same field. Same resolver. Different leaf. Time and branching are the *same* operation.

## The one rule you must pin

When two contexts in the selected chain disagree, **the later one wins** (later = further from root).
That single rule is the whole abstraction:

- chain + later-wins → time
- branch + later-wins → scenarios
- unordered + explicit priority → overlays (draft over approved)
- unordered + keep-both → perspectives (Design vs Eng, side by side)

No clock, no fold, no slider, no `as_of` baked into the graph. Just contexts, an `after` link, and
later-wins. See `context_demo.py` for the birdhouse running both a time projection and a branch.
