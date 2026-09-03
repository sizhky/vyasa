---
title: vega
---

# vega

Vega-Lite specs. A separate extension, not a registry entry: it takes a whole grammar rather than rows.

Fences: `vega`, `vegalite`, `vega-lite`. Options: `title`, `height`, `actions`, `src`.

## A plain bar, for comparison

This is the same data as the first chart on [[demo/visuals/bar|bar]]. The row grammar does it in four lines; Vega-Lite needs a spec and a runtime.

```vega title="Commits per month" height=220
{
  "data": {"values": [
    {"month": "Dec", "commits": 60}, {"month": "Jan", "commits": 66},
    {"month": "Feb", "commits": 155}, {"month": "Mar", "commits": 42},
    {"month": "Apr", "commits": 88}, {"month": "May", "commits": 165},
    {"month": "Jun", "commits": 190}, {"month": "Jul", "commits": 139},
    {"month": "Aug", "commits": 93}
  ]},
  "mark": {"type": "bar", "cornerRadiusEnd": 3},
  "height": 180,
  "encoding": {
    "x": {"field": "month", "type": "ordinal", "sort": null, "title": null},
    "y": {"field": "commits", "type": "quantitative", "title": "commits"}
  }
}
```

Prefer [[demo/visuals/bar|bar]] for this. It needs no browser runtime and no network.

## Where Vega-Lite earns its cost

Two independent y axes — something the row grammar cannot express at all.

```vega title="Commit volume against convention rate" height=280
{
  "data": {"values": [
    {"month": "Dec", "commits": 60, "rate": 77},
    {"month": "Jan", "commits": 66, "rate": 95},
    {"month": "Feb", "commits": 155, "rate": 0},
    {"month": "Mar", "commits": 42, "rate": 17},
    {"month": "Apr", "commits": 88, "rate": 1},
    {"month": "May", "commits": 165, "rate": 12},
    {"month": "Jun", "commits": 190, "rate": 13},
    {"month": "Jul", "commits": 139, "rate": 22},
    {"month": "Aug", "commits": 93, "rate": 60}
  ]},
  "height": 230,
  "encoding": {"x": {"field": "month", "type": "ordinal", "sort": null, "title": null}},
  "layer": [
    {
      "mark": {"type": "bar", "opacity": 0.45},
      "encoding": {"y": {"field": "commits", "type": "quantitative", "title": "commits"}}
    },
    {
      "mark": {"type": "line", "point": true, "color": "#d3a75c", "strokeWidth": 2},
      "encoding": {"y": {"field": "rate", "type": "quantitative", "title": "convention %"}}
    }
  ],
  "resolve": {"scale": {"y": "independent"}}
}
```

The bars are volume; the amber line is discipline. February is the month where one peaks and the other hits zero.

## `src` for a spec on disk

````
```vega title="Saved spec" src="interactive-scatter.json"
```
````

Same path guard as [[demo/visuals/src|src]]: relative to the document, under the content
root. A worked example is on [[demo/visuals/vega-remote|vega-remote]].

## Size and placement

Charts fill their column and sit centred. A spec that sizes itself — a
projection, an `hconcat`, a `repeat` — is centred too, rather than hanging off
the left margin.

Set `width` when a chart should be narrower than the column:

`width` takes any plain CSS length, so a chart can be sized against the browser
window rather than the column:

```vega title="55% of the viewport width" width=55vw height=200
{
  "data": {"values": [
    {"m": "Dec", "n": 60}, {"m": "Jan", "n": 66}, {"m": "Feb", "n": 155},
    {"m": "Mar", "n": 42}, {"m": "Apr", "n": 88}, {"m": "May", "n": 165}
  ]},
  "mark": {"type": "bar", "cornerRadiusEnd": 3},
  "height": 150,
  "encoding": {
    "x": {"field": "m", "type": "ordinal", "sort": null, "title": null},
    "y": {"field": "n", "type": "quantitative", "title": null}
  }
}
```

The same chart at a third of the viewport:

```vega title="33vw" width=33vw height=200
{
  "data": {"values": [
    {"m": "Dec", "n": 60}, {"m": "Jan", "n": 66}, {"m": "Feb", "n": 155},
    {"m": "Mar", "n": 42}, {"m": "Apr", "n": 88}, {"m": "May", "n": 165}
  ]},
  "mark": {"type": "bar", "cornerRadiusEnd": 3},
  "height": 150,
  "encoding": {
    "x": {"field": "m", "type": "ordinal", "sort": null, "title": null},
    "y": {"field": "n", "type": "quantitative", "title": null}
  }
}
```

`vw`, `vh`, `%`, `px`, `rem`, `em` and `ch` are accepted; a bare number means
pixels. A value with any other unit, or anything that is not a number and a
unit, is dropped — the string reaches a `style` attribute, so the filter is
strict rather than escaped.

A width is capped at the column, so `width=90vw` inside a narrow column will not
force the page to scroll sideways. It is also floored at 24rem, so a small width
never collapses into an unreadable sliver — the floor reacts to the column the
chart is in rather than to the size of the window.

No `!important` is used anywhere in the chart stylesheet, so a `width=` you
write always wins.

Set `width` in the spec itself
(as the map on [[demo/visuals/vega-remote|vega-remote]] does) when the chart
needs fixed pixels — a projection cannot be fluid.

## Theming

Colours, fonts and axis styling come from the page theme, not the spec. Do not set them in the spec — the chart re-renders when the reader flips light or dark, and hardcoded colours fight it. Set `mark`, `encoding` and layout only.

The amber line above is the exception worth making: it marks one series apart from the default palette on purpose.

## Trade-off

Vega-Lite needs a browser and a module from a CDN, so it renders nothing in a plain markdown reader and costs a runtime download. Reach for [[demo/visuals/bar|bar]] or [[demo/visuals/stack|stack]] first.

Next: [[demo/visuals/vega-remote|vega-remote]] pulls its data over the network instead of embedding it.
