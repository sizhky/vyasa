# Grouped Tasks Demo
This page is a small grouped task graph fixture for future Vyasa task rendering.
It favors nested groups, cross-group dependencies, and a little fan-out without becoming noisy.

```tasks
id: hybrid-task-demo
title: Hybrid Task Rendering
groups:
    - id: foundation
      label: Foundation
    - id: model
      label: Data Model
      parent_group_id: foundation
    - id: api
      label: API
      parent_group_id: foundation
    - id: ui
      label: UI
    - id: canvas
      label: Canvas
      parent_group_id: ui
    - id: interactions
      label: Interactions
      parent_group_id: ui
tasks:
    - id: t1
      label: Define graph payload
      group_id: model
    - id: t2
      label: Add group nesting rules
      group_id: model
      depends_on: [t1]
    - id: t3
      label: Serialize frozen anchors
      group_id: model
      depends_on: [t1]
    - id: t4
      label: Expose GET block endpoint
      group_id: api
      depends_on: [t2]
    - id: t5
      label: Expose PUT coordinate endpoint
      group_id: api
      depends_on: [t3]
    - id: t6
      label: Build layout engine
      group_id: canvas
      depends_on: [t2, t3]
    - id: t7
      label: Project normalized coordinates
      group_id: canvas
      depends_on: [t6]
    - id: t8
      label: Render collapsed group pills
      group_id: interactions
      depends_on: [t7]
    - id: t9
      label: Reveal children on zoom
      group_id: interactions
      depends_on: [t7, t8]
    - id: t10
      label: Persist manual drag moves
      group_id: interactions
      depends_on: [t5, t9]
```
