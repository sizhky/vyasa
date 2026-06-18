---
name: story-telling-with-graphs
description: "Use Vyasa `items` graphs or knowledge-graphs plus seeded prose to tell strong stories in any domain by turning entities, events, states, and relationships into explorable narrative maps."
metadata:
  version: "0.2.1"
---

# Story Telling With Graphs

This is `doc-narrator` with an explorable structure.

Use this when the user wants a graph that does more than classify things. The graph should carry a narrative arc: sequence, contrast, tension, dependency, return, reveal.

## Core Idea

- Story before schema.
- Prose before graph.
- One authored item set, one complete big projection by default.
- Relationships, transitions, causality, and movement are usually edges, not nodes.
- Nodes are durable things the reader can inspect: people, teams, places, systems, states, decisions, artifacts, events, constraints, scenes, milestones, or evidence.
- The graph should feel like a map of meaning, not a bag of colored boxes.

## The Two Laws (non-negotiable)

Everything else is taste. These two are not. A graph that breaks them reads as a "bag of boxes" no matter how good the content is.

### Law 1 — The Sentence Law

**Any `source · edge · target` must read aloud as a clear, grammatical sentence.**

- **Nodes are noun phrases.** `optional-adjective + head-noun`. Good: `helpful assistant`, `fake citation`, `trained knowledge`, `working memory`. Bad: `refuses too broadly`, `lost in the middle`, `verify specifics` (those are verbs/clauses hiding in node slots).
- **Edges are transitive verb phrases**, prepositions baked in. Good: `produces`, `enables`, `can cause`, `reduces`, `becomes`, `shapes`. Bad: relation *categories* that aren't sentences — `fails-as`, `has-risk`, `mitigated-by`, `collides-with`.
- This is **Lego snugness**: pick any two nodes and any edge at random; the result must be *syntactically* legible even when it is semantically false. `helpful assistant is checked by fake citation` is fine grammar (and a useful slot to fill or reject); `helpful assistant has-risk fake citation` is broken.
- The test is mechanical: **read the edge aloud.** If it isn't a sentence, rename the node or the verb first.

### Law 2 — The Direction Law

**Edges flow upstream → downstream: cause/earlier → effect/later.** The arrow points the way the story moves.

- Source is the node that comes **first** (the cause, the input, the prior step). Target is what it leads to.
- **Causal/temporal precedence defines upstream**, even when it fights "what gets introduced first" on the page. Training data precedes the model; the model precedes the assistant; a fix precedes the reduced failure.
- **No backward edges.** If a relation only reads naturally in the passive (`X is shaped by Y`, `X requires Y`, `X mitigated-by Y`), it is pointing backward. Flip source/target and rewrite it active: `Y shapes X`, `Y reduces X`.
- Passive voice is the one thing that lets grammar-direction and story-direction drift apart. Banning it collapses both laws into one axis: **the grammatical subject is always the upstream cause.**

## Verb Vocabulary (suggestions only)

The verb is **not decoration, it is the claim.** Pick it from the relationship's type, evidential strength, and time horizon. For timeless/system stories, a small canonical set is enough. For meeting, decision, and operating-history graphs, prefer tense-aware phrases that show whether the graph observed something already happening, established evidence, or committed to a future move.

| Role | Verb | Use when source… |
|---|---|---|
| Transformation | `becomes` | turns into the target (same thing, new form) |
| Creation | `produces` | brings a new, distinct thing into existence |
| Enablement | `enables` | makes a capability or outcome possible |
| Modulation | `shapes` | adjusts/influences the target without creating it |
| Risk | `can cause` | can lead to a downstream failure or weakness |
| Mitigation | `reduces` | lessens a downstream problem |

Selection rule — take the first yes: same entity new form → `becomes`; new entity → `produces`; capability made possible → `enables`; existing thing adjusted → `shapes`; bad outcome made possible → `can cause`; bad outcome lessened → `reduces`.

For time-bound or evidence-bound stories, translate the same roles into explicit story-faithful phrases:
- **Current state already happening:** `is causing`, `is blocking`, `is delaying`
- **Evidence established in the story:** `has exposed`, `has shaped`, `showed`
- **Committed future move:** `will produce`, `will shape`
- **Intent / expected outcome / prerequisite:** `is meant to reduce`, `is expected to enable`, `is needed to shape`

Do not turn a proposal into a current fact. If a node describes a missing or planned capability, the edge should sound missing, planned, expected, or intended too.

Constraints on any verb you add:
- **Must be active and forward-causal.** This is what makes Law 2 automatic — a forward-causal verb cannot be written backward without going passive.
- **Ban dependency verbs** (`requires`, `depends on`, `is limited by`) — they point at upstream, violating Law 2. Flip them.
- **Ban stative/symmetric verbs** (`resembles`, `relates to`, `collides with`) — no direction.
- **Do not flatten time-bound stories into timeless verbs.** `produces` is weaker than `has produced` or `will produce` when the distinction matters.
- **The verb encodes a modeling claim.** If you cannot pick a verb, you have not yet decided what the edge *means* — that is a modeling gap to resolve, not a synonym to shop for. Two authors picking different verbs for one edge disagree about reality, not English.

## Color Is a Teacher

Color carries the meta-lesson the prose can't repeat on every node. Bind it to the structure, not to decoration:

