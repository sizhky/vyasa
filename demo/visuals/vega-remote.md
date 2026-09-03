---
title: vega-remote
---

# Charts that pull their data from the internet

A Vega-Lite spec can name a URL instead of embedding rows. The browser fetches it when the page renders, so the markdown stays a few lines no matter how large the data is.

Every chart here reads from `cdn.jsdelivr.net/npm/vega-datasets`, the public dataset bundle the Vega project publishes. Nothing on this page is stored in the repository.

> [!warning] These charts need the network
> They render in a browser with internet access and nothing else. Offline, in a plain markdown reader, or behind a strict content policy, they are blank. For data you control, prefer [[demo/visuals/src|src]] — it reads from disk and always renders.

---

## A weather heatmap — 1,461 rows, four lines of data spec

Seattle, daily, over four years. The CSV is fetched and binned in the browser.

```vega title="Seattle max temperature by month and year" height=260
{
  "data": {
    "url": "https://cdn.jsdelivr.net/npm/vega-datasets@2/data/seattle-weather.csv"
  },
  "mark": "rect",
  "height": 200,
  "encoding": {
    "x": {"field": "date", "timeUnit": "month", "type": "ordinal", "title": null},
    "y": {"field": "date", "timeUnit": "year", "type": "ordinal", "title": null},
    "color": {
      "aggregate": "max",
      "field": "temp_max",
      "type": "quantitative",
      "title": "max °C",
      "scale": {"scheme": "yellowgreenblue", "reverse": true}
    }
  }
}
```

Embedding those rows inline would be roughly 60 KB of markdown. The spec is under 20 lines.

---

## Linked brushing — drag on the left, the right filters

Two views over the same fetched dataset, joined by a selection. This is the class of chart the row grammar cannot reach.

```vega title="Cars: horsepower against mileage, brushed by origin" height=320 actions=true
{
  "data": {
    "url": "https://cdn.jsdelivr.net/npm/vega-datasets@2/data/cars.json"
  },
  "hconcat": [
    {
      "width": 260,
      "height": 260,
      "params": [{"name": "brush", "select": "interval"}],
      "mark": "point",
      "encoding": {
        "x": {"field": "Horsepower", "type": "quantitative"},
        "y": {"field": "Miles_per_Gallon", "type": "quantitative", "title": "MPG"},
        "color": {
          "condition": {"param": "brush", "field": "Origin", "type": "nominal"},
          "value": "#b6c2b7"
        }
      }
    },
    {
      "width": 200,
      "height": 260,
      "transform": [{"filter": {"param": "brush"}}],
      "mark": "bar",
      "encoding": {
        "y": {"field": "Origin", "type": "nominal", "title": null},
        "x": {"aggregate": "count", "title": "cars selected"},
        "color": {"field": "Origin", "type": "nominal", "legend": null}
      }
    }
  ]
}
```

Drag a rectangle over the scatter. The bar chart recounts as you move it. `actions=true` adds the export menu in the corner.

---

## A choropleth — two remote files joined in the browser

A TopoJSON county map and a separate unemployment table, joined by FIPS code with a `lookup` transform. Two fetches, one chart, no build step.

```vega title="US unemployment rate by county" height=380
{
  "width": 620,
  "height": 340,
  "data": {
    "url": "https://cdn.jsdelivr.net/npm/vega-datasets@2/data/us-10m.json",
    "format": {"type": "topojson", "feature": "counties"}
  },
  "transform": [
    {
      "lookup": "id",
      "from": {
        "data": {
          "url": "https://cdn.jsdelivr.net/npm/vega-datasets@2/data/unemployment.tsv"
        },
        "key": "id",
        "fields": ["rate"]
      }
    }
  ],
  "projection": {"type": "albersUsa"},
  "mark": {"type": "geoshape", "stroke": null},
  "encoding": {
    "color": {
      "field": "rate",
      "type": "quantitative",
      "title": "rate",
      "scale": {"scheme": "yellowgreenblue"}
    }
  }
}
```

This one sets a fixed `width` in the spec, because a projection needs real pixels rather than the container's width. It is narrower than the column, so it sits centred with even space either side.

---

## Multi-series time, with a hover readout

Stock closing prices, one line per symbol. Move the cursor across the chart: a
rule follows the nearest date and the tooltip reads every symbol at once.

