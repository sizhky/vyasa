# Items Graphs

Use fenced `tasks` or `items` blocks inside normal markdown pages.
Do not propose separate graph files unless the user asks for legacy compatibility.

## Fence Shape

````markdown
```tasks
---
title: Sprint Slice
default_open_depth: -1
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
- Supported renderer keys include `title`, `default_open_depth`, `width`, `min_height`, `height`, and `color_by`.
- Size keys should use full CSS lengths such as `760px`, `70vh`, `80vw`, or `calc(85vh - 57px)`.
- Do not use bare numbers like `height: 760`.
- `default_open_depth` is an integer: `0` folds all groups, `1` opens root groups, larger values open deeper levels, `-1` opens all groups.
- Preferred colors use nested palettes under `color_by`.
- Only attrs declared under `color_by` appear in the UI color-mode dropdown.
- Legacy `color_by: status` plus `color_palette:` remains backward-compatible.

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
- Indentation creates nested groups.
- `- id :: Item Label` creates an item inside the nearest group.
- Direct items are valid when grouping adds no value.
- Do not wrap the whole graph in one fake root group.

## Attrs And Links

- Inline attrs follow `|`, as in `| owner: Alice | estimate: 1d`.
- First-class author attrs include `estimate`, `priority`, `points`, `owner`, and `phase`.
- Labels and attr values may contain normal markdown links.
- Good: `owner: [Alice](team/alice)` or `spec: [API](guide#api)`.
- Do not invent a special `href:` attr.
- Use `color: "#hex"` for a per-node color override.
- Node colors resolve: per-node `color`, nearest colored parent group, then active `color_by` palette lookup.

## Edges

- Use global edge lines for dependencies.
- Valid shapes: `a -> b`, `a, b -> c`, `a -> b, c`, and `a ->|label| b`.
- Edge labels are optional.
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
