---
title: Why averages settle
marimo:
  notebook: ./notebooks/law_of_large_numbers.py
  view: lln
  url: http://localhost:2720
---

# Why averages settle

The average of many independent draws moves toward the true mean, and its distance from the mean shrinks like 1/√n. This is the law of large numbers. This page shows it with a fair coin, then shows where it fails.

This page is a demo of the experimental `marimo` extension. Vyasa renders the prose. A marimo server on `localhost:2720` runs the cells in `notebooks/law_of_large_numbers.py`, and each group of adjacent cells is one frame.

## One coin, many flips

A fair coin lands heads half the time. The share of heads in one sequence wanders early, then settles near 0.5.

<!-- marimo-block required -->
Drag **Coin flips** to lengthen the sequence. Press 🔀 for a new sequence, or type a seed to repeat one. Watch the line approach the dashed 0.5 line as the sequence grows.

<marimo-cell name="flip_controls"></marimo-cell>
<marimo-cell name="flip_chart"></marimo-cell>
<!-- /marimo-block -->

## How fast the gap closes

Ten times more flips does not make the gap ten times smaller. It makes the gap about √10, or 3.2, times smaller.

<!-- marimo-block required -->
Each point averages the gap over many repeated experiments of the same size. The measured line follows the theory line 0.5 × √(2 / πn). Move **Repeated experiments per size** down to see the measured line become noisy.

<marimo-cell name="error_controls"></marimo-cell>
<marimo-cell name="error_chart"></marimo-cell>
<!-- /marimo-block -->

## Where the law stops

The law needs a finite mean. Uniform, exponential, and normal draws settle on their means. Cauchy draws have no mean, so their running average keeps jumping no matter how many samples you take.

<!-- marimo-block optional -->
Pick a distribution and a sample count. Pick **Cauchy** to see the running mean fail to settle.

<marimo-cell name="dist_controls"></marimo-cell>
<marimo-cell name="dist_chart"></marimo-cell>
<!-- /marimo-block -->

## What this demo shows

| Feature | Where |
|---|---|
| Slider with a reactive summary sentence | One coin, many flips |
| 🔀 button and an editable seed field that share one state | One coin, many flips |
| Altair charts drawn by the notebook | Every section |
| Table output | How fast the gap closes |
| Dropdown | Where the law stops |
| Required blocks: kept as warnings when the server is down | The first two sections |
| Optional block: removed when the server is down | Where the law stops |

To see the offline version, stop the marimo server and reload this page. The page then opens with an error callout that gives the start command. The two required sections keep their prose and show one warning each. The optional section disappears, and its claim still stands in the prose above it.
