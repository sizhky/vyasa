---
name: items-to-snapshots
description: Turn a stream of events (meeting minutes, updates, decisions) into an accreting vyasa knowledge graph that renders one live snapshot per event. Use when ingesting minutes or any dated stream into a KG, when building per-day/per-context graph snapshots, or when deciding how a node should change as new events arrive.
metadata:
  version: "0.1.0"
---

# Items → Snapshots

Generate a vyasa context-snapshot KG from a stream of events. Each event (a meeting, a day, a what-if)
becomes one standalone context file that shows the project's live state at that point. The graph never
reasons about time; an event log accretes, and each context is a plain snapshot of it.

Reference implementation: `tmp/birdhouse` (5-day toy). Format spec: `tmp/birdhouse/VYASA-CONTEXT-SYNTAX.md`.
Validator: `vyasa/.agents/skills/vyasa/scripts/validate_kg_pack.py`.

## File model

```
kg.schema       root: pool + base attrs + palette + contexts=*.context + @status_defaults + @views
kg.nodes        identity pool: "id: label"  (append-only)
kg.attrs        base attributes, inverted index: kind, owner, dept  (immutable)
kg.palette      colors
*.context       one standalone snapshot per event, auto-discovered, ordered by @context seq
```

The pool and base attrs hold only what never changes. Everything that varies between events (status,
edges, which nodes are present) lives in the context files.

## Pipeline — run once per incoming event

1. **Extract** candidate nodes AND edges from the event's items. An event deposits relationships, not
   just nouns.
2. **Resolve** each candidate against the pool. One of: matched (same concept exists), no-match,
   refined (same concept, sharper wording), split (one concept is really two), merge (two ids are one).
3. **Classify** each matched candidate: touch (re-discussed on its own terms), or supersede (replaced
   or overturned by new information). A candidate that only receives an edge from a new node is the
   new node's touch, not its own.
4. **Mint** new and superseding nodes in the pool — atomic, append-only ids. Record immutable attrs
   (kind, owner, dept) in `kg.attrs`.
5. **Type** every edge with a closed verb that names the genuine relation. Do not use `about` as a
   catch-all when a precise verb fits.
6. **Emit** the context file for this event (see "Writing a context").
7. **Validate** with `validate_kg_pack.py`.

## Node rules

- **Atomic.** One concept per node. No sentence-blobs that repeat their subject. Split a compound node
  ("connect sources, then explain") into separate nodes.
- **Pool is identity only.** An id is a bare, permanent anchor. The label is the current best name, a
  convenience; anything that can change is not part of the node.
- **Splits** mint a new id, forward-only. Never rewrite a past context.
- **Merges** emit a `same_as` equivalence, resolved at read time; both ids survive in history.
- **Renames** update the pool label, or a context overrides it through `@attrs`.

## Edge rules

- Edges draw from a closed verb vocabulary declared in `@relations`. Add a node before adding a verb.
- Keep verbs generic and domain-free. Pick the verb that names the real relation (`depends_on`,
  `supersedes`, `answers`, `produces`, `addresses`), not the weakest one.

## Snapshot rules — what a context contains

A context is the **live state** as of its event: standing decisions and constraints, open work, open
questions, and the deliverables that are the actual output.

- **Presence is edge-reachability.** A node appears in a context if and only if an `@edges` line
  references it. There is no node list. Drop a node from an event by not wiring it.
- **Status defaults by kind** (`@status_defaults`): entity/decision/constraint → active, action/question
  → open, deliverable → done. A context's `@attrs` lists only the nodes whose status differs from the
  default, and inherits `kg.attrs` as base.
- **Terminal nodes tombstone, then prune.** When a node reaches a terminal state — superseded, resolved,
  a done action, a consumed intermediate deliverable — show it on the one context where it dies, wired by
  the verb that closed it (`supersedes`, `answers`) and marked with its terminal status. From the next
  context on, omit both the node and that edge.
- **What persists:** standing decisions/constraints, open questions, open actions, and the final
  deliverable. Scaffolding (done actions, resolved questions, overturned decisions, intermediate outputs)
  does not carry forward. Two adjacent events can share almost no nodes; that is expected.

## Writing a context

```
@context id=day3 seq=3 label="Wednesday — A change of mind"
caption=|
	One line describing this snapshot. Used as the changelog row.

@slides                     # the day's deck; named entries, played top to bottom
pivot: The change of mind
	nodes=forsparrows,forbluebirds
	desc=|
		**Sparrows → bluebirds.** What the switch touches:

		- the sparrow plan is struck through and leaves the board
		- the entrance-hole question reopens
		- earlier bird-size assumptions reset
ripple: The ripple
	nodes=hole15,q2
	desc=|
		The switch **answers** the hole question. This context records it as:

		```
		@attrs
		status:
		  resolved: q2
		@edges
		  hole15 -> q2 answers
		```
piece: First real piece
	nodes=a3,d_panels
	caption="Panels cut — the first physical part exists"

@attrs                      # inverted index, same format as kg.attrs; inherits it as base
status:                     # list ONLY non-default status (done / resolved / superseded)
  done: a3
  resolved: q2
  superseded: forsparrows

@edges                      # the edges true this snapshot; presence follows from them
	forbluebirds -> forsparrows supersedes
	hole15 -> q2 answers
	a3 -> d_panels produces
```

- `seq` orders contexts; it is not derived from the filename.
- A context with everything at its defaults has no `@attrs`.
- A context may carry its own `palette=` to override colors.

Slide entry fields:
- `<key>: <Title>` — `key` is a unique id within the block; `Title` is the slide heading.
- `nodes=id,id,…` — the spotlight set; the engine highlights these and dims the rest of the snapshot.
- `desc=|` — multiline markdown body for the slide (lists, emphasis, links survive).
- `caption="…"` — a one-line body, used instead of `desc` for a short beat.
- Entries play top to bottom; each shifts the spotlight to walk that event's story.

## Views

Views are cross-cutting lenses, constant across all contexts; they apply to whichever context is loaded.
Each answers a recurring question. Keep them few. The reference set:

- `state` — `group_by,color_by=status`. Where everything stands.
- `plate` — `group_by=dept,owner` (team, then person), `color_by=status`. Who is on the hook.
- `open` — `filter=status:open`, `group_by=owner`. Only the open actions and unanswered questions.

A view may multi-group (`group_by=dept,owner` nests outer→inner) and may filter (`filter=key:value`).

## Navigation (many contexts)

Do not present a dropdown or a name search. Navigate by structure: a changelog spine of `caption` rows,
significance scoring that surfaces high-churn contexts as milestones and collapses quiet runs, a pinned
`latest`, content search that jumps to the context where a concept changed, and a compare/diff between
two contexts.

## Validate

```
python3 vyasa/.agents/skills/vyasa/scripts/validate_kg_pack.py <pack>/<root>.md
```

Every edge endpoint and attr id must resolve to a pool node, the schema sources must exist, and the
palette must be valid JSON.
