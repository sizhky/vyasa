# Vyasa Documentation Overhaul

**Status:** proposed documentation inventory  
**Date:** 2026-09-20  
**Scope:** repository-wide README, manual, demo, reference, and contributor documentation

## Decision summary

Vyasa has outgrown one README and one small manual. The public documentation should become a task-oriented guide with a stable feature reference, executable demos, and separate contributor and extension documentation.

The current documentation is split across `README.md`, `vyasa manual/`, `static-build.md`, `CONTRIBUTING.md`, `PUBLISHING.md`, `demo/`, `docs/`, and generated HTML. Several implemented features appear only in source code, tests, design notes, or demos.

The proposed public documentation root is `docs/guide/`. The existing `docs/` tree should remain the home for design records, implementation plans, research, and generated site output until a separate migration is approved.

## Repository scan

The inventory below is based on:

- The public package entry points in `pyproject.toml`, `vyasa/main.py`, `vyasa/build.py`, and `vyasa/git_fetcher.py`.
- The built-in extension registry in `vyasa/extensions_builtin/__init__.py`.
- Runtime modules under `vyasa/`, extension modules under `vyasa/extensions_builtin/`, and bundled themes under `vyasa/themes/`.
- Focused tests under `tests/` and `tests_js/`.
- Existing guides, demos, generated pages, plans, and design records.

The repository contains 161 Python files, 46 JavaScript files, 85 tracked Markdown files, 28 CSS files, and 45 TOML files. Generated caches and compiled artifacts are excluded from the public feature inventory.

## Proposed information architecture

```text
docs/guide/
├── README.md                         # documentation home and task router
├── getting-started.md                # install, first site, first edit
├── concepts.md                       # content tree, routes, shell, extensions
├── authoring/
│   ├── README.md
│   ├── markdown.md                   # supported Markdown and embeds
│   ├── links.md                      # Markdown links, wikilinks, aliases
│   ├── frontmatter.md                # metadata, titles, raw files
│   ├── code.md                       # fences, includes, references, line links
│   ├── callouts-tabs.md
│   ├── knowledge-graphs.md           # items/tasks and KG Pack sidecars
│   ├── visuals.md                    # card, bar, stack, Vega, Altair
│   ├── mdx.md                        # islands, catalogs, Excalidraw
│   └── slides.md                     # document and Reveal presentation modes
├── site/
│   ├── navigation.md                 # tree, landing pages, TOC, search
│   ├── configuration.md              # .vyasa, CLI, environment precedence
│   ├── theming.md                    # presets, tokens, CSS, scoped CSS
│   ├── server-mode.md                # live server, reload, HTMX, assets
│   └── static-build.md               # export, parity, hosting
├── diagrams/
│   ├── README.md
│   ├── mermaid.md
│   ├── d2.md
│   ├── cytograph.md
│   └── cryptograph.md
├── access/
│   ├── authentication.md             # local sessions and Google OAuth
│   ├── rbac.md                       # roles, path rules, admin UI
│   └── drawing-access.md             # protected Excalidraw assets
├── integrations/
│   ├── git-refs.md
│   ├── vscode.md
│   ├── api-catalog.md
│   ├── annotations-bookmarks.md
│   ├── feedback.md
│   └── raw-files.md
├── extensions/
│   ├── README.md                     # extension model and lifecycle
│   ├── authoring.md                  # manifests, slots, capabilities
│   ├── routes-and-assets.md
│   └── testing.md
├── reference/
│   ├── cli.md
│   ├── configuration-keys.md
│   ├── markdown-syntax.md
│   ├── routes.md
│   ├── extension-registry.md
│   └── troubleshooting.md
└── contributing/
    ├── development.md
    ├── testing.md
    ├── releasing.md
    └── documentation.md
```

The guide should use route-style internal links when rendered by Vyasa. It should not expose repository file paths as the primary navigation model.

## Feature inventory and documentation targets

### Product foundation

