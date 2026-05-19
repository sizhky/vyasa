# Items Behavior

Current `items` view is a React Flow graph.
It supports draggable cards, dependency edges, collapsed group cards, expandable group regions, keyboard fit/unfold controls, and popout.

Collapsed groups are selectable summary nodes for neighbor inspection.
Expanded group regions are background containers, not selectable cards.

Node colors resolve in order:

1. Per-node `color:` attr
2. Nearest colored parent group
3. Active `color_by` palette lookup

Graph layout attrs `graph_x` and `graph_y` are renderer-owned; avoid user guidance unless debugging persistence.
