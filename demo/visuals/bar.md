---
title: bar
---

# bar

Horizontal bars for comparing rows of one series. The default choice for a chart.

Cells: `label | value`. Extra options: `total`, `max`, `sort`.

## Default scale

Widths are relative to the largest row. Values print exactly as written, so `1,264` stays `1,264`.

```bar title="Commits touching each file"
tasks.js | 264 @accent
scripts.js | 154
core.py | 141
pyproject.toml | 127 @muted
```

````
```bar title="Commits touching each file"
tasks.js | 264 @accent
scripts.js | 154
core.py | 141
pyproject.toml | 127 @muted
```
````

## `total=sum` adds each row's share

Use it when the rows partition a whole. The share is computed, so it cannot disagree with the counts.

```bar title="Commits by time of day" total=sum
18:00-23:59 | 445 @accent
12:00-17:59 | 310
06:00-11:59 | 170 @muted
00:00-05:59 | 73 @muted
```

## `total=` a fixed whole

When the rows are a selection rather than a partition, name the whole. The column then does not sum to 100, and that is honest.

```bar title="Share of all 998 commits" total=998 note="Ten files out of 550, so this column sums to well under 100."
tasks.js | 264 @accent
scripts.js | 154
core.py | 141
```

## `max=100` for a rate

A percentage that is itself the measurement is a value, not a computed share.

```bar title="Subjects following the commit convention" max=100
Dec 2025 | 77 @good
Jan 2026 | 95 @good
Feb 2026 | 0 @warn
Mar 2026 | 17
Aug 2026 | 60 @good
```

A value above `max` is clamped rather than allowed to overflow its track.

## `sort=desc`

```bar title="Commits by weekday" sort=desc total=sum
Monday | 97
Tuesday | 166
Wednesday | 162
Thursday | 142
Friday | 202 @accent
Saturday | 90 @muted
Sunday | 139
```

## Non-numeric values

A cell that is not a number draws no bar but still prints. Missing data stays visible instead of reading as zero.

```bar title="Coverage by module"
renderer | 84
visuals | 96 @good
excalidraw | not measured @muted
```

Next: [[demo/visuals/stack|stack]] for parts of one whole, or [[demo/visuals/src|src]] to read these rows from a file.