| Feature | Implementation evidence | Current docs and demos | Proposed canonical location |
|---|---|---|---|
| Markdown folder site | `vyasa/content_tree.py`, `vyasa/content_routes.py`, `vyasa/markdown_rendering.py` | `README.md`; `vyasa manual/README.md`; `demo/demo.md` | `docs/guide/getting-started.md`, `docs/guide/concepts.md` |
| Live Python server | `vyasa/main.py`, `vyasa/core.py`, `vyasa/live.py` | `vyasa manual/configuration.md`; `CONTRIBUTING.md` | `docs/guide/site/server-mode.md` |
| CLI root, host, port, reload | `vyasa/main.py`, `vyasa/config.py` | `vyasa manual/configuration.md` | `docs/guide/reference/cli.md` |
| `.vyasa` configuration | `vyasa/config.py`, `vyasa/rbac_config.py` | `README.md`; `vyasa manual/configuration.md` | `docs/guide/site/configuration.md`, `docs/guide/reference/configuration-keys.md` |
| Environment and precedence | `vyasa/config.py` | `vyasa manual/configuration.md` | `docs/guide/site/configuration.md` |
| Folder-local configuration | `vyasa/config.py`, `vyasa/content_tree.py` | `vyasa manual/configuration.md`; `demo/quick-styling-inline-css.md` | `docs/guide/site/configuration.md`, `docs/guide/site/navigation.md` |
| Live reload | `vyasa/live.py`, `vyasa/static/live_reload_worker.js` | `static-build.md`; `CONTRIBUTING.md` | `docs/guide/site/server-mode.md` |
| HTMX navigation | `vyasa/page_shell.py`, `vyasa/content_routes.py`, `vyasa/static/page_shell.js` | `vyasa manual/architecture.md` | `docs/guide/site/server-mode.md` |
| Static export | `vyasa/build.py` | `static-build.md`; `PUBLISHING.md` | `docs/guide/site/static-build.md` |
| Static/runtime parity | `vyasa/build.py`, extension static-build hooks, `tests/test_build.py` | `static-build.md`; `docs/core-arch-improvement/*` | `docs/guide/site/static-build.md` |
| Python API | `vyasa/build.py`, public helpers in package modules | `static-build.md` | `docs/guide/reference/cli.md` and API appendix |
| Package and release workflow | `pyproject.toml`, `setup.py`, `PUBLISHING.md` | `PUBLISHING.md` | `docs/guide/contributing/releasing.md` |

### Content tree and navigation

| Feature | Implementation evidence | Current docs and demos | Proposed canonical location |
|---|---|---|---|
| `index.md` and `README.md` landing pages | `vyasa/content_tree.py`, `vyasa/tree_service.py` | `README.md`; `vyasa manual/README.md`; `demo/wikilinks-lab/README.md` | `docs/guide/site/navigation.md` |
| Folder-aware sidebar tree | `vyasa/tree_rendering.py`, `vyasa/sidebar_helpers.py`, `vyasa/extensions_builtin/sidebar_routes.py` | `README.md`; `demo/vyasa-architecture-system-design-tasks.md` | `docs/guide/site/navigation.md` |
| Ordering and sorting | `vyasa/content_tree.py`, `vyasa/config.py` | `vyasa manual/configuration.md` | `docs/guide/site/navigation.md`, `docs/guide/reference/configuration-keys.md` |
| Breadcrumbs and pager | `vyasa/page_frame.py`, `vyasa/page_views.py` | `vyasa manual/architecture.md` | `docs/guide/site/navigation.md` |
| Table of contents | `vyasa/sidebar_helpers.py`, `vyasa/extensions_builtin/table_of_contents.py` | `vyasa manual/markdown-features.md`; `static-build.md` | `docs/guide/site/navigation.md`, `docs/guide/authoring/markdown.md` |
| Search and preview cards | `vyasa/search_service.py`, `vyasa/search_views.py`, `vyasa/extensions_builtin/default_search*`, `tests/test_search_preview.py` | `docs/vyasa-ui-critique.md`; architecture demo | `docs/guide/site/navigation.md` |
| Blog-style homepage | `vyasa/extensions_builtin/blog_home.py`, `tests/test_blog_home_rbac.py` | `README.md`; design notes in `docs/refactor/` | `docs/guide/site/navigation.md` |
| Multiple content roots and mounts | `vyasa/runtime_context.py`, `vyasa/config.py`, `vyasa/extensions_builtin/filesystem*` | Architecture demo; `vyasa manual/architecture.md` | `docs/guide/concepts.md`, `docs/guide/integrations/raw-files.md` |
| Raw file serving and downloads | `vyasa/extensions_builtin/filesystem_routes.py` | No focused public guide | `docs/guide/integrations/raw-files.md` |
| PDF documents | `vyasa/extensions_builtin/pdf_viewer.py`, `tests/test_build.py` | Architecture demo | `docs/guide/authoring/markdown.md` or `docs/guide/integrations/raw-files.md` |
| `.tree` documents and tree tables | `vyasa/tree_tables.py`, `vyasa/extensions_builtin/tree_table.py`, `tests/test_tree_tables.py` | Architecture demo; refactor notes | `docs/guide/authoring/knowledge-graphs.md` or separate `docs/guide/authoring/tree-tables.md` |
| Generated favicon | `vyasa/favicon.py`, `vyasa/extensions_builtin/default_favicon.py`, `tests/test_favicon.py` | No focused public guide | `docs/guide/site/theming.md` |

