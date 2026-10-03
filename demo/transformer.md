---
title: Transformer
---

# Transformer

The encoder and decoder from "Attention Is All You Need", drawn as a grid figure.

```items
---
items_schema: transformer.kg/kg.schema
height: 90vh
---
```

Each `point` node is a junction. Residual edges enter Add & Norm through a side port (`target_port=left`), and the three attention inputs enter through ports along the bottom (`target_port=bottom:20`).
