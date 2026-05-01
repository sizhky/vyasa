# Inline Tasks Demo

This page shows task graph inside normal markdown, including task groups.

```tasks
group P1 "Phase 1"
  graph_x: -216
  graph_y: 48
  group G-FE "Frontend"
    graph_x: 24
    graph_y: -24
    task T-001 "Map current behavior"
      estimate: 1d
      owner: Alice
    task T-002 "Build inline tasks fence"
      estimate: 2d
      owner: Alice
      depends_on: [T-001]
  end
  group G-BE "Backend"
    graph_x: 1184
    graph_y: 24
    task T-003 "Hook graph persistence"
      estimate: 2d
      owner: Bob
      depends_on: [T-002]
    task T-004 "Write API endpoints"
      estimate: 1d
      owner: Bob
      depends_on: [T-003]
  end
end

task T-005 "Smoke test in browser"
  estimate: 1d
  owner: Alice
  depends_on: [T-003, T-004]
  graph_x: 792
  graph_y: 312
```

Click a group to inspect its tasks or child groups in a popover canvas. Press `Esc` or **Back** to return.
Drag cards, connect nodes, delete edges, and edit a task without leaving this page.