### Markdown authoring

| Feature | Implementation evidence | Current docs and demos | Proposed canonical location |
|---|---|---|---|
| Common Markdown | `vyasa/extensions_builtin/markdown/renderer.py` | `vyasa manual/markdown-features.md` | `docs/guide/authoring/markdown.md` |
| Frontmatter and title resolution | `vyasa/extensions_builtin/markdown/pipeline.py`, `vyasa/markdown_rendering.py` | Partial examples across `README.md`, demos | `docs/guide/authoring/frontmatter.md` |
| Heading anchors and custom IDs | renderer heading handling | `vyasa manual/markdown-features.md` | `docs/guide/authoring/markdown.md` |
| Footnotes as sidenotes | renderer and `vyasa/static/sidenote.css` | `vyasa manual/markdown-features.md`; `static-build.md` | `docs/guide/authoring/markdown.md` |
| Math and dollar escaping | renderer; `demo/dollar-escape.md` | `vyasa manual/markdown-features.md`; `demo/dollar-escape.md` | `docs/guide/authoring/markdown.md` |
| Embedded video, audio, PDF, and iframe | renderer token support | `vyasa manual/markdown-features.md` | `docs/guide/authoring/markdown.md` |
| Callouts | markdown pipeline and renderer; `tests/test_callouts.py` | `README.md`; `vyasa manual/markdown-features.md` | `docs/guide/authoring/callouts-tabs.md` |
| Tabs | `vyasa/extensions_builtin/tabs/`, `tests/test_markdown_renderer.py` | `README.md`; `vyasa manual/markdown-features.md`; `demo/pokemon/README.md` | `docs/guide/authoring/callouts-tabs.md` |
| Collapsible sections | renderer | `vyasa manual/markdown-features.md` | `docs/guide/authoring/markdown.md` |
| Keyboard input, citations, comments, emoji, smart typography | renderer | `vyasa manual/markdown-features.md` | `docs/guide/reference/markdown-syntax.md` |
| Code fences and highlighting | `vyasa/extensions_builtin/code_tools.py`, renderer, bundled assets | `vyasa manual/markdown-features.md`; `vyasa manual/theming.md` | `docs/guide/authoring/code.md` |
| Code line numbers and line selection | code tools and renderer | `vyasa manual/theming.md`; `docs/refactor/code-reference-highlighting-spec.md` | `docs/guide/authoring/code.md` |
| Code snippet includes | markdown pipeline and renderer | `README.md`; `vyasa manual/markdown-features.md` | `docs/guide/authoring/code.md` |
| Code reference links and previews | `vyasa/extensions_builtin/link_preview/`, `tests/test_link_preview.py` | `docs/refactor/code-reference-highlighting-spec.md` | `docs/guide/authoring/code.md`, `docs/guide/integrations/vscode.md` |
| Tooltips and page actions | `vyasa/extensions_builtin/tooltip_syntax.py`, `document_actions.py` | Partial architecture and demo references | `docs/guide/authoring/markdown.md` |
| Folder-scoped CSS | `vyasa/extensions_builtin/scoped_custom_css.py`, `vyasa/sidebar_helpers.py` | `vyasa manual/markdown-features.md`; `vyasa manual/theming.md` | `docs/guide/site/theming.md` |

### Links and document references

