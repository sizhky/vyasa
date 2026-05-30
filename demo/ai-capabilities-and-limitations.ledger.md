---
title: AI Capabilities and Limitations
---

> [!note]
> This story treats an LLM like a machine with four load-bearing limits, not a magic coworker. Read the chapter projections in order; each one is intentionally small enough to make one turn in the story visible.

Generative AI starts as a next-token machine, gets shaped into an assistant by fine-tuning, and then meets the world through four stable constraints: what pattern is likely, what was in training, what still fits in context, and how far instructions can actually steer behavior. Most practical AI literacy is just learning where those constraints become visible, and changing your habits before the machine's fluent surface fools you.

```items
---
title: "AI Capabilities and Limitations"
default_open_depth: -1
width: 96vw
min_height: 80vh
node-card-width: 34rem
default_color_by: role
hover_attrs: [chapter, role, property, failure_family, mitigation_family, habit]
edge_color_by: relation
edge_label_from: relation
aggregate_edges:
  when_collapsed: true
  by: relation
items_schema: ai-capabilities-and-limitations.kg.schema
---
```

The projections are chapters, not alternate taxonomies. Each tab keeps fewer than seven nodes on stage so the reader can follow one claim before the next one arrives.

The path is: raw prediction becomes an assistant, the assistant exposes four limits, those limits fail in recognizable ways, and the human loop turns that diagnosis into calibrated trust.
