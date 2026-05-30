---
title: AI Capabilities and Limitations
---

> [!note]
> This story treats an LLM like a machine with four load-bearing properties, not a magic coworker. Read the arc first, then flip projections to see the same machine by failure mode, mitigation, and human response.

Generative AI starts as a next-token machine, gets shaped into an assistant by fine-tuning, and then meets the world through four stable constraints: what pattern is likely, what was in training, what still fits in context, and how far instructions can actually steer behavior. Most practical AI literacy is just learning where those constraints become visible, and changing your habits before the machine's fluent surface fools you.

```items
---
title: "AI Capabilities and Limitations"
default_open_depth: -1
width: 96vw
min_height: 80vh
node-card-width: 34rem
default_color_by: chapter
hover_attrs: [chapter, role, property, failure_family, mitigation_family, habit]
edge_color_by: relation
edge_label_from: relation
aggregate_edges:
  when_collapsed: true
  by: relation
items_schema: ai-capabilities-and-limitations.kg.schema
---
```

The graph is dense on purpose. A sparse story lies about AI by hiding the joints. The machine is useful exactly because the same mechanism keeps reappearing under different names: prediction becomes fluency, prediction also becomes fabrication; training becomes politeness, training also becomes sycophancy; more context helps, until more context buries the instruction that mattered.

If you want to read it as practice instead of theory, start in `Human Moves`, then jump to `Failure Map`. That path turns the whole course into one habit loop: identify the property, name the collision, choose the matching mitigation, and only then decide how much trust the output earned.