| Feature | Implementation evidence | Current docs and demos | Proposed canonical location |
|---|---|---|---|
| Standard relative links | markdown pipeline and content routes | `vyasa manual/markdown-features.md` | `docs/guide/authoring/links.md` |
| Obsidian-style wikilinks | `vyasa/extensions_builtin/wikilinks/`, `tests/test_markdown_renderer.py` | `demo/wikilinks.md`; `demo/wikilinks-lab/README.md` | `docs/guide/authoring/links.md` |
| Heading links and aliases | wikilink resolver and content tree | `demo/wikilinks-lab/README.md` | `docs/guide/authoring/links.md` |
| Link previews | `vyasa/extensions_builtin/link_preview/` | `docs/refactor/code-reference-highlighting-spec.md`; no user guide | `docs/guide/authoring/links.md` |
| Code URL navigation | link preview and code source modules | `docs/kg-code-url-navigation.md` | `docs/guide/authoring/code.md` |
| Git-backed code sources | `vyasa/code_source.py`, `vyasa/git_fetcher.py` | `vyasa manual/configuration.md`; `demo/python-dotenv.md` | `docs/guide/integrations/git-refs.md`, `docs/guide/authoring/code.md` |

### Diagrams and visuals

| Feature | Implementation evidence | Current docs and demos | Proposed canonical location |
|---|---|---|---|
| Mermaid diagrams | `vyasa/extensions_builtin/mermaid/`, `tests/test_markdown_renderer.py` | `vyasa manual/mermaid-diagrams.md`; many demos | `docs/guide/diagrams/mermaid.md` |
| Mermaid zoom, pan, fullscreen, theme redraw | Mermaid extension assets and client scripts | `vyasa manual/mermaid-diagrams.md` | `docs/guide/diagrams/mermaid.md` |
| D2 diagrams | `vyasa/extensions_builtin/d2/`, `tests/test_markdown_renderer.py` | `vyasa manual/d2-diagrams.md`; `demo/d2-animation.md` | `docs/guide/diagrams/d2.md` |
| D2 animation and scenarios | D2 renderer and demo | `vyasa manual/d2-diagrams.md`; `demo/d2-animation.md` | `docs/guide/diagrams/d2.md` |
| Cytograph graphs | `vyasa/extensions_builtin/cytograph/`, `tests/test_cytograph.py` | architecture notes; no complete user guide | `docs/guide/diagrams/cytograph.md` |
| Cryptograph graphs | `vyasa/extensions_builtin/cryptograph/`, `tests/test_cryptograph.py` | architecture notes; no complete user guide | `docs/guide/diagrams/cryptograph.md` |
| Simple visuals: card, bar, stack | `vyasa/extensions_builtin/visuals/`, `tests/test_visuals.py` | `demo/visuals/` | `docs/guide/authoring/visuals.md` |
| Vega-Lite JSON and remote data | `vyasa/extensions_builtin/vega/`, visuals extension | `demo/visuals/vega.md`; `demo/visuals/vega-remote.md` | `docs/guide/authoring/visuals.md` |
| Altair Python charts | `vyasa/extensions_builtin/vega/altair_run.py`, optional dependency in `pyproject.toml` | `demo/mdx-demo/`; `demo/visuals/` | `docs/guide/authoring/visuals.md` |
| Visual registry extension point | visuals registry and renderer | `demo/visuals/adding-a-visual.md` | `docs/guide/extensions/authoring.md` |

### Knowledge Graphs and task views

| Feature | Implementation evidence | Current docs and demos | Proposed canonical location |
|---|---|---|---|
| `items` and `tasks` fences | `vyasa/extensions_builtin/tasks/`, `tests/test_tasks_*` | `README.md`; architecture demo; `demo/ai-capabilities-and-limitations.md` | `docs/guide/authoring/knowledge-graphs.md` |
| Knowledge Graph product model | task model, items pack, projections, query modules | `docs/kg-dsl-requirements.md`; `docs/kg-node-connection-logic.md` | `docs/guide/authoring/knowledge-graphs.md` |
| KG Pack sidecars | `items_pack.py`, `.kg.nodes`, `.kg.schema`, `.kg.edges`, `.kg.attrs`, palettes | `docs/astro-mdx.kg/`; `docs/kg-tasks-refactor.md` | `docs/guide/authoring/knowledge-graphs.md` |
| Inline lightweight graphs | tasks model and renderer | `README.md`; architecture demo | `docs/guide/authoring/knowledge-graphs.md` |
| Queries, contexts, projections, and traversal | `tasks/query.py`, `tasks/projections.py` | `docs/kg-dsl-requirements.md`; `docs/trd-kg-view-slide-sequences.md` | `docs/guide/authoring/knowledge-graphs.md` |
| Graph layouts and views | `tasks/layout.py`, `tasks/layouts.py`, client task assets | architecture demo; `docs/trd-kg-view-visibility.md` | `docs/guide/authoring/knowledge-graphs.md` |
| Gantt, cards, sequence, graph, and fullscreen views | task rendering and client assets | `tests/test_tasks_layouts.py`; `tests_js/tasks_*` | `docs/guide/authoring/knowledge-graphs.md` |
| Query builder and graph filters | `tasks/query.py`, task client assets | no focused public guide | `docs/guide/authoring/knowledge-graphs.md` |
| Knowledge Graph Git review | `tasks/review.py`, `tasks_git_review` tests and client assets | `docs/trd-kg-git-review.md` | `docs/guide/integrations/git-refs.md` or KG reference subsection |
| Graph snapshots from event streams | `items-to-snapshots` skill and project graph assets | no public product guide | `docs/guide/authoring/knowledge-graphs.md` |

