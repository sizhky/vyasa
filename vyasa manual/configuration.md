# Configuration And CLI

Vyasa is a live Python server first: `vyasa.main:cli` resolves the content root, reloads config, picks a host and port, and then hands the request cycle to the app in [`vyasa/core.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/core.py). This guide is about the path from a folder of Markdown files to a running site you can keep editing. By the end, you should know which knob belongs on the command line, which belongs in `.vyasa`, and which settings are only meaningful inside a content folder. The only model to keep in your head is precedence: CLI overrides config, config overrides environment, and environment overrides defaults.

## Start Here

```bash
pip install vyasa
vyasa .
vyasa notes --host 0.0.0.0 --port 8080
```

The CLI lives in [`vyasa/main.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/main.py). If you omit `port`, [`VyasaConfig.get_port()`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/config.py) derives one from the working directory, which avoids the "every local project wants 5001" problem.

## Put Stable Choices In `.vyasa`

```toml
title = "Team Notes"
port = 8080
theme_preset = "serene-manuscript"
theme_primary = "#2f6fed"
table_col_max_width = "45vw"
sidebars_open = true

[extensions]
routes_add = ["annotations"]

[annotations]
enabled = true
```

Root-level `.vyasa` is for app behavior: title, content root, theme tokens, auth, RBAC, and sidebar defaults. Folder-level `.vyasa` is for navigation shape: `order`, `sort`, `folders_first`, and any local layout override that should travel with that subtree rather than the whole site.

Annotations are opt-in. Add the `annotations` route extension and enable its behavior as shown above; `[annotations] enabled = true` alone does not load the plugin.

The homepage card feed also respects `home_sort = "name_asc"` or `home_sort = "name_desc"` from the root `.vyasa` file when no root page exists. Leave it unset to keep the default newest-created-first ordering. Folder `sort` accepts `name_asc`, `name_desc`, `mtime_asc`, `mtime_desc`, `created_asc`, and `created_desc`.
The root `ignore = [...]` list also hides matching files from the homepage card feed, so you can keep drafts and repo clutter out of the landing page without deleting them.

## Why These Settings Matter

| Setting | Why it exists |
|---|---|
| `root` or CLI `directory` | Decides which folder becomes the visible content tree. |
| `theme_preset` and `theme_primary` | Feed layout-wide tokens before folder CSS starts overriding details. |
| `table_col_max_width` | Sets the default max width for markdown table cells across the site. |
| `sidebars_open` | Changes the default information density of the reading surface. |
| `reload_exclude` | Keeps local dev fast when the repo contains large generated folders. |

## Serving Content From Git Refs

Vyasa can serve any committed branch or tag of a content repo through a `?ref=` query (for example `?ref=origin/feat/my-branch`), reading files straight from git objects without a checkout. For those pages to show the latest commit, the local copy of the repo has to be fetched first — otherwise a reload keeps showing whatever commit was last pulled.

A lone `vyasa` process can run the fetcher itself on a background thread, keeping configured mirrors (`git_repos`) and clone-backed content roots fresh. Cadence is set by `git_fetch_interval` (seconds, default `30`); `0` disables it.

> **Run production with `--no-reload`.** `--reload` (the default) watches the content tree. Every git fetch writes into `.git`, the watcher sees it and restarts the worker, the fetcher respawns and refetches — a loop that pins CPU/memory until the machine dies. To prevent that, the in-process fetcher refuses to start under `--reload` (it logs a line saying so), and ref pages then only update via the branch-menu button. For automatic freshness in production, start with `--no-reload`; keep `--reload` for local dev only. If you must keep `--reload`, run `vyasa-fetch` as a separate process instead and set `git_fetch_interval = 0`.

| Setting | Why it exists |
|---|---|
| `git_repos` | Upstream repos to mirror, as `{ name = "url" }`, exposed as content roots. |
| `git_fetch_interval` | Seconds between automatic in-process fetches. `0` disables it (use a `vyasa-fetch` sidecar, and always `0` under `--reload`). |

## Keep In Mind

If auth is configured, the login and role checks are assembled during startup in [`vyasa/core.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/core.py) and [`vyasa/auth/runtime.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/auth/runtime.py). If you only need to reorder one branch in the sidebar, create a folder-local `.vyasa` instead of bloating the root config. If a setting seems ignored, check whether you set the same thing in both CLI flags and `.vyasa`; the CLI wins.
