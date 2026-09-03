# src — rows from a file

`src=` replaces the fence body. Works on every registry visual.

```bar title="Commits per month" total=sum src="data/commits.json" select="by_month"
```

## Rules

- The path is relative to the document.
- It must stay under the content root. A path that escapes it is refused.
- It must end in `.json`, `.yaml`, `.yml`, or `.csv`.
- `select` is a dotted path into the file, so one file can hold several series.

## Accepted shapes

| shape | example |
| --- | --- |
| mapping | `{"Dec": 60, "Jan": 66}` |
| pairs | `[["Dec", 60], ["Jan", 66]]` |
| objects | `[{"month": "Dec", "commits": 60}]` |
| CSV | a header row, then rows |

For objects and CSV, name the columns with `label_key` and `value_key`. Without
them the first two keys are used, in order.

Inline rows and file rows become the same objects, so a renderer never knows
which it got, and both render identically.

## When to use it

Use `src` when the numbers are generated, shared between charts, or long enough
to bury the prose. Keep short one-off series inline — a reader should not have
to open a second file to check four numbers.
