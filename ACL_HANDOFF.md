# Vyasa KG — ACL (viewer-mask) Engine + UI Handoff Prompt

Paste this whole file to a fresh LLM as the task brief.

---

## Role & goal

You are extending the **Vyasa knowledge-graph engine** to enforce **access control (ACL)**.
The data layer is already authored; your job is the **generator support, query-engine mask, and
UI lens**. The design is locked — implement it, don't redesign it. Discuss trade-offs only inside
the locked model.

## What Vyasa is (context)

- A KG is a **datom fact-log**: every line is `e=<entity> a=<attribute> v=<value> [c=<context>]`.
  An edge is just a fact whose `v=@ref`. Schema, nodes, attrs, contexts all compile to this.
- A **pack** (authored `.schema/.nodes/.attrs/.context` files) is compiled by a generator into a
  flat `kg.index`. A DSL **query engine** reads the index (`nodes | where … | follow … | diff …`).
- The reference pack is **SIFT** — a 19-day project snapshot (130 nodes, 19 daily contexts).

## File locations

**Engine (Python, stdlib only) — `/Users/yeshwanth/Code/Personal/vyasa/scripts/`**
- `gen_kg_index.py` — generator: pack dir → `kg.index`. Parses `@`-sections.
- `kg_query.py` — query engine: `Index` (parse, `fold`, `nodes`), `run()` (the DSL stages).

**UI / renderer (NOT yet read — read these first) — `/Users/yeshwanth/Code/Personal/vyasa/`**
- `core.py`, `main.py`, `extensions_builtin/tasks/static/tasks.js` — the served visualizer and the
  **View** dropdown (lenses). Find where `@views` are rendered; the ACL lens hangs off the same place.

**SIFT pack — `/Users/yeshwanth/Code/Divami/sift-tech/snapshot/sift.kg/`**
- `kg.schema` — has the `@acl` block (classes, role grants, person→role). **Authored, inert.**
- `kg.attrs` — has the multi-label `cls:` block (each node tagged 1–3 classes).
- `kg.nodes`, `day01.context … day19.context`, `kg.index` (generated, 3184 facts).
- `sift.md` — pack README.

Run after any pack edit:
```bash
PY=/Users/yeshwanth/.venv/bin/python
$PY scripts/gen_kg_index.py <pack-dir> <pack-dir>/kg.index
$PY scripts/kg_query.py <pack-dir>/kg.index '<pipeline>'
```

## The ACL model (locked)

- **Default-deny.** An untagged fact is visible to no one. Every context should carry a blanket
  default class so the common case isn't hand-tagged. (SIFT tags per-node instead, for now.)
- **Classes & grants are themselves facts** (no parallel ACL system):
  ```
  e=cls_eng   a=kind     v=acl_class
  e=role_lead a=can_see  v=@cls_internal
  e=role_lead a=can_see  v=@cls_eng
  e=Rajesh Illuri a=role v=@role_lead
  ```
- **Multi-label**: a node may carry several `cls` facts (e.g. `d_brd` = eng + internal + external).
- **Visibility predicate**: viewer sees a fact iff `closure(can_see(viewer)) ∩ cls(fact) ≠ ∅`.
  `closure` = transitive over `can_see` edges (role hierarchy falls out for free).
- **Mask is applied FIRST** — filter the fact-set to the viewer's visible subset *before* any
  `fold`/`follow`/`incoming`/`diff`. Filtering last leaks: traversal already crossed the boundary.
  Masking first makes invisible facts non-existent for the query → traversal cannot leak.

### Roles in SIFT (`@acl` in kg.schema)
`cls_external, cls_internal, cls_eng`. Grants: `cxo`→all; `biz`→external+internal;
`lead`→internal+eng; `dev`→eng; `ext`→external. 12 people mapped to roles by full name.

## What to build

1. **Generator (`gen_kg_index.py`):** parse the `@acl` block → emit facts:
   `e=<class> a=kind v=acl_class`, `e=<role> a=can_see v=@<class>` (one per class),
   `e=<person> a=role v=@<role>`. The block syntax (already authored):
   - `classes=cls_a,cls_b,cls_c`
   - `grant <role> <class> <class> …`
   - `person <Full Name> = <role>`  ← note the ` = ` delimiter (names contain spaces).
2. **Query engine (`kg_query.py`):**
   - Make `cls` fold as a **SET (union)**, not latest-wins scalar — add it to the relation-like
     union path, or special-case it. (Today it collapses to one class — see bugs.)
   - Add a **viewer** parameter to the query/`Index`. Compute `closure(can_see(viewer))`.
   - Apply the **mask** as the first operation: drop every fact whose `cls` set doesn't intersect
     the viewer's visible classes. A fact with no `cls` → denied (default-deny).
   - Verify no leak: as `role_ext`, `follow`/`incoming`/`diff` must never surface an
     internal/eng fact, even transitively.
3. **UI:** add a **"View as <role/person>"** entry to the existing **View** dropdown (same surface
   as State / Open Items / Persona). On select → set viewer → re-render the masked graph.
   Hidden nodes/edges are **silently omitted** (default-deny; no tombstone in consumption views).
   A flat dropdown entry is enough — no nested menu needed.

## Acceptance checks

- `role_dev` (Satya) sees only `cls_eng` nodes; no decisions/questions.
- `role_ext` (Rajeev) sees only the 22 `cls_external` nodes; provenance traversal from an external
  node never reaches an internal/eng fact.
- `role_cxo` sees everything (3184 facts).
- `d_brd` is visible to cxo, lead (via eng+internal), biz (internal+external), dev (eng), ext (external).

## Bugs / gaps encountered (real, verified)

1. **`cls` folds to one value.** `fold` treats non-relation attrs as scalar latest-wins, so a
   multi-class node collapses. Verified: `nodes | where id=d_brd | select cls` → `cls_eng` only,
   though `facts | where a=cls | where e=d_brd` → all 3. **The mask must read raw `cls` facts.**
2. **Entity key in fold record is `id`, not `e`.** `nodes | where e=<id>` returns 0 rows.
   Use `where id=<id>`. (`e` only exists on the raw `facts`/`diff` streams.)
3. **DSL filters tokenize on whitespace.** `where owner=Rajesh Illuri` parses `Illuri` as a stray
   token → 0 rows. No quoting support. Use `~` (contains): `where owner~Rajesh`. This is why the
   `@acl` person syntax uses ` = ` as an explicit delimiter — preserve that when parsing.
4. **`@acl` is currently inert.** The generator skips unknown `@`-sections, so the authored block
   compiles to nothing yet. Safe, but step 1 above is what activates it.
5. **Raw `diff` is noisy** (~92 changed facts between adjacent days). Not an ACL bug, but any
   per-viewer "what changed for me" view must filter by attribute (`stage`/`status`) after masking.
6. **Sandbox quirk:** a leading `cd` in a shell command triggers a noisy directory listing in tool
   output. Use absolute paths / shell vars instead.

## History note

A prior runbook/workflow modelling experiment on this pack was **reverted** (it mixed prescriptive
Layer-3 knowledge into the observed-state pool and was partly fabricated). It still exists in commit
`2096014 "add snapshots"` in the `sift-tech` repo if you need to see what was tried. Do not
reintroduce it; the pool is observed-state only.
