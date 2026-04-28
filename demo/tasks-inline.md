# Inline Tasks Demo

This page shows task graph inside normal markdown, including task groups.

```tasks
group G-FE "Frontend"
  graph_x: 312
  graph_y: -120
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
    graph_x: 288
    graph_y: 120
end

group G-BE "Backend"
  graph_x: 648
  graph_y: -432
  graph_w: 924
  graph_h: 412
  collapsed: 0
  task T-003 "Hook graph persistence"
    estimate: 2d
    owner: Bob
    depends_on: [T-002]
    graph_x: 24
    graph_y: 24
  task T-004 "Write API endpoints"
    estimate: 1d
    owner: Bob
    graph_x: 456
    graph_y: 72
    depends_on: [T-003, T-001]
end

task T-005 "Smoke test in browser"
  estimate: 1d
  owner: Alice
  depends_on: [T-003, T-004]
  graph_x: 1224
  graph_y: -48
```

Click the **▲** button on a group to collapse it. Click **▶ N** to expand.
Drag cards, connect nodes, delete edges, and edit a task without leaving this page.
