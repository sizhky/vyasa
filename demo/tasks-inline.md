# Inline Tasks Demo

This page shows task graph inside normal markdown.

```tasks
task T-001 "Map current behavior"
  estimate: 1d
  graph_x: 360
  graph_y: 264

task T-002 "Build inline tasks fence"
  depends_on: [T-001]
  graph_x: 624
  graph_y: 48

task T-003 "Hook graph persistence"
  graph_x: 888
  graph_y: 192
  depends_on: [T-002]

task T-004 "Smoke test in browser"
  depends_on: [T-003, T-002]
  graph_x: 1176
  graph_y: -120
```

You can drag cards, connect nodes, delete edges, and edit a task without leaving this page.