### MDX, slides, and editing

| Feature | Implementation evidence | Current docs and demos | Proposed canonical location |
|---|---|---|---|
| MDX islands and JSX components | `vyasa/extensions_builtin/mdx/`, `tests/test_mdx.py` | `docs/astro-mdx.md`; `demo/mdx-demo/demo.md` | `docs/guide/authoring/mdx.md` |
| Astro MDX rendering | `vyasa/extensions_builtin/mdx/astro.py` | `docs/astro-mdx.md` | `docs/guide/authoring/mdx.md` |
| MDX catalogs and API discovery | MDX catalog routes and `api_catalog.py` | `demo/mdx-demo/demo.md` | `docs/guide/integrations/api-catalog.md` |
| Excalidraw canvases and sidecars | MDX Excalidraw routes and static client | `demo/mdx-demo/demo.md` | `docs/guide/authoring/mdx.md`, `docs/guide/access/drawing-access.md` |
| Editable document source | `vyasa/extensions_builtin/document_edit/`, `tests/test_document_edit.py` | design blueprint only | `docs/guide/integrations/document-editing.md` |
| Markdown preview and document events | document edit API | no public guide | `docs/guide/integrations/document-editing.md` |
| Document actions: fold, copy raw, copy path | `vyasa/extensions_builtin/document_actions.py` | partial UI references | `docs/guide/authoring/markdown.md` |
| Markdown presentation mode | `vyasa/extensions_builtin/slides/`, `vyasa/slides.py` | `vyasa manual/advanced.md`; `demo/vyasa-slides.md` | `docs/guide/authoring/slides.md` |
| Reveal-style presentation mode | slides extension and `tests/test_slides_reveal.py` | `demo/traditional-slides.md`; `docs/posts/demo/reveal-slides.html` | `docs/guide/authoring/slides.md` |
| Slide URLs and source reuse | slides deck module | `vyasa manual/advanced.md`; `demo/vyasa-slides.md` | `docs/guide/authoring/slides.md` |

### Appearance and shell

| Feature | Implementation evidence | Current docs and demos | Proposed canonical location |
|---|---|---|---|
| Theme presets | `vyasa/themes/*.toml`, `vyasa/theme_extensions/`, `tests/test_theme_extensions.py` | `vyasa manual/theming.md`; `README.md` | `docs/guide/site/theming.md` |
| Theme tokens and primary color | `vyasa/theme_colors.py`, `vyasa/config.py` | `vyasa manual/theming.md`; `demo/quick-styling-inline-css.md` | `docs/guide/site/theming.md` |
| Custom global CSS | `custom.css`, layout assets | `vyasa manual/theming.md` | `docs/guide/site/theming.md` |
| Scoped folder CSS | scoped custom CSS extension | `vyasa manual/theming.md`; `vyasa manual/markdown-features.md` | `docs/guide/site/theming.md` |
| Code themes and line numbers | code tools and theme assets | `vyasa manual/theming.md` | `docs/guide/site/theming.md` |
| Responsive shell and mobile panels | `vyasa/nav_views.py`, `vyasa/page_shell.py`, client assets | `docs/vyasa-ui-critique.md`; generated UI screenshots | `docs/guide/site/navigation.md` |
| Favicon discovery and generation | favicon modules | no focused public guide | `docs/guide/site/theming.md` |

