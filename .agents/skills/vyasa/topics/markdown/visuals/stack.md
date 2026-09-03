# stack

One horizontal bar split into shares, for parts of a single whole.

Cells: `label | value`.
Options: shared, plus `total`.

```stack title="Tracked files by directory"
vyasa/ | 255
demo/ | 133
.agents/ | 57
tests + tests_js | 36
docs, root, other | 69
```

Shares are computed from the sum unless `total=` names the whole.
Unflagged rows take distinct series tones; a `@flag` overrides its row's tone.

There is no pie visual on purpose: length is easier to compare than angle.

Use `bar` instead when the rows do not sum to a meaningful whole, or when there
are more than about six of them — thin segments stop being readable.
