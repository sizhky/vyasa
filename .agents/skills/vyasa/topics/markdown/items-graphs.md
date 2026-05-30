# Items Graphs

Default to KG Pack sidecars for new Knowledge Graphs. Use legacy inline syntax only when reading or editing an existing document that already has groups, nodes, edges, and attrs inside the fenced block; see `items-graphs-legacy.md` only for that case.

## Fence

Keep the rendered markdown fence tiny:

```markdown
```items
---
items_schema: roadmap.kg.schema
---
```
```

## Sidecars

```text
roadmap.kg/kg.schema   # metadata, common files, source aliases, purposeful views
roadmap.kg/kg.nodes    # markerless compact node ids, labels, unique inline attrs
roadmap.kg/kg.edges    # base markerless edge set
roadmap.kg/kg.attrs    # shared indexed node/edge attr assignments
roadmap.kg/kg.palette  # node/edge palettes as JSON payload
roadmap.kg/chapter-1.kg.edges  # optional story/topology edge source
```

## Schema

```text
@graph id=roadmap title=Roadmap initial_view=delivery

@sources
nodes=kg.nodes
attrs=kg.attrs
base:
	edges=kg.edges
chapter1:
	edges=chapter-1.kg.edges
chapter2:
	edges=kg.edges
	attrs:
		stage: [Draft, Review]
		owner: [Design, Eng]
palette=kg.palette

@relations
unlocks color=relation.unlocks
blocks color=relation.blocks
explains

@views
delivery:
	source=base
	group_by,color_by=status
	caption="Track delivery state"
owners:
	source=chapter2
	group_by=owner
	color_by=status
	caption="Find ownership gaps"
dependency:
	source=chapter1
	group_by=status
	edge_label_from=relation
	caption="Inspect flow"
```

- `@graph` names the graph and picks `initial_view`; there is no generic `Default` tab.
- Prefer folder packs and point markdown to `items_schema: roadmap.kg/kg.schema`.
- Top-level `nodes=` and `attrs=` in `@sources` are common to every source.
- Source `edges=` can select a story/topology by edge endpoints.
- Source nested `attrs:` selects nodes organically by indexed attr groups. Multiple attr keys are ANDed; listed values inside one key are ORed.
- `base+dep` composes source aliases.
- `@relations` is optional edge-type vocabulary. Use it to document relation ids, attach default presentation such as `color`, and let CLI validation catch typos. Relation label text defaults to the relation id.
- `@views` must have a real purpose through `caption`.
- `group_by,color_by=status` expands to `group_by=status color_by=status`; `X,Y,Z=value` is valid for simple scalar values.
- Projection display controls may live on views: `hover_attrs`, `edge_color_by`, `edge_label_from`, `aggregate_edges`, `default_open_depth`, and spacing/layout keys.

## Nodes

`roadmap.kg.nodes` is markerless because the filename already declares record kind:

```text
n1: Login
	summary=User signs in
n2: Checkout
	description=User pays for cart
n3: Receipt
```

- Preferred format: `<id>: <label>` followed by indented `key=value` lines for unique attrs.
- One-line `<id> <label> key=value ...` remains readable for tiny nodes, but avoid it for long text.
- Prefer compact sequential node ids like `n1`, `n2`, `n3`; labels carry human meaning and compact ids reduce tokens in edges and attr lists.
- Keep unique/descriptive attrs inline here: `summary`, `description`, `notes`, `rationale`.

## Edges

`roadmap.kg.edges` is markerless:

```text
e1: n1 -> n2 unlocks note="Requires auth"
e2: n2 -> n3 creates
```

- Format: `<edge_id>: <source> -> <target> <relation> key=value ...`
- One edge has one primary relation.
- Relation has no leading `:`; write `unlocks`, not `:unlocks`.
- Use another edge for another semantic relation between the same nodes.
- Keep unique edge attrs inline only when UI/CLI can query or display them; otherwise omit dead text attrs.

## Attrs

Use `roadmap.kg.attrs` for shared categorical assignments:

```text
@node_attrs
status:
  todo: n1
  done: n2 n3
owner:
  eng: n1 n2 n3
habit:
  Ask for disagreement: n4

@edge_attrs
confidence:
  high: e1
  medium: e2
```

- Attributes stored in `.kg.nodes` or `.kg.edges` are inline attrs. They are detail/search material, not default filter/group-by dimensions.
- Attributes stored in `.kg.attrs` are indexed/shared attrs. They are default filter/group-by dimensions.
- The rendered model and CLI cache merge both into one logical attr map.
- Prefer `.kg.attrs` when the same key/value applies to many records.
- Attr values before `:` are raw text; do not quote values with spaces unless they contain `:` or newlines.
- Prefer readable block form over long lines when values are descriptive text.
- Derived runtime metrics such as `rank`, `connectivity`, and `centrality` are special metrics, not indexed attrs.

## Runtime Filters And Grouping

- Filter panel defaults to indexed `.kg.attrs` keys.
- Custom `Group by` in the default view builds an ad hoc hierarchy from indexed attrs only.
- Custom grouping opens all generated groups, equivalent to `default_open_depth=-1`.

## Palette

`roadmap.kg.palette` uses JSON payload but the extension intentionally avoids `.json` so humans/LLMs treat it as generated or tooling-owned when appropriate:

```json
{
  "node_color_palettes": {
    "status": {
      "todo": "#f59e0b",
      "done": "#22c55e"
    }
  },
  "edge_color_palettes": {
    "relation": {
      "unlocks": "#2563eb",
      "blocks": "#dc2626"
    }
  }
}
```

## Cache And CLI

- `roadmap.kg.cache` is generated, disposable lookup state. Do not hand edit it.
- LLM tools should query and mutate through the KG CLI/cache instead of reading every sidecar for small changes.
- Core queries: `get`, `neighbors`, `incoming`, `outgoing`, `list_by_attr`, `color_modes`, `filter_policy`, `hover_policy`, `projections`, `projection_groups`, `validate`, `compile`.
- Core mutations: `upsert_record`, `delete_record`, `bulk_set_attr`, `move_node`, `rename_id`, `upsert_edge`, `delete_edge`, palette updates, filter/hover policy updates, projection updates.
- `bulk_set_attr` means one key/value patch applied to a selected set of nodes or edges.

## Compatibility

- KG Pack is the default for new graphs and for converted legacy graphs.
- Backward compatibility is only with original inline `items`/`tasks` markdown syntax.
- Do not use JSONL or the previous compact integer ledger.
- Ticked/checked node state is runtime-local UI state keyed by `document_path` plus `persistence_id`; do not encode transient ticking as normal node attrs unless adding explicit persisted task completion semantics.