- Color edges by relation so the **verb families** are visible: e.g. `enables` green (capability), `can cause` red (risk), `reduces` teal (fix). The reader sees the shape of the argument before reading a word.
- Color nodes by a single `kind` attribute (mechanism, property, capability, limitation, fix, failure, …). Reuse the same green/red so a capability node and an `enables` edge agree.
- **The rhyme is the point.** When several property nodes each sprout a green `enables` branch and a red `can cause` branch, the reader absorbs "strength and weakness share one root" without being told. Structural repetition teaches faster than text.

## One Big Arc First

- Default to one base graph that carries **premise → tension → choice → payoff** without requiring view switching.
- A reader should understand the whole story from the first projection. Use grouping, color, convergence, and a clear causal spine to make a larger graph scan well.
- Do not create chapter projections merely to reduce node count. Multiple small views fragment the story and force the reader to reconstruct the whole.
- Projections are earned: add one only when the user asks for it or names a genuinely different question the base graph cannot answer clearly.
- Never invent a projection taxonomy on the user's behalf.
- **Collision / climax pattern:** real failures are usually two upstream limits meeting. Model them as exactly two `can cause` edges converging on one failure node (2 → 1). It is instantly recognizable and points straight at the fix.
- **Convergence / payoff pattern:** end by funneling the spine's roots into one synthesis node (many `enables` into one), then a short tail to the final outcome.

## Load First

1. Read `../markdown/items-graphs.md`.
2. Read `../markdown/items-behavior.md` if the graph will be interactive or edited later.
3. If the user needs a cold-reader document, also read `/Users/yeshwanth/Code/Divami/divami-agents/skills/doc-narrator/SKILL.md` and follow its context-seeding and prose-first rules.

## Workflow

1. **Name the story** in one sentence (the spine). Example: `One engine gives AI both its fluency and its failures.`
2. **Choose node ontology.** Decide what deserves to be inspectable. Keep actions, dependencies, handoffs, transformations, and flows as edges unless the intermediate thing has its own meaningful state.
3. **Write node labels as noun phrases and run the Sentence Law** on every intended edge before committing the vocabulary.
4. **Fix a closed verb set** for the graph (start from the table above). Color those verbs deliberately.
5. **Choose 1–2 node dimensions**, usually a single `kind`, plus optionally `stage`/`time_band`. Resist many overlapping attrs — one structural color beats five.
6. **Write the context seed**: a short note so a cold reader knows what they're looking at and why.
7. **Author one clean `items` body.** Do not duplicate content for alternate views.
8. **Build one complete base projection.** Add another projection only when the user requests or earns it with a distinct reading goal.
9. **Check the lie.** If an edge is pretending to be a node, a node is pretending to be a relation, or an edge points backward — fix it.

## Narrative Patterns

- **Arc:** arrange one causal spine so the story reads in order.
- **Contrast:** project the same nodes under a different organizing principle.
- **Spine:** one causal/temporal thread that explains the whole system.
- **Duality:** one node, two opposite-colored forward edges (`enables` vs `can cause`) — the core device for capability/limitation stories.
- **Return:** feedback loops, incident timelines, learning journeys.
- **Fork:** options, fallbacks, risk pivots as edge kinds, not duplicate text branches.

## Strong Defaults

- `default_open_depth=-1` for story graphs meant to be scanned end-to-end.
- `edge_label_from=label` so verbs render as spoken phrases (`can cause`, not `can-cause`).
- `edge_color_by=relation` to expose verb families.
- `hover_attrs` kept high-signal — usually just `kind`.
- `aggregate_edges` when collapsed groups should still show the big shape.
- `palette=kg.palette` with a shared JSON palette when color meaning must stay consistent.
- Distinguish detail from structure: inline attrs in `kg.nodes` are descriptive/search detail, while indexed attrs in `kg.attrs` drive filtering, grouping, and `color_by`.
- Put repeated narrative dimensions such as `kind` in `kg.attrs`, then give every indexed value an intentional color in `kg.palette`; an indexed story dimension without a palette leaves visual meaning accidental.
- Declare `attrs=kg.attrs` and `palette=kg.palette`, and keep `kg.nodes` canonical as `<id>: <label>`.

## Anti-Patterns

- Do not put verbs, clauses, or actions in node slots (`verify specifics`, `lost in the middle`). Nodes are nouns.
- Do not invent a relation per edge. A sprawling vocabulary (`collides_with`, `fails_as`, `mitigated_by`, `sharpens`, `requires`) is the smell of skipping the Sentence and Direction laws.
- Do not write backward/passive edges. `X is mitigated by Y` → `Y reduces X`.
- Do not lean on notes/tooltips to explain an edge that doesn't read as a sentence — and never use a note field the view won't render.
- Do not split one coherent story into chapter projections by default.
- Do not open with unexplained taxonomy, or let color feel random. Every palette choice teaches.
- Do not dump every attribute into hover cards. Curate to one or two.

## Output Shape

- Start with 1–3 lines of prose that seed the reader.
- Then the `items` block.
- After the graph, add brief reading guidance only if the graph is dense or non-obvious.

## When To Reach For Doc Narrator

Use `doc-narrator` thinking when:

- the audience is cold
- the graph needs surrounding prose, caveats, or open questions
- the story crosses technical and non-technical readers
- the diagram would confuse without a seeded frame

The rule is simple: if the graph cannot stand up for a new reader without a small runway of prose, borrow `doc-narrator` and build the runway first.
