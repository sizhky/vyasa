---
title: Folio Books — one KG, six styles
---

# Folio Books: one KG, six styles

Folio Books is a small online bookshop. Every figure on this page reads the same pack, `folio-books.kg`. Each view picks the style that fits its question. The style keys are `node_look`, `edge_path`, `edge_corner`, and `canvas`. A view sets them as defaults, and any node or edge can override them.

## What runs: services

Each box is a container in the C4 sense. The band names the service, `[kind]` says what it is, and the last line says what it owns.

```items
---
items_schema: folio-books.kg/kg.schema
default_projection: services
height: 60vh
---
```

## Where it runs: deployment

The blueprint canvas restates the page colours for this one figure. The object store is dashed because it is planned, not built.

```items
---
items_schema: folio-books.kg/kg.schema
default_projection: deployment
height: 60vh
---
```

## How customers move: journeys

Each journey is a metro line, coloured by the `journey` edge attr. The dashed shortcut from Home to Book page overrides the view with `edge_path=arc`, so it hops over Search instead of running through it.

```items
---
items_schema: folio-books.kg/kg.schema
default_projection: journeys
height: 60vh
---
```

## Checkout, step by step

An arc diagram keeps the steps in order on one line. The two dashed arcs below the line are the ways a customer goes back.

```items
---
items_schema: folio-books.kg/kg.schema
default_projection: checkout
height: 50vh
---
```

## Why checkout got slow: incident brainstorm

A free graph with the sketch look, because these are guesses in progress. Dashed boxes and edges have not been checked yet.

```items
---
items_schema: folio-books.kg/kg.schema
default_projection: incident
height: 55vh
---
```

## From payment to doorstep: fulfilment

Orthogonal runs with rounded corners. The return loop runs back along the lower row.

```items
---
items_schema: folio-books.kg/kg.schema
default_projection: pipeline
height: 45vh
---
```

## Restyle without touching the pack

A fence can set style keys for the figure it embeds, at the same level as the pack's `@graph` line. This fence draws the fulfilment view in the sketch look without editing the schema. A key the view sets itself, such as this view's `edge_path`, still wins.

```items
---
items_schema: folio-books.kg/kg.schema
default_projection: pipeline
node_look: sketch
height: 45vh
---
```
