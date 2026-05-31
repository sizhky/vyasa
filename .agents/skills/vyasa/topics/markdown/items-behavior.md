# Items Behavior

Current `items` view is a React Flow graph.
It supports draggable cards, dependency edges, collapsed group cards, expandable group regions, keyboard fit/unfold controls, and popout.

Collapsed groups are selectable summary nodes for neighbor inspection.
Expanded group regions are background containers, not selectable cards.

Node colors resolve in order:

1. Active `color_by` palette lookup
2. Per-node `color:` attr
3. Nearest colored parent group, only when no color mode is active

Use `default_color_by: <attr>` to boot a graph into a color mode.
If a stored UI preference says no color mode, the renderer should still honor the authored default on first load.

Card state defaults to `Not Done` and `Done`.
KG schema can declare more states with `card_states`; the first state is non-struck active text, and every later state is struck through using `node_color_palettes.card_state`.

Graph layout attrs `graph_x` and `graph_y` are renderer-owned; avoid user guidance unless debugging persistence.

Group-local layout direction is supported with `direction: lr` or `layout_direction: lr` on the group line.
For disconnected child nodes inside that group, the renderer now still honors the group direction instead of collapsing back to a vertical pile.
