---
name: story-telling-with-interactivity
description: "Use when a Vyasa document needs live Python cells from a marimo notebook (experimental): bounded controls next to a claim, marimo-studio views, optional and required blocks, and the same-machine or reverse-proxy limit."
metadata:
  version: "0.1.0"
  status: experimental
---

# Story Telling With Interactivity

The document tells the story. The notebook computes. A reader who touches nothing must still receive the whole argument.

## Status: Experimental

The `marimo` extension works only when the Vyasa server and the marimo server look like one machine to the reader's browser:

- Both run on the same machine, for example Vyasa on `localhost:36443` and marimo on `localhost:2719`.
- Or a reverse proxy serves both under one site, so the frames are not third-party frames.

It does not work with a marimo server on another site behind a password. Browsers withhold marimo's `SameSite=Lax` login cookie in third-party frames, and marimo's login page refuses to load in a frame. Vyasa also writes the view file into the notebook folder on its own disk, so the notebook folder must be on the Vyasa machine.

Do not promise a shared remote compute server. Say that it needs a reverse proxy and that the proxy is not built.

## Core Idea

- Interactivity is a bounded slice of the parameter space, not a notebook. The author chooses the controls and their ranges.
- The default state equals the static figure. The argument must hold with no interaction.
- One control per claim. Each control has a guiding sentence that says what to notice.
- Prose lives in the document. Computation and widgets live in the notebook.
- The document points to the notebook. The notebook knows nothing about Vyasa.

## How Vyasa Builds A Marimo Document

Read this before you write. The craft rules below depend on these facts.

### Contract

```markdown
---
title: OCR benchmark datasets
marimo:
  notebook: ../../notebooks/datasets_explorer.py   # relative to this document
  view: datasets                                   # an existing marimo-studio view of that notebook
  url: http://localhost:2719                       # the `marimo run` server for that notebook
---

<!-- marimo-block required -->
Press 🔀 to show a random page, or type a page id.

<marimo-cell name="omni_controls"></marimo-cell>
<marimo-cell name="omni_page"></marimo-cell>
<!-- /marimo-block -->
```

- A `.md` file with a `marimo` frontmatter table, containing `notebook` and `view`, becomes a marimo document.
- `<marimo-cell name="...">` names a notebook cell by its function name. Write each tag on its own line.
- Adjacent `<marimo-cell>` tags form one run. Each run becomes one frame.
- `<!-- marimo-block optional|required -->` ... `<!-- /marimo-block -->` groups prose and cells. Marimo and GitHub hide these comments.

### Rendering

- Vyasa renders the prose itself, with its title, table of contents, and theme.
- Vyasa writes the view's `index.html` at `<notebook dir>/__marimo__/studio/<notebook stem>/<view>/`. The file holds one hidden section per run and Vyasa's page head. It changes only when the document changes. Commit it, because Studio needs it on a fresh clone.
- Each frame loads `<url>/<view>/?run=N`. The view shows only run N and reports its height, and the page sizes the frame to match.
- Each frame opens its own marimo session. A control in one frame cannot change another frame.

### Three states

| State | When | Reader sees |
|---|---|---|
| Live | `<url>/health` answers within 0.3 seconds | Prose, and cells in frames |
| Required block offline | Server down, view missing, or static build | Prose, and a warning callout per run |
| Optional block offline | Same | Nothing for that block |

When the server is down, the page opens with an error callout that gives the start command with the notebook's absolute path.

## Setup

1. Write the notebook with named output cells.
2. Create the view once with the built-in HTML starter:
   ```bash
   uvx --with marimo-studio==0.2.3 marimo-studio view create <view> --target <notebook.py> --starter marimo-studio/vanilla:default
   ```
3. Start the server on a free port, and put that port in the frontmatter `url`:
   ```bash
   uvx --with marimo-studio==0.2.3 marimo run <notebook.py> --sandbox --port 2719 --headless
   ```
4. Load the page in Vyasa once, so it writes the view. Then validate it:
   ```bash
   uvx --with marimo-studio==0.2.3 marimo-studio validate <view> --target <notebook.py>
   ```

Check the port first. Port 2718 is marimo's default and is often taken by another notebook server, and the health check then passes against the wrong server.

## Craft Rules

### Choosing blocks

- Mark a block `required` when the argument needs its figure. Mark it `optional` when the prose already states the conclusion and the block lets a reader explore.
- Put the guiding sentence inside the block. Prose outside a block must not refer to a control, because an optional block can disappear.
- Keep each block self-contained. Do not design a control in one block that drives a figure in another.

### Writing the notebook

- Name every cell that a document shows. The cell function name is the reference.
- Assign UI elements to global names, such as `omni_id_field`. Marimo sends no interactions for `_`-prefixed elements.
- When a button sets state that its own cell displays, create the state with `mo.state(value, allow_self_loops=True)`. Otherwise the cell does not rerun, and the field shows a stale value.
- Prefer a stable id field with a 🔀 button over a slider for browsing a dataset. An id names the same item in every session, so readers can cite it.
- Embed images as data URLs, for example base64 JPEG in `mo.image(...)`. Marimo virtual files (`./@file/...`) return 404 inside a Studio view.
- Give charts a transparent background and neutral axes, for example Altair `.configure(background="transparent")` with mid-grey axis colors. Marimo applies its own Vega theme, which draws a grey box on a dark page, and page CSS cannot reach into a chart.
- Size images relative to the column, for example `style={"max-width": "50%", "height": "auto"}`. Do not use `vh`, because inside an auto-height frame it tracks the frame, and the frame grows.

### Compute

- Every frame of every reader runs the whole notebook. Heavy work, such as training or scanning millions of documents, runs elsewhere. The notebook reads its outputs.
- Read growing outputs, such as training metrics, with `mo.watch.file`. Reuse expensive results with marimo's persistent cache.

## Limits

- Same machine or reverse proxy only. See the status section above.
- One session per frame per reader. No shared state across frames.
- Vyasa's module scripts, such as code copy and link previews, do not reach the frames.
- Page CSS reaches a cell only through Studio's `--marimo-cell-*` projection variables, because each cell renders in a shadow root. Vyasa maps fonts, text, border, and accent color, and sends the page's light or dark mode to each frame. Marimo's own widgets follow the OS color scheme, so they can differ when Vyasa's toggle differs from the OS.
- marimo-studio is pinned to 0.2.3, which pins marimo 0.25.0, and it calls itself experimental.
- Vyasa writes the view on page load. A read-only deployment cannot write it, so commit the generated file.

## Debugging

- Frame heights, from the page console:
  ```js
  copy(JSON.stringify([...document.querySelectorAll('iframe.vyasa-marimo-frame')].map(f => ({run: f.dataset.vyasaMarimoRun, height: f.style.height || f.height}))))
  ```
- A blank frame with Studio running usually means the view failed to build. Run `marimo-studio validate`. Studio keeps serving the last view that built.
- After editing the notebook, restart `marimo run`, because it does not reload code. Vyasa does not reload Python source either, so restart Vyasa after changing the extension.

## Implementation

- `vyasa/extensions_builtin/marimo/render.py`: document kind, view generation, frames, offline callouts.
- `tests/test_marimo.py`: kind resolution, offline Markdown, and the view contract.
