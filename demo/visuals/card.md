---
title: card
---

# card

Stat tiles. One big number each, for the figures a reader should carry away.

Cells: `value | label | note`. Extra option: `columns`.

```card columns=4
998 | commits
142 | active days
7.0 | per active day @accent
550 | tracked files
```

````
```card columns=4
998 | commits
142 | active days
7.0 | per active day @accent
550 | tracked files
```
````

## A third cell becomes a note

```card columns=2
264 | tasks.js touches | 26.5% of all commits — the repository's one real hotspot
63 | test touches | the matching test file moves when the source moves
```

## Tones

`@accent`, `@good` and `@warn` change the left rule. Use one to mark the figure that carries the argument, not every tile.

```card columns=4
95% | Jan 2026 @good
0% | Feb 2026 @warn
60% | Aug 2026 @good
24.7% | whole history @muted
```

## Without `columns`

Tiles fit themselves to the page width. Prefer this unless a fixed grid matters.

```card
109 | checkpoint commits
0 | after the rename @warn
```

See [[demo/visuals/bar|bar]] when the numbers should be compared rather than read.
