# Items Graphs

Use fenced `tasks` or `items` blocks inside normal markdown pages.
Do not propose separate graph files unless the user asks for legacy compatibility.

## Fence Shape

````markdown
```tasks
---
title: Sprint Slice
default_open_depth: -1
default_color_by: status
width: 80vw
height: 70vh
color_by:
  status:
    "On Track": "#86efac"
    "At Risk": "#fcd34d"
  owner:
    Alice: "#93c5fd"
---
id: sprint-slice
title: Sprint Slice
Frontend:
  - T-001 :: Design | estimate: 1d | owner: Alice | status: "On Track"
  - T-002 :: Build | estimate: 2d | owner: Alice | spec: [UI](guide#ui)
API:
  - T-010 :: Contract | estimate: 1d | owner: Bob
  - T-003 :: Backend | estimate: 3d | owner: Bob | color: "#fca5a5"
T-001 ->|unblocks| T-002, T-010
T-002, T-010 -> T-003
```
````

## Frontmatter

- Frontmatter is optional YAML at the top of the fence.
- Supported renderer keys include `title`, `default_open_depth`, `default_color_by`, `width`, `min_height`, `height`, `color_by`, `edge_color_palette`, and `color_palette_source`.
- Size keys should use full CSS lengths such as `760px`, `70vh`, `80vw`, or `calc(85vh - 57px)`.
- Do not use bare numbers like `height: 760`.
- `default_open_depth` is an integer: `0` folds all groups, `1` opens root groups, larger values open deeper levels, `-1` opens all groups.
- Preferred colors use nested palettes under `color_by`.
- Use `default_color_by: <attr>` when a graph should open with that node palette active.
- Only attrs declared under `color_by` appear in the UI color-mode dropdown.
- Shared palette JSON uses `node_color_palettes` and `edge_color_palettes`, loaded with `color_palette_source: path/to/palettes.json`.
- Do not use removed legacy shared keys: `palette_source` or `color_palettes`.
- Legacy inline `color_by: status` plus `color_palette:` remains backward-compatible.

## Shared Palette JSON

Use this when multiple graphs should share the same colors:

```json
{
  "node_color_palettes": {
    "kind": {
      "goal": "#f97316",
      "decision": "#6366f1",
      "milestone": "#06b6d4",
      "requirement": "#84cc16",
      "metric": "#8b5cf6"
    }
  },
  "edge_color_palettes": {
    "relation": {
      "depends_on": "#2563eb",
      "validates": "#84cc16",
      "gates": "#dc2626"
    }
  }
}
```

Then reference it from the graph frontmatter:

```yaml
default_color_by: kind
color_palette_source: .daksh/shared-palettes.json
```

## Body Syntax

```md
id: graph-id
title: Graph Title
Group Label:
  - item-id :: Item Label
  Child Group:
    - child-id :: Child Label | owner: Alice | priority: high
item-a, item-b ->|edge label| item-c
```

- The graph body is terse line syntax, not YAML.
- `id:` and `title:` are graph-level metadata.
- `Group Label:` creates a group.
- Group attrs go before the trailing `:`. Example: `Milestone | direction: lr:`.
- Indentation creates nested groups.
- `- id :: Item Label` creates an item inside the nearest group.
- Direct items are valid when grouping adds no value.
- Do not wrap the whole graph in one fake root group.

## Attrs And Links

- Inline attrs follow `|`, as in `| owner: Alice | estimate: 1d`.
- First-class author attrs include `estimate`, `priority`, `points`, `owner`, and `phase`.
- Labels and attr values may contain normal markdown links.
- Good: `owner: [Alice](team/alice)` or `spec: [API](guide#api)`.
- Use `href: <target>` when the whole group or item label should navigate.
- Good: `- api :: API Contract | href: guide#api`.
- Use normal markdown links when only part of a label or attr value should link.
- Use `color: "#hex"` for a per-node color override.
- Node colors resolve: active `color_by` palette, then per-node `color`, then nearest colored parent group only when no color mode is active.

## Edges

- Use global edge lines for dependencies.
- Valid shapes: `a -> b`, `a, b -> c`, `a -> b, c`, `a ->|label| b`, and chained edges like `m-1 -> m-2 -> m-3`.
- Chained edges expand into consecutive dependencies: `m-1 -> m-2 -> m-3 -> m-4` means `m-1 -> m-2`, `m-2 -> m-3`, and `m-3 -> m-4`.
- Edge labels are optional.
- When `edge_color_by` is active and an edge has no explicit `|label|`, the renderer falls back to the edge attr for that color key, such as `| relation: depends_on` showing `depends_on`.
- Keep edge lines outside groups unless existing parser behavior proves indentation is supported.
- Edge routing is renderer-owned; do not surface handle placement as author syntax.

## Quoting

- Quote complex ids, labels, attrs, or edge labels as JSON strings.
- Use quotes for commas, pipes, brackets, or embedded newlines.
- Example:

```md
"task-id" :: "Line one\nLine two with \"quotes\" and [brackets]"
```

## Persistence

- Persisted edits rewrite the fenced block source in the markdown file.
- Editing clears legacy chain state.
- Renderer-owned attrs such as `graph_x`, `graph_y`, `collapsed`, `pill_x`, and `pill_y` may appear after interaction.
- Treat renderer-owned attrs as implementation details, not authoring API.
