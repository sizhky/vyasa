# vega

Vega-Lite specs. A separate extension, not a registry entry: it takes a whole
grammar rather than rows.

Fences: `vega`, `vegalite`, `vega-lite`.
Options: `title`, `width`, `height`, `actions`, `src`.

Charts fill their column and sit centred, including a spec that sizes itself (a
projection, an `hconcat`, a `repeat`). Use `width` only to make one narrower: it
takes a CSS length — `55vw`, `70%`, `600px`, or a bare number for pixels — capped
at the column and floored at 24rem. Any other value is dropped, because it lands
in a `style` attribute.

```vega title="Commits per month" height=220
{
  "data": {"values": [{"month": "Dec", "commits": 60}, {"month": "Jan", "commits": 66}]},
  "mark": "bar",
  "encoding": {
    "x": {"field": "month", "type": "ordinal", "sort": null},
    "y": {"field": "commits", "type": "quantitative"}
  }
}
```

The body is a JSON spec. `src="chart.json"` loads one from a file instead, under
the same path guard as `visuals/src.md`. When a number in the spec is derivable,
write the derivation instead: see `visuals/altair.md`.

## Trade-off

Vega-Lite needs a browser and a CDN module, so it renders nothing in a plain
markdown reader, and it costs a runtime download.

Reach for `bar` or `stack` first. Use Vega-Lite when the chart is layered,
faceted, has two independent axes, or is interactive — things the row grammar
cannot express.

## Theming

Colours, fonts, and axis styling come from the page theme, not the spec. Do not
set them in the spec: the chart re-renders when the reader flips light or dark,
and hardcoded colours will fight it. Set `mark`, `encoding`, and layout only.

A broken spec renders an error card naming the parse failure.
