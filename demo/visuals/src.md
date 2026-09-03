---
title: src
---

# src — rows from a file

`src` replaces the fence body. It works on every registry visual.

The path is relative to this document, must stay under the content root, and must end in `.json`, `.yaml`, `.yml`, or `.csv`.

## JSON, with `select`

```bar title="Commits per month" total=sum src="../data/repo-archaeology.json" select="commits_by_month"
```

````
```bar title="Commits per month" total=sum src="../data/repo-archaeology.json" select="commits_by_month"
```
````

`select` is a dotted path into the file, so one file can hold several series. The same file feeds the next two charts.

```bar title="Commits by time of day" total=sum src="../data/repo-archaeology.json" select="commits_by_hour_band"
```

```bar title="Commits by weekday" sort=desc total=sum src="../data/repo-archaeology.json" select="commits_by_weekday"
```

## YAML

```stack title="Tracked files by directory" src="../data/tree.yaml" select="by_directory"
```

````
```stack title="Tracked files by directory" src="../data/tree.yaml" select="by_directory"
```
````

## CSV, naming the columns

A CSV has named columns, so say which two to read.

```bar title="Churn hotspots" total=998 src="../data/hotspots.csv" label_key="file" value_key="commits"
```

````
```bar title="Churn hotspots" total=998 src="../data/hotspots.csv" label_key="file" value_key="commits"
```
````

## Accepted shapes

| shape | example |
| --- | --- |
| mapping | `{"Dec": 60, "Jan": 66}` |
| pairs | `[["Dec", 60], ["Jan", 66]]` |
| objects | `[{"month": "Dec", "commits": 60}]` |
| CSV | a header row, then rows |

For objects and CSV, name the columns with `label_key` and `value_key`. Without them the first two keys are read, in order.

Inline rows and file rows become the same objects, so a renderer never knows which it got.

## When to use it

Use `src` when the numbers are generated, shared between charts, or long enough to bury the prose. Keep a short one-off series inline — a reader should not open a second file to check four numbers.

`src` reads a file from disk. To pull data over the network, that is [[demo/visuals/vega-remote|vega-remote]].
