# Knowledge Graph Queries

Use the read-only DSL for questions against a KG Pack:

```bash
vyasa kg-query roadmap.kg/kg.schema \
  'nodes at delivery-12 | where status=todo | select id label owner'
```

The command returns JSON with `context` and `rows`.

## Context Rules

- A `.context` file is one complete snapshot.
- Node presence comes only from that context's edges.
- Immutable `kg.nodes` and `kg.attrs` values form the pool; context attrs override them.
- Do not fold earlier contexts, write `op=-`, or put change records in `.context` files.
- Use `default_context` when `nodes` or `facts` omits `at <context>`.
- Use `diff <A> <B>` to calculate changes between resolved snapshots.

```text
@context id=delivery-12 seq=12 label="Delivery review" nodes=delivery-12.code.nodes+delivery-12.nodes
caption="Ready for review"

@attrs
status:
  done: claim-1

@edges
  claim-1 -> JIRA-142 allocates_to
```

List every edge true in that snapshot. Nodes without an edge are absent.

### A Context May Carry Its Own Node Facts

`nodes=` names one node file, or several joined by `+`, in the same format as
`kg.nodes`. The pool loads first, then each file in listed order, and a later
file wins on every key it names. Use it for a fact that changes from one
snapshot to the next: code links, a change record, or prose that no longer
describes the code.

Give generated links their own `*.code.nodes` file. List it with the authored
overlay, such as `nodes=delivery-12.code.nodes+delivery-12.nodes`. The
generator owns the first file. The second holds `changes` and other authored
facts, so regeneration cannot erase them.

A file may list a node flat even when the pool nests it. An empty value never
replaces a known one, so an overlay adds facts and never unparents a node.

The pool still owns identity: a node absent from `kg.nodes` is not created by
an overlay, and presence still comes from the context's edges alone.

## Sources And Stages

```text
nodes [at CONTEXT]
facts [at CONTEXT]
contexts
diff A B

where FIELD=VALUE
join FIELD...
follow RELATION
follow* RELATION
incoming RELATION
incoming* RELATION
with RELATION
without RELATION
select FIELD...
group FIELD
count
countd FIELD
sum FIELD
avg FIELD
rate NUMERATOR DENOMINATOR [SCALE]
sort FIELD [desc]
limit N
paths
explain
```

Separate stages with `|`. Commas mean OR for one `where` field; `_none` checks absence; `~` matches text.
Traversal accepts only relations declared under `@relations`. Chained traversal stages append to one path in stage order.
Add `paths` or `explain` when the answer needs every connecting edge for review.
