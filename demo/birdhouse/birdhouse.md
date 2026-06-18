# Backyard Birdhouse — Living Snapshot

A 5-day toy project: Mia, Leo, and Aria build a birdhouse.

Model: one append-only identity pool (`kg.nodes` + immutable `kg.attrs`), and one standalone
snapshot per context (`day1..day5.context`). Each context owns its own edges and per-node status;
the graph never knows what day it is. Switch contexts to scrub time. See `../CONTEXT-FORMAT.md`.

```items
---
items_schema: birdhouse.kg/kg.schema
---
```
