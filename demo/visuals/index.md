---
code_root: ../..
code_extensions: [py, js, ts]
---
# Visuals

The registry contains one demo page for each visual.

| demo | what it shows |
| --- | --- |
| [[card]] | stat tiles with one large number each |
| [[bar]] | horizontal bars for one series and each scaling option |
| [[stack]] | one bar split into shares of a whole |
| [[src]] | rows loaded from a JSON, YAML, or CSV file |
| [[vega]] | inline Vega-Lite specs |
| [[vega-remote]] | Vega-Lite charts with remote data |
| [[errors]] | malformed blocks and their errors |
| [[adding-a-visual]] | adding an entry to the registry |

The registry is in [this file](vyasa/extensions_builtin/visuals/registry.py). Each visual has a registry entry and a renderer.

Charts use fenced blocks instead of hand-written inline CSS.

## Shared grammar

All visuals use the same body format:

- One row per line.
- Cells separated by `|`.
- Whitespace trimmed.
- Trailing `@flag` tokens set the row tone: `@accent`, `@muted`, `@good`, `@warn`.
- Lines starting with `#` are comments.
- Options go in the fence info string, not the body.

Shared options: `title`, `note`, `src`, `select`, `label_key`, `value_key`.

```bar title="Example" total=sum
card | 1
bar | 1 @accent
stack | 1
```

[[demo/repo-archaeology|repo-archaeology]] uses these fences for its numeric visuals.