# card

Stat tiles. One big number each, for figures a reader should carry away.

Cells: `value | label | note`.
Options: shared, plus `columns`.

```card columns=3
998 | commits
142 | days with a commit
7.0 | commits per active day @accent
```

A third cell becomes a note under the label:

```card columns=2
264 | tasks.js touches | 26.5% of all commits
63 | test touches | the test moves when the source moves
```

`columns` fixes the grid width. Omit it and tiles fit themselves to the page.
