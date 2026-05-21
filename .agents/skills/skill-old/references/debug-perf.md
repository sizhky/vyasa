# Vyasa Debug Perf

Use this when touching `trace_span`, `traced`, request timing, benchmark output, or `vyasa/extensions_builtin/debug_perf`.

## Shape

- `debug_perf` is a built-in extension module, not kernel behavior.
- Kernel code may emit named spans through `vyasa.runtime_context.trace_span`.
- The extension owns collection, formatting, storage, routes, headers, and reports.
- Keep disabled/no-handler overhead tiny; normal rendering should only pay a cheap no-op span cost.

## Span Names

Keep these baseline names stable unless the task explicitly changes the contract:

- `extension_plan`
- `content_resolve`
- `tree`
- `markdown`
- `toc`
- `layout`
- `sidebar`
- `assets`
- `total`

## Intended Use

Example future `.vyasa`:

```toml
[extensions]
routes_add = ["debug_perf"]

[debug_perf]
enabled = true
mode = "header"
```

Hypothetical result:

```text
X-Vyasa-Perf: total=42.1ms; markdown=18.7ms; sidebar=9.8ms; layout=6.1ms
```

For deeper diagnosis, prefer a debug route or JSON endpoint owned by `debug_perf`, such as `/debug/perf/latest`.

## Rules

- Do not put collection/reporting logic in `core.py`.
- Do not make feature modules import `debug_perf`.
- Feature modules should emit spans around meaningful work and stay ignorant of subscribers.
- If adding output, test the extension behavior, not internal stopwatch details.
- If comparing branches, write results to docs or logs; do not optimize before measuring.
