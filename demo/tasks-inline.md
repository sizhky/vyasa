# Inline Tasks Demo

This page shows task graph inside normal markdown, including task groups.

```tasks
group G-FE "Frontend"
  graph_x: 240
  graph_y: -168
  graph_w: 1284
  graph_h: 628
  collapsed: 1
  task T-001 "Map current behavior"
    estimate: 1d
    owner: Alice
    graph_x: 24
    graph_y: 24
  task T-002 "Build inline tasks fence"
    estimate: 2d
    owner: Alice
    depends_on: [T-001]
    graph_x: 312
    graph_y: 144
end

group G-BE "Backend"
  graph_x: 912
  graph_y: -552
  graph_w: 924
  graph_h: 412
  collapsed: 0
  task T-003 "Hook graph persistence"
    estimate: 2d
    owner: Bob
    depends_on: [G-FE, T-002]
    graph_x: 24
    graph_y: 24
  task T-004 "Write API endpoints"
    estimate: 1d
    owner: Bob
    graph_x: 408
    graph_y: 168
    depends_on: [T-003, G-FE, T-002, T-001]
end

task T-005 "Smoke test in browser"
  estimate: 1d
  owner: Alice
  depends_on: [T-003, T-004]
  graph_x: 1704
  graph_y: -120
```

Click the **▲** button on a group to collapse it. Click **▶ N** to expand.
Drag cards, connect nodes, delete edges, and edit a task without leaving this page.