### Access, collaboration, and integrations

| Feature | Implementation evidence | Current docs and demos | Proposed canonical location |
|---|---|---|---|
| Local session authentication | `vyasa/auth/`, `vyasa/extensions_builtin/auth_routes.py` | `vyasa manual/security.md` | `docs/guide/access/authentication.md` |
| Google OAuth | `vyasa/auth/oauth_bootstrap.py`, config accessors | `vyasa manual/security.md`; README optional dependency | `docs/guide/access/authentication.md` |
| Role-based path access | `vyasa/rbac_config.py`, `vyasa/auth/policy.py`, `tests/test_auth_runtime.py` | `vyasa manual/security.md` | `docs/guide/access/rbac.md` |
| RBAC administration UI | `vyasa/extensions_builtin/rbac_admin/`, `tests/test_rbac_admin.py` | architecture demo; no operator guide | `docs/guide/access/rbac.md` |
| Drawing-specific passwords | auth policy and Excalidraw routes | `vyasa manual/security.md` | `docs/guide/access/drawing-access.md` |
| Annotations | `vyasa/extensions_builtin/annotations/`, `tests/test_annotations_*` | UI critique; architecture demo | `docs/guide/integrations/annotations-bookmarks.md` |
| Bookmarks | `vyasa/extensions_builtin/bookmarks/`, store and client assets | UI critique; architecture demo | `docs/guide/integrations/annotations-bookmarks.md` |
| Human-to-agent feedback | `vyasa/extensions_builtin/feedback/`, `vyasa/agent.py`, `tests/test_feedback.py` | `docs/index.html`; design blueprint; no user guide | `docs/guide/integrations/feedback.md` |
| Feedback CLI and durable polling | feedback CLI and API routes | no focused public guide | `docs/guide/integrations/feedback.md` |
| Git branch and tag views | `vyasa/git_refs.py`, `vyasa/extensions_builtin/git_refs.py` | `vyasa manual/configuration.md`; design notes | `docs/guide/integrations/git-refs.md` |
| Background git fetcher | `vyasa/git_fetcher.py`, CLI entry point | `vyasa manual/configuration.md` | `docs/guide/integrations/git-refs.md` |
| Local VS Code opening | `vyasa/extensions_builtin/vscode.py`, `tests/test_vscode.py` | no public guide | `docs/guide/integrations/vscode.md` |
| API catalog | `vyasa/api_catalog.py`, API catalog extension | `demo/mdx-demo/demo.md`; no reference page | `docs/guide/integrations/api-catalog.md` |
| Debug and performance traces | `vyasa/extensions_builtin/debug_perf/`, debug route skill | no public product guide | `docs/guide/reference/troubleshooting.md` |

### Extension and operator surface

| Feature | Implementation evidence | Current docs and demos | Proposed canonical location |
|---|---|---|---|
| Built-in extension registry | `vyasa/extensions_builtin/__init__.py` | `docs/refactor/extensions.md`; architecture notes | `docs/guide/extensions/README.md` |
| Extension metadata, slots, capabilities | `vyasa/extensions.py` | `docs/adr/0001-modular-extension-architecture.md`; `docs/refactor/extensions.md` | `docs/guide/extensions/authoring.md` |
| Extension routes and static assets | `vyasa/extensions.py`, `vyasa/assets.py` | `docs/refactor/analysis-2.md` | `docs/guide/extensions/routes-and-assets.md` |
| External extensions | extension loading and `tests/test_external_extensions.py` | `docs/refactor/analysis-2.md` | `docs/guide/extensions/authoring.md` |
| Runtime/static provider contracts | `vyasa/extensions.py`, `vyasa/build.py` | `docs/refactor/analysis-2.md` | `docs/guide/extensions/testing.md` |
| API contracts published by extensions | `vyasa/api_catalog.py` | `demo/mdx-demo/demo.md` | `docs/guide/extensions/routes-and-assets.md` |
| Extension test strategy | `tests/test_extensions.py`, integration tests | `CONTRIBUTING.md`; refactor notes | `docs/guide/extensions/testing.md` |
| Architecture and request pipeline | `vyasa/core.py`, `runtime_context.py`, `runtime_services.py` | `vyasa manual/architecture.md`; architecture demo | `docs/guide/concepts.md`, `docs/guide/extensions/README.md` |

