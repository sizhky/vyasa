# altair

Python that builds a Vega-Lite spec, rather than the spec itself. Use it when a
figure in the chart is derivable: state the formula, and the numbers cannot go
stale when a constant changes.

Fences: `altair`, `vega-altair`, and `altair-data` for shared code.
Options: `title`, `width`, `height`, `actions`, `src`. Sizing and theming match
`visuals/vega.md` — `chart.to_dict()` is a Vega-Lite spec, so both fences share
one renderer and one theme.

Needs the extra: `pip install 'vyasa[altair]'`. Python 3.12 or newer.

```altair title="Recency multiplier by post age" height=240
HALF_LIFE_HOURS = 72.0
FLOOR = 0.05

rows = []
for age in [1, 3, 7, 13, 30, 90]:
    rows.append({"age": age, "recency": max(2 ** (-age * 24 / HALF_LIFE_HOURS), FLOOR)})

alt.Chart(alt.Data(values=rows)).mark_line(point=True).encode(
    x=alt.X("age:Q", title="Post age (days)"),
    y=alt.Y("recency:Q", title="Recency multiplier"),
)
```

`alt` and `math` are already bound. The last expression must be the chart.

## Sharing one derivation between charts

Two charts that read the same numbers should state them once. Name a block with
`altair-data id=`, then point each chart at it with `src=`:

````markdown
```altair-data id=recency
HALF_LIFE_HOURS = 72.0
rows = [...]
curve = alt.Chart(alt.Data(values=rows))
ratio = alt.Chart(alt.Data(values=ratios))
```

```altair title="Decay" height=240 src=recency
curve.mark_line(point=True).encode(x="age:Q", y="recency:Q")
```
````

The named block runs first, in the same sandbox, under the same guard as the
body. `src=` splits on the suffix: `src=recency` is a block in this document,
`src=recency.py` is a file beside it, under the path guard of `visuals/src.md`.

A named block is collected before any chart renders, so a chart may sit above
the block it uses. Add `hide` to keep the code out of the page. Prefer leaving
it visible: in a design document the derivation is the argument, and a hidden
block puts the reader back to reading numbers with no provenance.

## What the body may do

The body runs in-process under `safepyrun`, with an AST pass in front of it.
Refused: every import except `math` and `altair`, all `from` imports, `def`,
`class`, `lambda`, generator expressions, dunder names, `open`, `eval`, `exec`,
`getattr`, `globals`, `vars`, and reads of the filesystem. List comprehensions
and `for` loops are allowed, so a derived curve is still one loop.

## Trade-off

This executes Python from a markdown file at render time. `safepyrun` states of
itself that in-process sandboxing does not hold against a determined adversary,
and the guard here is the same: it stops accidents and casual mischief in files
you wrote. Do not enable the extra on a host that renders markdown from
repositories you do not control — `vyasa-fetch` pulls remote ones.

## When to use it

A figure the document can derive: a decay curve, a threshold, a ratio, anything
computed from constants that ship in the code. For numbers you simply have, keep
them in a file and use `visuals/src.md`; for a hand-written grammar, use
`visuals/vega.md`.

A refused body, a body that ends in something other than a chart, or a missing
`src=` block each render an error card naming the cause.
