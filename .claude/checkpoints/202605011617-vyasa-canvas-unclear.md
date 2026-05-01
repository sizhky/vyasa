# Checkpoint: Vyasa Canvas Unclear

## Context

Yeshwanth explored adding a canvas/workspace concept to Vyasa after liking Kanwas' freeform alignment workflow.

Core desire changed from "connect Vyasa docs to Kanwas" to "bring canvas-like collaborative thinking into Vyasa."

## Current Understanding

Vyasa is fundamentally read-first: markdown filesystem docs, rendered pages, sidebar tree, slides, annotations.

Canvas idea is edit-first: spatial board, movable cards, sections as blocks, possible writeback to markdown.

This creates product tension:

- simple canvas around docs = maybe useful for synthesis
- full canvas with editing = starts becoming Notion / workspace editor
- multi-user consistency was raised, then explicitly deferred

## Spike Done

I added a small route-only toy spike:

- `vyasa/core.py`: `/canvas/{path:path}`
- `demo/canvas-demo.md`

Behavior:

- renders a markdown doc inside draggable/resizable card
- shows static lanes: Questions / Decisions / Risks

Yeshwanth could not see canvas clearly and then shifted toward lift/shifting from Kanwas.

## Kanwas Inspection

Kanwas has real canvas infrastructure:

- ReactFlow canvas components under `/Users/yeshwanth/Code/Personal/tmp/kanwas/frontend/src/components/canvas`
- Yjs/shared model under `shared/src`
- workspace/editor manager under `frontend/src/components/kanwas`

Conclusion: not simple lift-and-shift into Vyasa server-rendered pages.

Reasonable port path:

- borrow Kanwas interaction model
- avoid Kanwas auth/workspace/Yjs/backend at first
- create Vyasa-native canvas route with ReactFlow island
- doc cards reference Vyasa docs/sections

## Product Direction Emerging

Yeshwanth proposed:

- dedicated homepage like Kanwas Canvas
- left sidebar shows full Vyasa file tree
- drag documents into canvas
- drag document sections into canvas
- sections behave like Notion blocks
- edit blocks in canvas and save back to original markdown
- create fresh documents from canvas

This is effectively "Vyasa Studio", not just "Canvas."

Hardest unsolved problem:

- stable markdown block identity for writeback
- likely needs explicit heading IDs such as `## Architecture {#arch}`

## Open Decision

Do not build further until product boundary is clearer.

Potential next questions:

- Is Vyasa still primarily a read-only docs renderer?
- Is Studio a separate mode?
- Are edits allowed by default or only explicit "promote/writeback"?
- Should section cards require stable heading IDs?

## Working Tree

Uncommitted files from spike:

- modified `vyasa/core.py`
- added `demo/canvas-demo.md`

Consider reverting these if abandoning toy spike.
