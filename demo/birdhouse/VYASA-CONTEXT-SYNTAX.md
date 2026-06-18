# Vyasa Context Syntax — engine handoff

This describes a new vyasa KG model where a graph is split into one append-only identity pool and many
standalone context files. A context is a self-contained snapshot of the graph (a day, a what-if, a
perspective). The renderer shows one context at a time and never reasons about time. The birdhouse pack
at `tmp/birdhouse/birdhouse.kg` is the reference implementation.

## File model

```
kg.schema       root. identity pool + base attrs + palette + context discovery + status defaults + views
kg.nodes        identity pool: "id: label" (+ optional inline immutable summary)
kg.attrs        base attributes, inverted index: kind, owner, dept (things that never change)
kg.palette      colors (JSON payload)
*.context       standalone snapshots, auto-discovered
```

A graph has exactly one pool (`kg.nodes` + `kg.attrs`) and any number of `.context` files in the same
folder.

## `kg.schema`

```
@graph id=birdhouse title=Backyard Birdhouse
pool=kg.nodes
attrs=kg.attrs
palette=kg.palette
contexts=*.context          # glob; auto-discovered; ordered by @context seq
default_context=latest      # which context to show on open (latest = highest seq)
hover_attrs=summary,owner,dept,status

@status_defaults            # status used when a context does not assign one, keyed by kind
entity=active
decision=active
constraint=active
question=open
action=open
deliverable=done

@relations                  # closed verb vocabulary (unchanged from current vyasa)
about
constrains
addresses
produces
reinforces
supersedes
answers

@views                      # lenses applied to whichever context is loaded; no source pinned
state:
	group_by,color_by=status
	caption="Where everything stands"
plate:
	group_by,color_by=owner
	caption="Each owner's work"
mia_todo:
	filter=owner:Mia
	group_by,color_by=status
	caption="One owner's work only"
```

Differences from the current schema:
- `pool=`/`attrs=` replace the `@sources nodes=/attrs=` lines; there is no per-source `edges=` and no
  `base:`/`snap:` source blocks. Edges now live in context files.
- `contexts=` declares a glob for auto-discovery instead of enumerating sources.
- `@status_defaults` is new.
- Views no longer take `source=`. They are lenses over the active context. `filter=key:value` is a new
  per-view filter (used for per-owner todo views).

## `kg.nodes` — identity pool

```
a1: Mia gathers the wood
bh: Backyard Birdhouse
	summary=Three friends build a birdhouse over one week.
```

Append-only. `id: label`, optional indented immutable attrs (e.g. `summary`). Ids never change. Labels
are the current best name; a context may override a label through its `@attrs`.

## `kg.attrs` — base attributes

Standard vyasa inverted index, but only immutable attributes belong here (kind, owner, dept). Anything
that changes between contexts (status) does not go here.

```
@node_attrs
kind:
  action: a1 a2 a3
owner:
  Mia: a1
```

## `.context` — a standalone snapshot

```
@context id=day3 seq=3 label="Wednesday — A change of mind"
caption=|
	One line describing what this snapshot is.

@attrs                      # inverted index, same format as kg.attrs. Inherits kg.attrs as base.
status:                     # list only values that differ from @status_defaults.
  done: a1 a2 a3
  resolved: q2

@edges                      # the edges true in this snapshot. Defines which nodes are present.
	a1 -> bh addresses
	a3 -> d_panels produces
```

- `@context` header: `id`, `seq` (orders contexts; not derived from filename), `label`.
- `caption`: one-line summary; used as the row label in changelog navigation.
- `@attrs`: optional. Overrides or adds attributes for this context. A context with everything at its
  defaults has no `@attrs` block (see `day1.context`).
- `@edges`: the edge set for this snapshot. There is no node list; presence is derived from edges.
- A context may optionally carry its own `palette=` line to override colors.

## Resolution semantics (the engine contract)

1. **Discover.** Glob `contexts=`. Parse each `@context` header. Order by `seq`. Do not sort by
   filename (`day10` must not sort before `day2`).
2. **Lazy-load.** Load `default_context` on open. Load others on demand. Evict contexts not in use to
   bound browser memory. Each context is independent, so eviction is safe.
3. **Presence.** A node appears in a context if and only if an `@edges` line in that context references
   it as a source or target. Nodes wired by no edge are absent (this is how pruning works — a
   superseded node is simply not wired in later contexts).
   - **Discard-on-death-day (tombstone).** A node is not dropped silently. On the *one* context where it
     is discarded, keep it wired by a `supersedes` edge from the node that replaces it, and mark it
     `superseded` in `@attrs`. The reader sees what is leaving and why. From the next context on, omit
     both the node and the edge.
4. **Attribute resolution.** For each present node, start from `kg.attrs` (base), then merge the
   context's `@attrs` over it; the context wins on any key it sets. For `status` specifically, if the
   merged result assigns no status to a node, fall back to `@status_defaults[kind]`.
5. **Render.** Draw the present nodes and the context's edges. Apply the active view's
   `group_by`/`color_by`/`filter`. Nothing else; a context is a plain graph.
6. **Diff.** "What changed between A and B" is computed by the engine as the set difference of nodes,
   edges, and resolved attributes between two loaded contexts. This is the navigation primitive, not a
   property stored in any context.

## Navigation (for thousands of contexts)

Do not present a dropdown or a name search. Navigate by structure and significance:
- **Changelog spine:** list contexts by `seq`, each row showing its `caption`. This is the primary
  navigator.
- **Significance scoring:** score each context by the size of its diff against its predecessor (nodes
  added, superseded, resolved, done). Surface high-score contexts as milestones; collapse runs of
  low-score contexts into an expandable group.
- **Pinning:** `latest` is always pinned. Allow user-pinned landmarks.
- **Content search:** search node/edge content across contexts and jump to the context where a concept
  first appears or changes state.
- **Compare:** select two contexts and show the diff.
- **Branches:** contexts whose `seq` forks (what-ifs) render as a tree off the main spine.

## Deferred / not built

- `same_as` merge resolution (collapsing two ids found to be one concept at read time).
- Branch/what-if context semantics beyond the file format (the engine currently assumes a linear `seq`).
- Storage-layer deduplication of near-identical contexts (acceptable to skip; contexts are small).

## Reference implementation

`tmp/birdhouse/birdhouse.kg`: `kg.nodes`, `kg.attrs`, `kg.schema`, `kg.palette`, and `day1..day5.context`.
The five contexts exercise: status changes (`open`→`done`, `open`→`resolved`), pruning by absence
(`forsparrows` gone from day3, `intree` gone from day4), and a context with no `@attrs` (`day1`).
