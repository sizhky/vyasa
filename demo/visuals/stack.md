---
title: stack
---

# stack

One bar split into shares, for parts of a single whole. Length is easier to compare than angle, which is why there is no pie visual.

Cells: `label | value`. Extra option: `total`. Unflagged rows take distinct series tones.

```stack title="Tracked files by directory"
vyasa/ | 255
demo/ | 133
.agents/ | 57
tests + tests_js | 36
docs, root, other | 69
```

````
```stack title="Tracked files by directory"
vyasa/ | 255
demo/ | 133
.agents/ | 57
tests + tests_js | 36
docs, root, other | 69
```
````

## Two segments read best

```stack title="Project lifetime, in days" note="bloggy: 2025-12-11 to 2026-02-04. vyasa: from the rename onward."
bloggy | 56
vyasa | 207
```

## Flags override the series tone

```stack title="Published posts by engagement"
evergreen | 96 @good
some engagement | 260 @accent
zero engagement | 227 @muted
```

## When not to use it

Past about six segments the slices stop being readable. Use [[demo/visuals/bar|bar]] instead — it stays legible at any row count, and `total=sum` still gives you the shares.
