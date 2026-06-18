# Lite Inline Items Graphs

Use this when graph is small enough to live comfortably inside fenced `items` or `tasks` block and does not need sidecars. For larger or converted graphs, use KG Pack sidecars from `items-graphs.md`.

## Fence Shape

````markdown
```tasks
---
title: Sprint Slice
default_open_depth: -1
default_color_by: status
width: 80vw
height: 70vh
node-card-width: 36rem
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
  - T-001 :: Design | owner: Alice | status: "On Track"
  - T-002 :: Build | owner: Alice | spec: [UI](guide#ui)
API:
  - T-010 :: Contract | owner: Bob
  - T-003 :: Backend | owner: Bob | color: "#fca5a5"
T-001 ->|unblocks| T-002, T-010
T-002, T-010 -> T-003
```
````

## Frontmatter

- Frontmatter is optional YAML at the top of the fence.
- Supported renderer keys include `title`, `default_open_depth`, `default_color_by`, `default_projection`, `base_view_label`, `width`, `min_height`, `height`, `node-card-width`, `hover-font-size`, `color_by`, `color_palette_source`, `filter_attributes`, `filter_whitelist`, `filter_blacklist`, `hover_attrs`, `view_projections`, `edge_color_by`, `edge_color_palette`, `edge_label_from`, and `items_schema`.
- Size keys should use full CSS lengths such as `760px`, `70vh`, `80vw`, or `calc(85vh - 57px)`.
- Do not use bare numbers like `height: 760`.
- `default_open_depth` is an integer: `0` folds all groups, `1` opens root groups, larger values open deeper levels, `-1` opens all groups.
- Preferred colors use nested palettes under `color_by`.
- Legacy inline `color_by: status` plus `color_palette:` remains backward-compatible.
- By default, all categorical attrs appear in checkbox filters.
- `filter_whitelist` keeps only named attrs; `filter_blacklist` removes named attrs and wins if both are present.
- `hover_attrs` sets attr order shown in hover/details summaries.

## Projection Views

```yaml
default_projection: city
view_projections:
  - id: city
    label: City View
    groups_from: city
    default_color_by: city
  - id: theme
    label: Theme View
    groups_from: [theme, city]
    caption: "Food and temples, then where they live."
    default_color_by: theme
    hover_attrs: [city, owner, status]
    edge_label_from: relation
```

- `groups_from` accepts one attr or a list for nested groups.
- `default_projection` picks the initial projection tab; invalid ids fall back to the base view.
- `base_view_label` renames the authored non-projection tab. Omit it and UI uses `Default`.
- Projection groups are synthesized from item attrs.

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

## Attrs And Links

- Inline attrs follow `|`, as in `| owner: Alice | estimate: 1d`.
- Labels and attr values may contain normal markdown links.
- Attr values may contain escaped newlines inside quoted JSON strings.
- Use `href: <target>` when the whole group or item label should navigate.
- Use `color: "#hex"` for a per-node color override.

## Edges

- Valid shapes: `a -> b`, `a, b -> c`, `a -> b, c`, `a ->|label| b`, and chained edges like `m-1 -> m-2 -> m-3`.
- Chained edges expand into consecutive dependencies.
- Edge labels are optional.
- When `edge_color_by` is active and an edge has no explicit `|label|`, renderer falls back to the edge attr for that color key.
- Keep edge lines outside groups unless existing parser behavior proves indentation is supported.

## Quoting

- Quote complex ids, labels, attrs, or edge labels as JSON strings.
- Use quotes for commas, pipes, brackets, or embedded newlines.

```md
"task-id" :: "Line one\nLine two with \"quotes\" and [brackets]"
```

## Persistence

- Persisted edits rewrite the fenced block source in the markdown file.
- Renderer-owned attrs such as `graph_x`, `graph_y`, `collapsed`, `pill_x`, and `pill_y` may appear after interaction.
- Treat renderer-owned attrs as implementation details, not authoring API.
