---
title: errors
---

# Errors are visible, not fatal

A malformed block renders a card that names the problem. A bad chart never takes the page down, and it never fails silently either.

## No rows

```bar title="This block has no rows"
```

## A path outside the content root

```bar src="../../../../etc/passwd.json"
```

## An unknown file type

```bar src="../notes.md"
```

## A file that is not there

```bar src="../data/missing.json"
```

## A `select` path that does not exist

```bar src="../data/repo-archaeology.json" select="by_quarter"
```

## A broken Vega-Lite spec

```vega
{not valid json
```

## Why this way

Three options exist for a bad block: raise, render nothing, or render the error.

Raising takes down a whole page for one typo. Rendering nothing is worse — the author ships a page with a hole in it and never learns. Rendering the error keeps the page readable and puts the message where the person who can fix it will see it.

The same rule holds for data: a `src` file that has moved shows a missing-file card, so the page tells you the chart is stale rather than quietly drawing an empty bar.
