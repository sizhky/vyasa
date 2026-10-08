---
name: story-telling-with-interactivity
description: "Use when a Vyasa document needs live Python cells from a marimo notebook (experimental): bounded controls next to a claim, marimo-studio views, optional and required blocks, the /marimo proxy, and shared passwords at /unlock that keep experiment compute private."
metadata:
  version: "0.1.0"
  status: experimental
---

# Story Telling With Interactivity

The document tells the story. The notebook computes. A reader who touches nothing must still receive the whole argument.

## Status: Experimental

The marimo server must look like the same site as Vyasa to the reader's browser. Two setups work:

- **Proxied (recommended).** Vyasa forwards `/marimo/<name>/...` to a marimo server on a private address. Readers never see the marimo address, and Vyasa's access rules guard it. See "Protecting compute" below.
- **Direct.** The marimo server is on the same machine and readers' browsers reach its port, for example Vyasa on `localhost:5099` and marimo on `localhost:2720`. Anyone who can reach the port can run the notebook.

It does not work with a marimo server on another site behind its own password. Browsers withhold marimo's `SameSite=Lax` login cookie in third-party frames, and marimo's login page refuses to load in a frame. Vyasa also writes the view file into the notebook folder on its own disk, so the notebook folder must be on the Vyasa machine.

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
  server: datasets                                 # proxied: a `[marimo_servers.datasets]` entry in .vyasa
  # url: http://localhost:2719                     # direct: a server readers' browsers reach themselves
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

## Protecting Compute

Most documents stay open. Experiments that run Python go behind a shared password, so strangers cannot load the server. Readers enter the password once at `/unlock`, and every document that password opens appears in the sidebar and search. The footer has an "Unlock" link.

1. Hash a password for a role. The command prompts twice and prints the TOML line:
   ```bash
   vyasa hash-password expt
   ```
2. Add the rules, the hash, and the proxied server to `.vyasa`:
   ```toml
   [[rbac.rules]]
   pattern = "^/posts/experiments(/|$)"   # the documents
   roles = ["expt"]

   [[rbac.rules]]
   pattern = "^/marimo/lln(/|$)"           # the proxied server's view pages
   roles = ["expt"]

   [role_passwords]
   expt = "scrypt$16384$8$1$<salt>$<hash>"

   [marimo_servers.lln]
   upstream = "http://127.0.0.1:2721"
   token_file = "~/.config/vyasa/marimo-lln.token"   # chmod 600, outside the repo
   ```
3. Start marimo on the private address, with the base URL and the same token file:
   ```bash
   uvx --with marimo-studio==0.2.3 marimo run <notebook.py> --sandbox --headless --host 127.0.0.1 --port 2721 --base-url /marimo/lln --token-password-file ~/.config/vyasa/marimo-lln.token
   ```
4. Set the document's frontmatter to `server: lln`.

Facts behind this setup:

- Paths that match no rule stay open. A shared password unlocks roles for the session only. It never satisfies a site-wide login requirement, and it can never grant the admin role `full`.
- Changing a role's hash locks every session that used the old password.
- Studio serves its view pages without checking marimo's token. The RBAC rule on `/marimo/<name>/` is the real gate. Without it, anyone can run the notebook through the proxy.
- The sandboxed frame sends no cookies. Locked requests may use only Studio capability paths (`/_marimo-studio/presentation/...`), which only an unlocked page can mint. Websockets are allowed only on those paths.
- Locking again stops new pages. A frame that is already open keeps working until its Studio session ends.
- marimo prints its access token in its startup log. Keep those logs private.

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

- Same machine or Vyasa's proxy only. See the status section above.
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
- `vyasa/extensions_builtin/marimo/proxy.py`: the `/marimo/<name>/` proxy and its access rules.
- `vyasa/auth/unlock.py`: role password hashing, `/unlock` sessions, and `vyasa hash-password`.
- `tests/test_unlock.py`: the auth gate with shared passwords.
- `tests/test_marimo.py`: kind resolution, offline Markdown, and the view contract.