```vega title="Closing price by symbol" width=90% height=340
{
  "data": {
    "url": "https://cdn.jsdelivr.net/npm/vega-datasets@2/data/stocks.csv"
  },
  "height": 280,
  "encoding": {"x": {"field": "date", "type": "temporal", "title": null}},
  "layer": [
    {
      "encoding": {
        "y": {"field": "price", "type": "quantitative", "title": "close (USD)"},
        "color": {"field": "symbol", "type": "nominal", "title": null}
      },
      "layer": [
        {"mark": {"type": "line", "strokeWidth": 1.6}},
        {
          "transform": [{"filter": {"param": "hover", "empty": false}}],
          "mark": {"type": "point", "filled": true, "size": 60}
        }
      ]
    },
    {
      "transform": [{"pivot": "symbol", "value": "price", "groupby": ["date"]}],
      "mark": "rule",
      "encoding": {
        "opacity": {
          "condition": {"param": "hover", "empty": false, "value": 0.35},
          "value": 0
        },
        "tooltip": [
          {"field": "date", "type": "temporal", "format": "%b %Y"},
          {"field": "AAPL", "type": "quantitative", "format": ".0f"},
          {"field": "AMZN", "type": "quantitative", "format": ".0f"},
          {"field": "GOOG", "type": "quantitative", "format": ".0f"},
          {"field": "IBM", "type": "quantitative", "format": ".0f"},
          {"field": "MSFT", "type": "quantitative", "format": ".0f"}
        ]
      },
      "params": [{
        "name": "hover",
        "select": {
          "type": "point",
          "fields": ["date"],
          "nearest": true,
          "on": "pointerover",
          "clear": "pointerout"
        }
      }]
    }
  ]
}
```

The `pivot` transform is what makes one tooltip carry five series: it turns the
long table into one row per date with a column per symbol. Without it a tooltip
can only ever report the single line under the cursor.

---

## A binned heatmap — where two audiences agree

Critics against the crowd, 2,260 films that carry both scores. Each cell is a
count, so overlapping points become density instead of a solid smear.

```vega title="IMDB rating against Rotten Tomatoes rating" width=70% height=330
{
  "data": {
    "url": "https://cdn.jsdelivr.net/npm/vega-datasets@2/data/movies.json"
  },
  "height": 280,
  "transform": [
    {"filter": {"field": "IMDB Rating", "valid": true}},
    {"filter": {"field": "Rotten Tomatoes Rating", "valid": true}}
  ],
  "mark": "rect",
  "encoding": {
    "x": {
      "bin": {"maxbins": 40},
      "field": "Rotten Tomatoes Rating",
      "type": "quantitative",
      "title": "Rotten Tomatoes"
    },
    "y": {
      "bin": {"maxbins": 30},
      "field": "IMDB Rating",
      "type": "quantitative",
      "title": "IMDB"
    },
    "color": {
      "aggregate": "count",
      "type": "quantitative",
      "title": "films",
      "scale": {"scheme": "yellowgreenblue"}
    }
  }
}
```

The ridge runs bottom-left to top-right: the two audiences broadly agree. The
spread is widest in the middle, where a film can be a 60 to critics and a 7.5 to
viewers, or the reverse.

This chart replaced an earlier one plotting rating against worldwide gross. That
version rendered but told you nothing: 92% of films earn under a tenth of the
top-grossing film, so linear bins pressed almost every row into the bottom of
the chart. A skewed measure needs a log scale or a rank, not a bin.

---

## A spec kept in its own file

Every chart above carries its spec inline. `src` reads it from a file instead,
so a long spec does not bury the prose around it.

```vega title="Scatterplot matrix: shift-drag to brush, drag to pan" src="interactive-scatter.json" height=560 actions=true
```

````
```vega title="..." src="interactive-scatter.json" height=560 actions=true
```
````

That is [interactive-scatter.json](interactive-scatter.json): a nine-panel
repeat over horsepower, acceleration and mileage, with two interval selections
bound to different modifiers.

- **Drag** inside any panel to pan, and **scroll** to zoom — the `grid` selection
  is `bind: "scales"`, so it moves the axes themselves.
- **Shift-drag** to brush. That selection resolves as a `union` across all nine
  panels, so points stay coloured by origin in every panel at once and grey
  everywhere they fall outside the brush.

`src` follows the same guard as a data file: relative to this document, under
the content root, ending in `.json`, `.yaml` or `.yml`.

Two things about this spec are worth copying. It is a `repeat`, which is a
composed spec, so it never receives the container width — Vega-Lite sizes the
nine panels itself, and the result is centred in the column. And its `data.url`
is absolute: a relative url in a spec resolves against the page that renders
it, not against wherever the spec file lives.

---

## What to know before using a remote URL

**The fetch happens in the reader's browser, not at build time.** The page is only as available as the host. A dataset that moves leaves a blank chart, and no test in this repository can catch that.

**The URL is fetched with the reader's network, from the reader's IP.** Point it only at data you would be comfortable every reader of the page requesting.

**There is no path guard here, and there cannot be.** [[demo/visuals/src|src]] confines a path to the content root because the server reads that file. A Vega-Lite `data.url` is fetched by the browser under its own same-origin and CORS rules — which is also why the host must send permissive CORS headers, as jsdelivr does.

**A static export will not inline it.** `vyasa build` copies the spec, not the data.

So: remote URLs are right for large public datasets that would bloat the page, and for data that genuinely changes. For numbers you own, keep them in the repository next to the document and use [[demo/visuals/src|src]].
