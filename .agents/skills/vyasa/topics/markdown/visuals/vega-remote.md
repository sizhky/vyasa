# vega — remote data

A Vega-Lite spec may name a URL instead of embedding rows. The browser fetches
it at render time, so the markdown stays short whatever the data size.

```vega title="Seattle max temperature by month and year" height=260
{
  "data": {"url": "https://cdn.jsdelivr.net/npm/vega-datasets@2/data/seattle-weather.csv"},
  "mark": "rect",
  "encoding": {
    "x": {"field": "date", "timeUnit": "month", "type": "ordinal"},
    "y": {"field": "date", "timeUnit": "year", "type": "ordinal"},
    "color": {"aggregate": "max", "field": "temp_max", "type": "quantitative"}
  }
}
```

Two remote files can be joined in the browser with a `lookup` transform — a
topojson map plus a data table, for example. See `demo/visuals/vega-remote.md`
for working choropleth, linked-brushing, and multi-series examples.

## Constraints

- The fetch happens in the reader's browser, from the reader's IP. Point it only
  at data every reader may request.
- There is no path guard and there cannot be: the browser fetches it under its
  own CORS rules, so the host must send permissive CORS headers.
- A static build copies the spec, not the data. An offline reader sees nothing.
- A projected map or a `concat`/`facet` spec must set its own `width`; only a
  single or layered view gets the container width automatically.

## When to use it

Large public datasets that would bloat the page, or data that genuinely changes.
For numbers you own, keep them in the repository and use `visuals/src.md`.
