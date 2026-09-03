# bar

Horizontal bars for comparing rows of one series. The default choice for a chart.

Cells: `label | value`.
Options: shared, plus `total`, `max`, `sort`.

## Scale

Widths are relative to the largest row unless `max=` sets the denominator.
Values print exactly as written, so `1,264` stays `1,264`.

```bar title="Commits touching each file"
tasks.js | 264 @accent
scripts.js | 154
core.py | 141
```

## `total=` adds each row's share

`total=sum` uses the sum of the rows. Use it when the rows partition a whole.

```bar title="Commits by time of day" total=sum
18:00-23:59 | 445 @accent
12:00-17:59 | 310
06:00-11:59 | 170 @muted
```

`total=998` names a fixed whole. Use it when the rows are a selection, not a
partition — the column then does not sum to 100, which is honest.

## `max=100` for a rate

A percentage that is itself the measurement is a value, not a computed share.

```bar title="Subjects following the commit convention" max=100
Jan 2026 | 95 @good
Feb 2026 | 0 @warn
```

A value above `max` is clamped, never allowed to overflow the track.

## `sort=`

`sort=desc` or `sort=asc` orders rows by value. Otherwise document order holds.

## Choosing

Reach for `bar` first. Use `stack` only when the rows are parts of one whole and
the comparison that matters is share, not size.