## Current documentation assessment

### What already works

- `README.md` has a usable installation path, a content-tree example, a feature map, and links into the manual.
- `vyasa manual/` explains the original core workflow clearly enough for basic server use.
- `static-build.md` contains working server-to-static concepts and deployment examples.
- `vyasa manual/markdown-features.md` is broad and covers many standard Markdown behaviors.
- `vyasa manual/mermaid-diagrams.md` and `vyasa manual/d2-diagrams.md` contain real syntax examples.
- `demo/` contains executable examples for wikilinks, D2, visuals, MDX, Knowledge Graphs, slides, and styling.
- `docs/` contains valuable architecture, Knowledge Graph, extension, and UI design records.

### Problems to resolve

1. The README points to raw `.md` paths and a directory with a space in its name. Those links are awkward in a rendered Vyasa site and violate the project’s route-link convention.
2. The manual describes the original core but does not route readers to newer capabilities such as MDX, Knowledge Graph queries, visuals, feedback, annotations, bookmarks, Git refs, VS Code, or extension authoring.
3. The current docs mix public user guidance, generated HTML, design records, implementation plans, research, and screenshots under `docs/`.
4. Several feature descriptions are only discoverable by reading demos or tests. The public guide should explain the contract, limits, and smallest working example for each feature.
5. The static-build guide is useful but uses dated language and claims broad parity without documenting extension-specific limits or verification rules.
6. The Markdown manual repeats headings and mixes baseline Markdown, Vyasa syntax, HTML embeds, styling, and implementation behavior in one long page.
7. Security documentation covers authentication and RBAC but does not explain deployment assumptions, secret placeholders, admin routes, or static-export implications.
8. There is no extension author guide despite a mature extension registry and explicit extension architecture.
9. There is no reference page generated from the configuration keys, CLI options, route families, or built-in extension registry.
10. The demos are not consistently labeled as tutorials, feature examples, architecture visualizations, regression fixtures, or exploratory prototypes.

## README rewrite proposal

The README should become the product landing page and shortest successful path. It should not duplicate the full manual.

### Recommended README sequence

1. One-sentence product definition and target users.
2. Three concrete use cases: personal knowledge base, documentation site, and Markdown-powered presentation.
3. A five-minute installation and first-site walkthrough.
4. A compact feature matrix linking to the guide.
5. One content-tree example and one `.vyasa` example.
6. A clear server-mode versus static-build decision.
7. A curated demo index with labels and expected learning outcome.
8. Security and access summary with a link to the access guide.
9. Extension and MDX summary for advanced users.
10. Contributor and release links.

The README should remove deep implementation explanations, long feature claims, direct absolute filesystem links, and undocumented syntax. It should use stable guide routes such as `guide#getting-started` after the new docs are published.

## Demo overhaul proposal

Create a demo index with one canonical example per public feature. Keep exploratory, internal, and regression content separate.

| Demo class | Current examples | Proposed treatment |
|---|---|---|
| Getting started | `demo/demo.md`, `demo/vyasa.md` | Keep, simplify, and make the first README link. |
| Markdown authoring | `demo/dollar-escape.md`, `demo/quick-styling-inline-css.md`, `demo/pokemon/README.md` | Group under authoring examples. |
| Links | `demo/wikilinks.md`, `demo/wikilinks-lab/` | Keep as the link resolver tutorial and behavior lab. |
| Diagrams | `demo/d2-animation.md`, Mermaid examples in existing demos | Add a Mermaid landing demo and separate Cytograph/Cryptograph examples. |
| Visuals | `demo/visuals/` | Keep as the visual registry tutorial and gallery. |
| Knowledge Graphs | `demo/vyasa-architecture-system-design-tasks.md`, `demo/sqlite-internals-as-kg.md`, `demo/graph-projection.md` | Add a small inline example, a KG Pack example, and a query/projection example. |
| MDX | `demo/mdx-demo/` | Keep as the MDX and Excalidraw reference application. |
| Slides | `demo/vyasa-slides.md`, `demo/traditional-slides.md` | Make one the document-view tutorial and one the Reveal example. |
| Theme and CSS | `demo/quick-styling-inline-css.md`, `demo/seizure-warning-trippy-css/` | Label inline CSS as experimental and add a durable theme example. |
| Architecture | `demo/vyasa-architecture-system-design-tasks.md`, `demo/vyasa.md` | Label as architecture visualization, not beginner documentation. |
| Domain content | books, Pokémon, quantum mechanics, travel, repo archaeology | Keep as content-quality examples, not product documentation. |
| Internal prototypes | `demo/birdhouse/`, state files, ledger files | Move to an explicitly internal or research area when their status is known. |

Each canonical demo should begin with: purpose, prerequisites, feature(s) demonstrated, expected result, source location, and links to the guide page.

## Existing-document disposition

| Existing location | Proposed disposition |
|---|---|
| `README.md` | Rewrite as product landing page and quick start. |
| `vyasa manual/README.md` | Replace with `docs/guide/README.md`; retain a redirect during migration. |
| `vyasa manual/configuration.md` | Split into site configuration, CLI reference, and Git refs. |
| `vyasa manual/markdown-features.md` | Split into authoring guides and generated syntax reference. |
| `vyasa manual/mermaid-diagrams.md` | Move or adapt to `docs/guide/diagrams/mermaid.md`. |
| `vyasa manual/d2-diagrams.md` | Move or adapt to `docs/guide/diagrams/d2.md`. |
| `vyasa manual/theming.md` | Move or adapt to `docs/guide/site/theming.md`. |
| `vyasa manual/security.md` | Split into authentication, RBAC, and drawing access. |
| `vyasa manual/architecture.md` | Fold the user-relevant model into concepts; retain deeper details for contributors. |
| `vyasa manual/advanced.md` | Split slides, navigation, and operational escape hatches. |
| `static-build.md` | Move to `docs/guide/site/static-build.md` and update parity claims. |
| `CONTRIBUTING.md` | Keep a short root redirect and make `docs/guide/contributing/` canonical. |
| `PUBLISHING.md` | Keep a short root redirect and make release guidance canonical. |
| `docs/refactor/`, `docs/implementation/`, `docs/research/`, `docs/adr/` | Keep as internal records, with an index and explicit status labels. |
| `docs/posts/` and `docs/index.html` | Treat as generated or legacy published output; document its ownership before changing it. |
| `demo/` | Add an index and classify every demo by purpose. |

## Recommended implementation order

1. Create `docs/guide/README.md`, `getting-started.md`, `concepts.md`, and `site/configuration.md`.
2. Rewrite the root README with links to the new guide routes.
3. Split Markdown, diagrams, theming, static build, security, and slides into canonical pages.
4. Document Knowledge Graphs, visuals, MDX, and extension authoring from their existing examples.
5. Add integration pages for search, Git refs, annotations, bookmarks, feedback, VS Code, raw files, and API catalogs.
6. Add a demo index, classify demos, and add one canonical example for every public feature family.
7. Add generated references for CLI options, configuration keys, routes, and built-in extensions.
8. Add link checks and a documentation coverage checklist to contributor guidance.

## Acceptance criteria for the overhaul

- A new user can install Vyasa, serve a page, edit Markdown, and find the next guide without reading source code.
- Every built-in public feature has one canonical guide location and one labeled demo or an explicit reason for having none.
- Every guide distinguishes stable behavior, optional dependencies, server-only behavior, static-build behavior, and experimental behavior.
- README, guide, and demo links use Vyasa route notation when rendered by Vyasa.
- Configuration examples use placeholders and do not expose local absolute paths or secrets.
- Public documentation does not claim feature parity that is not covered by runtime and static-build tests.
- Internal design records remain available but are clearly separated from user guidance.
- The documentation structure can support generated CLI, configuration, route, and extension references.

## Risks and early checks

| Risk | Early check |
|---|---|
| Proposed guide routes conflict with current content-tree behavior | Build a small `docs/guide/` tree and verify landing-page and link resolution. |
| Static output and live output expose different feature behavior | Add a feature parity matrix before moving claims from `static-build.md`. |
| A feature is implementation-only rather than supported public API | Mark it experimental until a stable author contract and demo exist. |
| Demos depend on local tools or optional packages | Add prerequisites and a fast validation script for each canonical demo. |
| Generated HTML and source Markdown drift | Identify the generator and make one source tree authoritative. |

## Invariant

Every public feature must have one named owner, one stable author contract, one canonical guide page, and one verification path.

The same rule applies to configuration keys, extension capabilities, route families, and demo content.

