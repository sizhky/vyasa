# Vyasa Extension Refactor Audit and Execution Plan

Date: 2026-05-15

This document is the audit and execution plan for turning the current Vyasa
extension work from a file rearrangement into a real developer-facing extension
system.

The current state is not compliant with `docs/grill-sessions/vyasa-extension-contract.md`.
The sharp issue is this: feature code moved under `vyasa/extensions_builtin`, but
most feature ownership did not move behind the extension contract. The result is
a set of folders that look like extensions while `core.py`, `layout_page.py`,
`content_routes.py`, `build.py`, and `markdown/renderer.py` still own the
behavior.

Good extension architecture is like a railway switchyard. Core owns the tracks,
signals, and safety rules. Extensions own trains and cargo. Right now several
extensions are just labels on cargo that still sits in the station office.

## Documents Read

- `CONTEXT.md`
- `docs/adr/0001-modular-extension-architecture.md`
- `docs/grill-sessions/vyasa-extension-contract.md`
- `docs/core-arch-improvement/README.md`
- `docs/core-arch-improvement/content-tree.md`
- `docs/core-arch-improvement/document-pages.md`
- `docs/core-arch-improvement/execution-plan.md`
- `docs/core-arch-improvement/markdown-rendering.md`
- `docs/core-arch-improvement/runtime-routes.md`
- `docs/core-arch-improvement/static-shell.md`
- `/Users/yeshwanth/Code/Personal/pocock-skills/skills/engineering/improve-codebase-architecture/SKILL.md`
- `/Users/yeshwanth/Code/Personal/pocock-skills/skills/engineering/improve-codebase-architecture/LANGUAGE.md`
- `/Users/yeshwanth/Code/Personal/pocock-skills/skills/engineering/improve-codebase-architecture/DEEPENING.md`
- `/Users/yeshwanth/Code/Personal/pocock-skills/skills/engineering/improve-codebase-architecture/INTERFACE-DESIGN.md`
- all top-level Python modules under `vyasa/*.py`
- all current built-in extension modules under `vyasa/extensions_builtin/**`
- current theme selector modules under `vyasa/theme_extensions/**`
- current shared static files under `vyasa/static/**`
- extension and feature tests under `test_*.py` and `tests/*.py`

## Contract Baseline

The extension contract says:

- Extensions describe behavior with Python metadata.
- `.vyasa` selects and configures extensions.
- Extensions register through a restricted `VyasaExtensionApp`, not raw FastHTML
  and not raw `ExtensionRuntime` mutation.
- The app surface includes:
  - `app.routes.add(...)`
  - `app.assets.bundle(...)`
  - `app.markdown.fence(...)`
  - `app.markdown.preprocessor(...)`
  - `app.layout.slot(...)`
  - `app.layout.mode(...)`
  - `app.config.defaults(...)`
  - `app.lifecycle.startup(...)`
  - `app.lifecycle.shutdown(...)`
  - `app.storage.namespace(...)`
- Capability strings validate conflicts and requirements.
- Asset bundles are loaded by page need.
- Storage namespaces give each extension durable local territory.
- A Markdown syntax marker has exactly one owning render extension.
- A route prefix has exactly one owning route extension.
- A slot has exactly one owner.

The current implementation does not provide `VyasaExtension`, does not provide
`VyasaExtensionApp`, does not instantiate extension classes, and lets built-ins
mutate `ExtensionRuntime` directly.

## Current Work That Was Done

These changes are useful but incomplete:

- `vyasa/extensions.py` added `ExtensionMeta`, `ExtensionPlan`,
  `ExtensionRuntime`, asset collection, preset expansion, and metadata
  validation.
- Built-in modules were listed in `vyasa/extensions_builtin/__init__.py`.
- Some feature files were moved under extension-looking folders:
  - markdown renderer/pipeline/tokens
  - tabs
  - tasks
  - slides
  - wikilinks
  - annotations
  - bookmarks
  - mermaid/d2/cytograph wrapper folders
- Theme preset wrappers were collapsed into a selector plus dice behavior.
- Tests still pass at the old behavior level.

This is a staging point, not the target design.

## High-Level Diagnosis

The work took shortcuts in four categories:

1. Runtime shortcut: extensions are plain modules with `META` and `configure()`.
   They do not implement `VyasaExtension`.

2. Registration shortcut: `configure(runtime)` mutates lists and dicts on
   `ExtensionRuntime` directly. That bypasses the restricted app contract and
   cannot validate that a registration is declared in metadata.

3. Ownership shortcut: feature renderers still live in
   `vyasa/extensions_builtin/markdown/renderer.py`. Mermaid, D2, Cytograph, and
   Tasks extensions import private functions from Markdown instead of owning
   their renderers.

4. Asset shortcut: almost all JavaScript and CSS still lives in
   `vyasa/static/scripts.js` and `vyasa/static/header.css`. Extension folders
   may have copied assets, but pages still load the global bundle.

## Architecture Decision Framework

The additional architecture skill adds one strict lens: do not create more files
unless the new module becomes deeper. A deep module gives callers more leverage
through a smaller interface and gives maintainers better locality.

Use these words consistently:

- **Module**: a thing with an interface and implementation.
- **Interface**: everything callers must know to use the module correctly.
- **Implementation**: the code hidden behind the interface.
- **Depth**: leverage at the interface.
- **Seam**: where behavior can change without editing the caller.
- **Adapter**: a concrete implementation plugged into a seam.
- **Leverage**: capability gained per unit of interface learned.
- **Locality**: change and verification concentrated in one place.

This matters because the current extension refactor created many shallow
modules:

- `vyasa/extensions_builtin/mermaid/__init__.py` is shallow because its
  interface is metadata plus direct runtime mutation, while the implementation
  still lives in Markdown.
- `vyasa/extensions_builtin/default_layout.py` is shallow because its
  `configure()` returns nothing and core still assigns the layout renderer.
- `vyasa/theme_extensions/*.py` is shallow because each module repeats a
  two-line adapter with no real extension seam.
- `vyasa/extensions_builtin/tasks/__init__.py` is shallow because it imports
  `_render_tasks_block` and does not own parsing, storage, JavaScript, CSS, or
  page behavior.
- `vyasa/extensions.py` is useful but not yet deep because callers still need to
  know runtime field names and mutate them directly.

### Deletion Test

Apply the deletion test before every move:

1. If deleting a module removes complexity without reappearing elsewhere, the
   module was shallow and should be folded into a deeper owner.
2. If deleting a module spreads complexity across callers, the module is earning
   its keep and should be deepened behind a stable interface.

Current deletion-test results:

- Deleting `vyasa/extensions_builtin/mermaid/__init__.py` would only require
  Markdown to keep doing Mermaid rendering. That proves Mermaid is not yet a real
  extension.
- Deleting `vyasa/theme_extensions/transit_folio.py` would remove almost no
  complexity. Theme variants should be data files behind one theme selector
  extension.
- Deleting `vyasa/static/scripts.js` would break many features at once. That
  proves it hides many unrelated modules and must be split for locality.
- Deleting `vyasa/extensions.py` would scatter config preset and metadata
  validation logic. That proves extension planning is a real core module, but
  its interface must be narrowed.
- Deleting `vyasa/content_tree.py` would scatter core content indexing across
  routes, search, tree rendering, and build. That should remain a core module.
- Deleting `vyasa/search_service.py` would scatter ranking/indexing behavior.
  It should become a search extension implementation behind a search interface,
  not stay a free-floating core helper.

### Real Seams And Hypothetical Seams

The rule is: one adapter means a hypothetical seam; two adapters means a real
seam. Do not introduce an exposed interface unless there are real alternatives.

Real seams in Vyasa:

- Markdown fence rendering: adapters include Mermaid, D2, Cytograph,
  Cryptograph, Tasks, and future fences.
- Layout rendering: adapters include default layout, blog layout, slides layout,
  and future app/document layouts.
- Asset bundles: adapters include shared shell assets and extension assets.
- Search providers: adapters include default text search, future vector search,
  future remote search, and disabled search.
- Theme selection: adapters include multiple theme folders selected by one
  extension.
- Storage namespaces: adapters include bookmarks DB, annotations DB, future task
  state DB, and future user preference DB.
- Document actions: adapters include print, slides, graph view, task extract,
  and future export actions.

Hypothetical seams to avoid:

- One file per theme Python module. Use theme data plus one selector extension.
- One route helper module per tiny route if no alternate route adapter exists.
- One class per Markdown helper if the caller still must know the whole
  rendering sequence.
- One storage abstraction around SQLite if only SQLite exists and tests can use
  a temp SQLite DB.

### Dependency Categories For This Refactor

Use the skill's dependency categories to decide how to test each module:

- In-process:
  - Markdown fences
  - Markdown preprocessors/postprocessors
  - layout slots
  - navigation providers
  - page shell composition
  - theme asset selection
  - content tree projection
  - static build URL rewriting

  These should be tested directly through the extension app/runtime interface.
  No port is needed.

- Local-substitutable:
  - SQLite-backed bookmarks
  - SQLite-backed annotations
  - file search over a temp docs tree
  - static build over a temp output folder
  - config loading from temp `.vyasa` files

  These should be tested with temp files and temp directories. No mock-heavy
  interface is needed.

- Remote but owned:
  - none in the current audited code.

- True external:
  - AI agent provider behavior in `agent.py`, if it remains part of Vyasa.

  This belongs in an optional agent extension with a provider port. Tests should
  use an in-memory adapter. Production can use the real provider adapter.

### Interface Is The Test Surface

Tests must move with the architecture:

- Do not test `render_mermaid_block()` as a private helper called from Markdown.
- Test that enabling `builtin:mermaid` registers a `mermaid` fence and rendering
  a Mermaid fence returns Mermaid HTML.
- Test that disabling `builtin:mermaid` makes a Mermaid fence follow the
  configured unknown-fence behavior.
- Do not test `theme_from_toml("foo")` by importing a per-theme module.
- Test that enabling `builtin:theme_selector` resolves a theme id to asset
  bundles and CSS variables.
- Do not test bookmarks through search/tree internals.
- Test that enabling bookmarks registers storage namespace `bookmarks`, route
  providers, row decorators, and toolbar actions.

### Design Decisions From The Architecture Skill

1. The extension layer must be a deep module.

   Interface:

   ```python
   extension.register(app)
   ```

   Hidden implementation:

   - FastHTML route details
   - runtime field layout
   - asset collection
   - config merge
   - capability validation
   - conflict detection
   - storage namespace path construction
   - page-need asset filtering

   This gives leverage because extension authors learn one interface instead of
   core internals.

2. `VyasaExtensionApp` is the seam, not `ExtensionRuntime`.

   Current modules mutate runtime directly. That makes the interface as complex
   as the implementation. Extensions should only see `VyasaExtensionApp`.

3. Markdown must become a pipeline module, not a feature owner.

   Markdown owns:

   - block parsing sequence
   - inline parsing sequence
   - registry lookup
   - unknown fence behavior
   - final HTML assembly

   Markdown does not own:

   - Mermaid rendering
   - D2 rendering
   - Cytograph rendering
   - Cryptograph rendering
   - Tasks rendering
   - Slides behavior
   - Tabs behavior
   - Wikilink behavior if wikilinks become optional

4. Theme variants are not modules.

   A theme variant has no meaningful interface beyond data. The deep module is
   the theme selector extension. Theme folders are data adapters selected by id.

5. Static assets must follow module ownership.

   If an extension owns behavior, it owns the CSS and JavaScript that implement
   that behavior. Shared shell CSS/JS should only contain truly global shell
   behavior.

6. Route behavior must be registered at extension seams.

   A route extension should register route prefixes, assets, storage, and page
   actions together. Scattering route HTML in core and storage in an extension is
   shallow because maintainers must know both places.

7. Search is a feature extension with core hooks.

   Core can expose content snapshots and request context. Search ranking,
   indexing, pages, and HTTP JSON endpoints should be owned by the default search
   extension.

8. Tree rendering is core only until feature decoration begins.

   The content tree itself is a core content projection. Bookmark markers,
   annotation markers, search highlights, task counts, and file-type actions are
   extension row decorators.

9. Agent support should not stay in core unless it is mandatory.

   If the agent behavior is optional, it should become an extension because it
   crosses a true external dependency. The interface should be a provider port
   with production and test adapters.

10. Auth/RBAC is core policy, but admin UI is an extension.

    Request authentication and authorization checks are core because many routes
    depend on them. Admin pages, invitations UI, and account management pages are
    optional route/layout behavior and should be extension-owned.

### Deepening Opportunities

#### 1. Extension Registration Module

Files:

- `vyasa/extensions.py`
- `vyasa/core.py`
- `vyasa/config.py`
- all `vyasa/extensions_builtin/**/__init__.py`

Problem:

- `ExtensionRuntime` has become the interface.
- Extensions need to know internal runtime field names.
- The contract document promises `VyasaExtensionApp`, but no such module exists.

Solution:

- Deepen `vyasa/extensions.py` into the only extension planning and registration
  module.
- Add `VyasaExtension`, `VyasaExtensionBase`, and `VyasaExtensionApp`.
- Make each extension expose exactly one `EXTENSION` object.
- Call `EXTENSION.register(app)` during runtime assembly.
- Keep `ExtensionRuntime` private to core or make it read-only after freeze.

Benefits:

- Leverage: extension authors learn one interface.
- Locality: capability validation and runtime assembly live in one module.
- Tests: extension behavior is tested through registration output, not through
  private runtime mutation.

#### 2. Markdown Pipeline Module

Files:

- `vyasa/extensions_builtin/markdown/renderer.py`
- `vyasa/extensions_builtin/markdown/pipeline.py`
- `vyasa/extensions_builtin/markdown/tokens.py`
- `vyasa/extensions_builtin/mermaid/**`
- `vyasa/extensions_builtin/d2/**`
- `vyasa/extensions_builtin/cytograph/**`
- `vyasa/extensions_builtin/tasks/**`
- future `vyasa/extensions_builtin/cryptograph/**`

Problem:

- Markdown owns feature renderers and feature fallbacks.
- Render extensions import private Markdown helpers.
- Disabling an extension does not fully remove behavior.

Solution:

- Markdown owns only registry lookup and rendering orchestration.
- Every fence extension owns its own `render.py`, CSS, JS, metadata, and
  registration.
- Markdown receives a fence registry from the frozen extension runtime.

Benefits:

- Leverage: adding a new fence requires no Markdown edits.
- Locality: Mermaid bugs live in Mermaid files.
- Tests: enable/disable behavior is observable through Markdown rendering.

#### 3. Theme Selector Module

Files:

- `vyasa/theme_extensions/**`
- `vyasa/extensions_builtin/theme_selector/**`
- `vyasa/static/themes/**`
- `vyasa/config.py`

Problem:

- Per-theme Python modules are shallow.
- The folder location is outside built-in extensions.
- Theme selection is a config concern plus asset concern, not one module per
  theme.

Solution:

- Create one `builtin:theme_selector` extension.
- Move all theme data under `vyasa/extensions_builtin/theme_selector/themes/`.
- Read theme manifests from TOML or JSON.
- Register selected theme assets through `app.assets.bundle(...)`.

Benefits:

- Leverage: adding a theme becomes adding data, not code.
- Locality: all theme selection rules live in one extension.
- Tests: config theme id maps to assets and variables.

#### 4. Layout Module

Files:

- `vyasa/layout_page.py`
- `vyasa/layout_helpers.py`
- `vyasa/page_shell.py`
- `vyasa/nav_views.py`
- `vyasa/sidebar_helpers.py`
- `vyasa/tree_rendering.py`
- `vyasa/extensions_builtin/default_layout.py`
- `vyasa/extensions_builtin/blog_home.py`

Problem:

- Layout is still core implementation.
- The current default layout extension is only a label.
- Navigation, sidebar, shell, document chrome, and home behavior are scattered.

Solution:

- Create `vyasa/extensions_builtin/default_layout/`.
- Move page shell, layout helpers, nav views, sidebar views, and default tree
  rendering into that extension where they are display behavior.
- Keep core content tree data structures in core.
- Register:
  - layout mode
  - document shell slot
  - nav slot
  - sidebar slot
  - home renderer
  - error renderer

Benefits:

- Leverage: alternate layouts can replace the visual shell without editing core.
- Locality: layout bugs live in layout extension.
- Tests: render a page through layout slot with fake content snapshot.

#### 5. Search Module

Files:

- `vyasa/search_service.py`
- `vyasa/search_http.py`
- `vyasa/search_pages.py`
- `vyasa/search_views.py`
- `vyasa/file_search.py`
- `vyasa/extensions_builtin/default_search.py`

Problem:

- Search files are still core even though search is optional.
- The default search extension does not own routes or ranking.

Solution:

- Create `vyasa/extensions_builtin/default_search/`.
- Move ranking, indexing, result views, HTTP JSON routes, and search pages into
  that extension.
- Core exposes a content snapshot interface.
- Extension registers route prefixes and search provider.

Benefits:

- Leverage: future search providers reuse the same search interface.
- Locality: ranking and UI behavior change together.
- Tests: temp content root plus enabled search extension returns expected pages
  and JSON.

#### 6. Bookmark And Annotation Modules

Files:

- `vyasa/extensions_builtin/bookmarks/**`
- `vyasa/extensions_builtin/annotations/**`
- `vyasa/tree_service.py`
- `vyasa/tree_tables.py`
- `vyasa/search_views.py`
- `vyasa/content_routes.py`

Problem:

- Stores have moved, but UI/route/tree/search behavior still crosses core.
- Bookmarks and annotations need their own DBs and route behavior.

Solution:

- Each extension registers:
  - storage namespace
  - DB initialization lifecycle hook
  - route prefix
  - document toolbar action
  - tree row decorator
  - search result decorator if needed
  - CSS/JS bundle

Benefits:

- Leverage: adding another per-document state feature follows one pattern.
- Locality: DB schema, routes, UI, and assets live together.
- Tests: temp DB proves namespace isolation and route behavior.

#### 7. Static Asset Module

Files:

- `vyasa/assets.py`
- `vyasa/static/scripts.js`
- `vyasa/static/header.css`
- `vyasa/static/flexoki.css`
- `vyasa/static/themes.css`
- every extension static folder

Problem:

- Shared JS/CSS hides many unrelated modules.
- Page assets are not selected by extension-owned page need.

Solution:

- Keep `assets.py` as core asset registry and resolver.
- Move feature CSS/JS into extension folders.
- Add bundle scopes:
  - `global`
  - `document`
  - `search`
  - `admin`
  - `slides`
  - `extension-specific`
- The page shell asks the frozen runtime for required bundles.

Benefits:

- Leverage: feature assets travel with the feature.
- Locality: asset bugs stay near feature code.
- Tests: built pages include only required bundles.

#### 8. Static Build Module

Files:

- `vyasa/build.py`
- `vyasa/core.py`
- `vyasa/assets.py`
- extension asset registrations

Problem:

- Static build reimplements shell assumptions.
- Extension assets and routes are not first-class in static build.

Solution:

- Static build must consume the same frozen runtime as live server.
- It asks route/layout/document/search providers for pages.
- It copies registered asset bundles.
- It does not import extension implementation files directly.

Benefits:

- Leverage: live and static output share extension ownership.
- Locality: adding an extension requires one registration path.
- Tests: parity test compares live HTML and static HTML for selected pages.

#### 9. Admin UI Module

Files:

- `vyasa/admin_views.py`
- `vyasa/auth/**`
- `vyasa/rbac_config.py`
- `vyasa/rbac_store.py`

Problem:

- RBAC policy is core, but admin UI is optional feature behavior.
- Keeping both together makes the auth seam too wide.

Solution:

- Keep auth/RBAC checks and stores in core.
- Move admin pages and assets into `builtin:admin`.
- Admin extension declares route prefix and required RBAC capability.

Benefits:

- Leverage: core policy remains small and reusable.
- Locality: admin page behavior is isolated.
- Tests: core auth tests do not need admin HTML; admin tests use fake users.

#### 10. Agent Module

Files:

- `vyasa/agent.py`
- any routes or UI that call it

Problem:

- Agent behavior likely depends on true external providers.
- It does not belong in mandatory core unless every Vyasa site needs it.

Solution:

- Move to `builtin:agent` or keep disabled by default.
- Define a provider port at the extension seam.
- Use an in-memory adapter in tests.
- Use provider adapters only inside the extension.

Benefits:

- Leverage: agent features become optional without core imports.
- Locality: provider-specific behavior stays in one extension.
- Tests: no network dependency in core tests.

## Non-Negotiable Rules For The Next Refactor

1. No built-in extension may import a private renderer/helper from a sibling
   extension.

2. No extension may mutate `ExtensionRuntime` directly.

3. No extension may register routes against raw `rt` or raw FastHTML.

4. No feature-specific UI JavaScript may remain in the global `scripts.js` once
   that feature is an extension.

5. No feature-specific CSS may remain in global `header.css` once that feature
   is an extension.

6. A render extension owns its fence parser, renderer, CSS, JavaScript, config,
   and tests.

7. A route extension owns its route handlers, permission checks, response shape,
   storage namespace requests, CSS, JavaScript, and tests.

8. Core may expose contracts. Core must not know that "Mermaid", "Tasks",
   "Bookmarks", or "Slides" exist.

9. Any fallback behavior must go through the default preset, not hard-coded
   fallback branches in Markdown or core.

10. Move by file operations and function extraction. Avoid retyping large code.

## Current Contract Violations

### `VyasaExtension` Does Not Exist

Observed:

- `docs/grill-sessions/vyasa-extension-contract.md` sketches
  `class SlidesExtension(VyasaExtension)`.
- `rg "VyasaExtension"` finds only the docs.
- Every built-in uses module-level `META` and `configure(runtime)`.

Required:

- Add a real `VyasaExtension` base class or protocol.
- Built-ins export `EXTENSION = MermaidExtension()` or equivalent.
- Registry loads extension objects, not arbitrary modules.

### `VyasaExtensionApp` Does Not Exist

Observed:

- Extensions receive raw `ExtensionRuntime`.
- `runtime.markdown_fences[...] = ...` is done directly.
- Slots are bare attributes like `runtime.layout_renderer`.
- Asset bundles are registered through `runtime.register_bundle(...)`, when used
  at all.

Required:

- Build a restricted app object.
- Extensions call `app.markdown.fence(...)`, `app.routes.add(...)`,
  `app.assets.bundle(...)`, etc.
- The app validates that registrations match `ExtensionMeta.provides`.

### Extension Metadata Is Too Weak

Observed:

- `ExtensionMeta` has only `id`, `category`, `provides`, `requires`,
  `route_prefixes`, and `scope_disable`.
- There is no config model.
- There is no asset scope.
- There is no lifecycle declaration.
- There is no storage namespace declaration.
- There is no route method declaration.
- There is no extension version.

Required:

- Extend metadata to include:
  - `version`
  - `description`
  - `config_model`
  - `asset_bundles`
  - `storage_namespaces`
  - `scoped_config`
  - `order_constraints`, only where additive order matters

### Core Still Assigns Default Providers After Runtime Build

Observed in `vyasa/core.py`:

- `_extension_runtime = refresh_extension_runtime(...)`
- later:
  - `_extension_runtime.layout_renderer = _default_layout`
  - `_extension_runtime.home_renderer = _default_render_blog_home`
  - `_extension_runtime.error_renderer = _default_not_found`
  - `_extension_runtime.slide_renderer = render_slide_deck`

This bypasses extension ownership. It also means `default_layout.py`,
`blog_home.py`, and `default_errors.py` have `configure()` functions that return
`None`, while core wires the behavior after the fact.

Required:

- Default layout extension registers the layout slot.
- Blog home extension registers the home slot and feed route.
- Default errors extension registers the error slot.
- Slides extension registers `/slides`.
- Core never writes these provider attributes itself.

### Mermaid Extension Does Not Own Mermaid Rendering

Observed in `vyasa/extensions_builtin/mermaid/__init__.py`:

```python
from ..markdown.renderer import _render_mermaid_block
```

Required:

- Move `_render_mermaid_block` into `vyasa/extensions_builtin/mermaid/render.py`.
- Move Mermaid JavaScript from `vyasa/static/scripts.js` into
  `vyasa/extensions_builtin/mermaid/static/mermaid.js`.
- Move Mermaid CSS from `vyasa/static/header.css` and slide-specific Mermaid CSS
  from `vyasa/static/present.css` into Mermaid-owned CSS bundles.
- Register the fence through `app.markdown.fence("mermaid", render_mermaid)`.
- Register `bundle:mermaid.runtime` through `app.assets.bundle(...)`.

### D2 Extension Does Not Own D2 Rendering

Observed in `vyasa/extensions_builtin/d2/__init__.py`:

```python
from ..markdown.renderer import _render_d2_block
```

Required:

- Move `_render_d2_block` into `vyasa/extensions_builtin/d2/render.py`.
- Move D2 JavaScript from `vyasa/static/scripts.js` into
  `vyasa/extensions_builtin/d2/static/d2.js`.
- Move D2 CSS from global files into D2-owned CSS bundles.
- Register the fence and asset bundle through the extension app.

### Cytograph Extension Does Not Own Cytograph Rendering

Observed in `vyasa/extensions_builtin/cytograph/__init__.py`:

```python
from ..markdown.renderer import _render_cytograph_block
```

Required:

- Move `_render_cytograph_block`, `_parse_cytograph_body`, `_clean_scalar`, and
  Cytograph source resolution helpers into the Cytograph extension.
- Keep only generic content URL/path resolver contracts in core.
- Move Cytograph JavaScript and CSS out of global static files.
- Register route or asset needs through the extension app.

### Tasks Extension Does Not Own Tasks Rendering

Observed in `vyasa/extensions_builtin/tasks/__init__.py`:

```python
from ..markdown.renderer import _render_tasks_block
```

Required:

- Move `_render_tasks_block`, task fence frontmatter parsing, href normalization,
  and task graph HTML emission into `vyasa/extensions_builtin/tasks/render.py`.
- Keep `model.py` and `layout.py` under Tasks.
- Move Tasks JavaScript from the top of `vyasa/static/scripts.js` into
  `vyasa/extensions_builtin/tasks/static/tasks.js`.
- Keep `tasks_graph_core.js` under Tasks and serve it through extension assets.
- Move Tasks CSS from `header.css` and inline JavaScript-injected CSS into
  extension CSS.
- Register both `items` and `tasks` fences, and declare both capabilities:
  - `cap:markdown:fence:items`
  - `cap:markdown:fence:tasks`

### Cryptograph Has No Extension

Observed:

- `_render_cryptograph_block` lives in Markdown renderer.
- There is no `vyasa/extensions_builtin/cryptograph`.
- It is not in the default preset render list.

Required:

- Create `vyasa/extensions_builtin/cryptograph/`.
- Move `_render_cryptograph_block` into it.
- Add `META`/extension object with `cap:markdown:fence:cryptograph`.
- Move cryptograph JS/CSS out of global static if any behavior exists.
- Add tests that cryptograph disappears or renders as plain code when disabled.

### Markdown Renderer Still Has Hard-Coded Fallbacks For Disabled Extensions

Observed in `ContentRenderer.render_block_code`:

- It checks runtime handlers first.
- Then it still falls back to hard-coded D2, Cytograph, Cryptograph, Mermaid,
  and Tasks renderers.

Required:

- Delete all feature fallback branches.
- If a fence has no registered handler, render it as a normal code block.
- This is the key test that disabled extensions are real.

### Markdown Renderer Imports Extension Implementations

Observed in `vyasa/extensions_builtin/markdown/renderer.py`:

- imports `present_href_for_anchor` from slides
- imports tab preprocess/postprocess
- imports tasks model/layout
- imports wikilinks rewrite

Required:

- Markdown may depend on a core render contract, not feature implementations.
- Slides should register a heading action or document action provider.
- Tabs should register preprocess/postprocess hooks.
- Tasks should register fence handlers.
- Wikilinks should be either core contract or explicit render preprocessor
  extension.

### Wikilinks Are Ambiguous In The Current Language

Observed:

- `CONTEXT.md` currently says core owns wikilinks.
- User request says `wikilinks.py` belongs in extensions.
- Current code has `vyasa/extensions_builtin/wikilinks/rewrite.py`, but Markdown
  imports it directly and always runs it.

Resolution:

- Core should own only the link resolver contract:
  - content slug to route
  - heading anchor resolver
  - ambiguity policy primitive
- `wikilinks` should be a default render extension that registers a markdown
  preprocessor.
- Disabling `wikilinks` should leave `[[...]]` as literal text.

### Asset Bundles Are Mostly Fiction

Observed:

- `AssetBundle` exists.
- `AssetCollector` exists.
- `request_asset_bundle(...)` exists.
- Mermaid/D2/Cytograph/Tasks request bundles, but the bundles are not all
  registered.
- The page shell globally includes `/static/scripts.js`, which imports
  Mermaid, D2, and Tasks code unconditionally.
- `layout_page.py` directly adds `/static/present.css` in slide mode.
- `content_routes.py` directly adds `/static/present.js` in slide pages.

Required:

- Core should serve extension assets under stable URLs:
  `/static/extensions/<extension-id>/<asset>`.
- `app.assets.bundle(...)` registers local files from the extension folder.
- Page rendering emits only requested document bundles.
- Route rendering emits route bundles for the owning extension.
- Global scripts become a small shell bootstrap only.

### Storage Namespaces Are Not Used

Observed:

- Annotations and bookmarks have their store code in extension folders.
- `core.py` still owns `_annotations_store_cache` and `_bookmark_store_cache`.
- Store paths are hard-coded:
  - `.vyasa-annotations.db`
  - `.vyasa-bookmarks.db`
- No extension calls `app.storage.namespace(...)`.

Required:

- Core exposes storage namespace paths.
- Annotations calls `app.storage.namespace()` and gets a path like
  `<root>/.vyasa/extensions/annotations/annotations.sqlite`.
- Bookmarks does the same.
- Old DB paths can be migrated once, but no import shim is required.

### Routes Are Still Core-Owned

Observed in `vyasa/core.py`:

- login routes
- Google OAuth routes
- admin impersonation route
- RBAC admin route
- sidebar routes
- raw markdown route
- search routes
- post static/json/download routes
- annotation route registration
- bookmark route registration
- slides route
- post detail route
- index route
- home feed route
- catch-all route

Required:

- Core should build app, runtime context, auth/RBAC policy, and extension app.
- Route extensions register route prefixes through `app.routes.add(...)`.
- Core validates route conflicts before app startup.

### `theme_extensions` Is In The Wrong Place

Observed:

- `vyasa/theme_extensions` exists beside `vyasa/extensions_builtin`.
- `vyasa/config.py` imports it directly.
- Tests import it directly.

Required:

- Move it to `vyasa/extensions_builtin/themes`.
- Theme selector remains one extension, not one file per theme.
- Dice remains a theme selector behavior under the themes extension folder.
- Raw TOML theme data may stay in `vyasa/themes` until a later asset packaging
  cleanup.

### Static Build Is Not Extension-Aware

Observed in `vyasa/build.py`:

- Static HTML hard-codes CSS, JS, Mermaid script, tabs behavior, KaTeX,
  Highlight.js, sidenotes, and shell.
- It calls `from_md` directly.
- It copies only `vyasa/static`.
- It does not collect extension asset bundles from rendered pages.

Required:

- Static build must use the same extension runtime.
- Static page generation must call the same layout/theme/render contracts.
- It must copy extension static assets.
- It must emit only bundles used by each page or the route.

### Tests Validate Metadata, Not Extension Behavior

Observed:

- `test_extensions.py` validates preset expansion and conflict checks.
- It does not instantiate a `VyasaExtension`.
- It does not validate that `configure()` cannot mutate runtime directly.
- It does not validate that disabled Mermaid renders as code.
- It does not validate extension asset emission.
- It does not validate storage namespace paths.
- It does not validate route registration through extension app.

Required:

- Add tests that prove the contract, not the current adapter behavior.

## Target Folder Shape

Every built-in extension should use this shape:

```text
vyasa/extensions_builtin/<extension_id>/
  __init__.py
  extension.py
  config.py
  render.py
  routes.py
  store.py
  views.py
  static/
    <extension_id>.css
    <extension_id>.js
  tests.md
```

Not every file is required. Empty responsibilities should be absent.

Rules:

- `__init__.py` exports only `EXTENSION`.
- `extension.py` owns the `VyasaExtension` subclass and metadata.
- `render.py` owns markdown renderers.
- `routes.py` owns HTTP handlers.
- `store.py` owns durable state for that extension only.
- `views.py` owns extension-owned FastHTML view fragments.
- `static/` owns browser behavior and CSS for that extension.

## Target Core Shape

Core should end near this shape:

```text
vyasa/
  __init__.py
  app.py                 # app factory, no feature routes
  bootstrap.py           # FastHTML/starlette boot helpers
  config.py              # raw config load, root/folder config merge
  extensions.py          # contract, registry, runtime, app facade
  runtime_context.py     # request/render/runtime context objects
  content_tree.py        # content source contract and default index model
  content_paths.py       # slug/path/url safe primitives
  rbac_policy.py         # core RBAC policy
  rbac_store.py          # core RBAC durable state
  logging.py
  main.py                # CLI only
```

Core should not contain:

- Mermaid
- D2
- Cytograph
- Tasks
- Tabs
- Slides
- Blog home
- Search UI
- Bookmarks
- Annotations
- Theme selector behavior
- Layout HTML
- Navbar HTML
- Sidebar HTML
- Favicon generation, unless kept as a tiny core default asset fallback
- Static build hard-coded page shell

## New Contract To Implement

### `VyasaExtension`

Add this to `vyasa/extensions.py` or split into `vyasa/extensions/contract.py`
after the first green refactor:

```python
class VyasaExtension(Protocol):
    meta: ExtensionMeta

    def register(self, app: VyasaExtensionApp) -> None:
        ...
```

For developer friendliness, prefer a base class:

```python
class VyasaExtensionBase:
    meta: ExtensionMeta

    def register(self, app: VyasaExtensionApp) -> None:
        raise NotImplementedError
```

### `VyasaExtensionApp`

The extension app is the only registration surface given to extensions.

Required namespaces:

- `routes`
- `assets`
- `markdown`
- `layout`
- `config`
- `lifecycle`
- `storage`
- `content`
- `search`
- `navigation`
- `documents`

Minimum V1:

```python
app.routes.add(prefix, handler, methods=("GET",), name=None)
app.assets.bundle(name, css=(), js=(), scope="document")
app.markdown.fence(name, handler)
app.markdown.preprocessor(name, handler, stage="normal")
app.markdown.postprocessor(name, handler, stage="normal")
app.layout.slot(name, provider)
app.layout.mode(name, provider)
app.config.defaults(model)
app.lifecycle.startup(fn)
app.lifecycle.shutdown(fn)
app.storage.namespace(name=None)
```

Add these because current Vyasa needs them:

```python
app.documents.kind(kind, resolver, renderer)
app.documents.action(name, provider)
app.navigation.sidebar_section(name, provider)
app.navigation.sidebar_row_decorator(name, provider)
app.search.provider(name, provider)
app.theme.selector(name, provider)
```

### Registration Validation

When an extension registers something:

- `app.markdown.fence("mermaid", ...)` requires that metadata provides
  `cap:markdown:fence:mermaid`.
- `app.assets.bundle("mermaid.runtime", ...)` requires
  `bundle:mermaid.runtime`.
- `app.layout.slot("layout", ...)` requires `slot:layout`.
- `app.routes.add("/slides", ...)` requires route prefix `/slides` in metadata.
- `app.storage.namespace()` records a namespace under the extension id.

If metadata does not declare the capability, fail at startup.

### Runtime Freeze

After all extensions register:

- Freeze route registry.
- Freeze markdown fence registry.
- Freeze asset bundles.
- Freeze slots.
- Freeze lifecycle hooks.

No code should append to runtime registries after startup.

## Extension Runtime Build Order

1. Load raw root config.
2. Build extension catalog from built-in extension objects.
3. Resolve preset and explicit extension selections.
4. Validate metadata only:
   - unknown ids
   - wrong category
   - duplicate slots
   - duplicate exact capabilities
   - missing requirements
   - duplicate route prefixes
5. Instantiate selected extension objects.
6. Build `VyasaExtensionApp` for each extension.
7. Call `extension.register(app)`.
8. Validate registrations against metadata.
9. Freeze runtime.
10. Mount routes and assets onto FastHTML app.
11. Run startup hooks.

## File-Level Audit And Target Ownership

### `vyasa/__init__.py`

Current:

- Lazy-imports `app`, `rt`, `get_root_folder`, and `get_blog_title` from
  `core.py`.

Problem:

- Keeps `core.py` as public app surface.

Target:

- Export version and stable public API only.
- If app export remains, point to `vyasa.app:create_app` or `vyasa.main:app`.
- Do not expose `rt`.

Action:

- Keep as core.
- Remove `rt` from `__all__` after route registration moves to extensions.

### `vyasa/admin_views.py`

Current:

- Renders RBAC admin form.

Target:

- Move to `vyasa/extensions_builtin/rbac_admin/views.py`.
- RBAC policy can remain core.
- Admin UI is optional route/UI behavior.

Action:

- Create `rbac_admin` route extension.
- Register `/admin/rbac` and `/admin/impersonate`.
- Depend on `cap:auth:session` and `cap:rbac:policy`.

### `vyasa/agent.py`

Current:

- Pydantic AI assistant code.
- Imports `create_core_app`, which is not imported in the file and appears stale.
- Pulls Pydantic AI at import time.

Target:

- Move to `vyasa/extensions_builtin/agent_assistant`.
- Disable by default unless configured.
- Make Pydantic AI dependency optional.

Action:

- Extension metadata:
  - id `agent_assistant`
  - category `route`
  - provides `cap:route:agent_assistant`
  - requires `cap:content:index`
- Register a route only when dependency imports succeed.
- Add graceful startup error if enabled without optional dependency.

### `vyasa/assets.py`

Current:

- Adds mtime cache-busting only for `/static/...` package files.

Target:

- Keep core, but rewrite as extension asset resolver.
- Support:
  - `/static/core/<asset>`
  - `/static/extensions/<extension_id>/<asset>`
  - package data lookup
  - mtime cache token

Action:

- Replace `asset_url(path)` with `runtime.asset_url(bundle_or_path)`.
- Keep a compatibility helper internally only, not as an extension shortcut.

### `vyasa/bootstrap.py`

Current:

- Builds FastHTML app.
- Mounts package static `/static`.
- Defines auth skip routes.

Target:

- Keep core.
- Change static mounting to mount core static plus extension assets.
- `AUTH_SKIP_ROUTES` should be composed from core plus extension route metadata.

Action:

- Add `mount_extension_static(app, runtime)`.
- Add `auth_skip_patterns(runtime)`.

### `vyasa/build.py`

Current:

- Static builder hard-codes shell, CSS, JS, Mermaid, tabs, KaTeX, Highlight.js,
  sidenotes, and static layout.
- Calls `from_md` directly.
- Copies `vyasa/static` only.

Target:

- Split into core static-build runner plus extension-aware page rendering.
- Layout/theme/render/document behavior comes from runtime.

Action:

- Create `vyasa/extensions_builtin/static_build` only if static build should be
  optional. Otherwise keep a core `build.py` runner and delegate all behavior to
  extensions.
- Remove hard-coded Mermaid/Tabs CSS/JS from `generate_static_html`.
- During each page render, collect requested asset bundles.
- Copy extension static files into output.

### `vyasa/config.py`

Current:

- Loads `.vyasa`.
- Owns theme preset loading directly.
- Owns dozens of top-level config getters.
- Imports `theme_extensions`.
- Does not validate `[extensions.config.<id>]`.

Target:

- Core owns raw config loading and root/folder merge.
- Extensions own config models and defaults.
- Theme selector moves under `extensions_builtin/themes`.

Action:

- Move theme import to `vyasa.extensions_builtin.themes`.
- Add:
  - `get_extension_raw_config(extension_id)`
  - `get_extension_folder_config(extension_id, folder)`
  - `get_folder_disabled_extensions(folder)`
- Extension runtime validates config before registration.
- Keep legacy top-level keys by mapping them into default extension config.

### `vyasa/content_routes.py`

Current:

- Renders posts, PDFs, tree files, slides, index, fallback home.
- Imports Markdown private fragment renderer.
- Imports Slides internals.
- Imports Tree renderer.
- Owns document page composition.

Target:

- Split into:
  - `filesystem` content source extension
  - `documents` route extension
  - `pdf_document` extension or document kind provider
  - `tree_document` extension or document kind provider
  - `slides` route extension
  - `blog_home` home extension

Action:

- Move `render_slide_deck` into `extensions_builtin/slides/routes.py`.
- Move `_fallback_home_markdown` into `blog_home`.
- Move `_breadcrumbs`, `_prev_next_nav`, and document actions into a document
  extension.
- Replace `_render_markdown_fragment` import with `app.markdown.render_fragment`
  contract.

### `vyasa/content_tree.py`

Current:

- Strong candidate for core.
- Resolves content entries from filesystem.
- Still knows fixed document kinds `.md`, `.pdf`, `.tree`.

Target:

- Core owns content tree contract and generic entry model.
- Filesystem extension provides default content source.
- Document kind extensions register suffixes and renderers.

Action:

- Keep `ContentTree` in core but make `allowed_suffixes` come from runtime
  document kind registry.
- Move folder note policy to filesystem content source extension if it becomes
  replaceable.
- Keep RBAC visibility hook in core.

### `vyasa/core.py`

Current:

- 1285 lines.
- Owns app globals, config globals, auth globals, RBAC store cache,
  annotations/bookmarks caches, routes, search, layout default, home default,
  sidebars, tree rendering, favicon routes, live reload, and extension fallbacks.

Target:

- `core.py` should either disappear or become a small app factory.

Action:

- Create `vyasa/app.py`.
- Move current app assembly into `create_app(config=None)`.
- Build runtime before route mount.
- Give extensions `VyasaExtensionApp`.
- Delete feature route functions from core as each extension takes ownership.
- End state target: less than 250 lines.

### `vyasa/document_pages.py`

Current:

- Owns document header, copy buttons, present button, frontmatter metadata UI,
  and frontmatter error UI.

Target:

- Move to `vyasa/extensions_builtin/documents`.
- Present button should be contributed by Slides as a document action provider,
  not hard-coded.

Action:

- Add `app.documents.action("present", provider)` in Slides.
- Documents extension asks runtime for document actions.

### `vyasa/extensions.py`

Current:

- Metadata and runtime data bag.
- No extension base class.
- No app facade.
- No registration validation.
- No storage namespace.
- No extension config validation.
- No lifecycle.

Target:

- This becomes the real contract.

Action:

- Add `VyasaExtension`.
- Add `VyasaExtensionApp`.
- Add namespace registries.
- Freeze runtime after registration.
- Remove public mutable runtime lists from extension access.

### `vyasa/favicon.py`

Current:

- Generates deterministic favicon.
- Core routes serve `/static/icon.png` or generated SVG.

Target:

- Either core fallback asset provider or `default_favicon` extension.

Action:

- If extension:
  - id `default_favicon`
  - category `route` or `layout`
  - provides `cap:asset:favicon`
  - registers `/static/icon.svg`
  - layout extension asks asset provider for favicon href.

### `vyasa/file_search.py`

Current:

- Search indexing and fuzzy matching over files.
- Uses filesystem-specific ignore/include logic.

Target:

- Move to `default_search`.

Action:

- `default_search` registers:
  - search index provider
  - sidebar search UI
  - `/search/gather`
  - `/search/preview`
  - `/_sidebar/posts/search`

### `vyasa/helpers.py`

Current:

- Large mixed bag:
  - title formatting
  - content mounts
  - slug/path/url helpers
  - frontmatter parsing
  - markdown preview
  - read-time
  - folder ordering
  - `.vyasa` folder config
  - post listing
  - folder note lookup

Target:

- Split by contract, not by convenience.

Action:

- Keep in core:
  - safe path primitives
  - slug/url encoding primitives
  - heading anchor primitive
  - raw folder config loader
- Move to filesystem/documents extensions:
  - `get_content_mounts`
  - `content_path_for_slug`
  - `content_slug_for_path`
  - `content_root_and_relative`
  - `find_folder_note_file`
  - `list_vyasa_posts`
  - `list_vyasa_entries`
  - folder ordering policy
- Move to markdown/documents:
  - frontmatter parsing
  - title resolution
  - read-time
  - preview markdown

### `vyasa/layout_helpers.py`

Current:

- Layout width and theme token config.

Target:

- Move to `default_layout` and `themes`.

Action:

- `default_layout` owns width/sidebar config.
- `themes` owns theme token config.
- Core passes validated config into the layout provider.

### `vyasa/layout_page.py`

Current:

- Owns full page shell, HTMX layout fragments, navbar/sidebar/footer, annotation
  data attributes, slide asset inclusion, theme font links.

Target:

- Move to `default_layout`.
- Annotation data attrs are contributed by Annotations extension.
- Slide assets are contributed by Slides extension.
- Theme font links are contributed by Themes extension.

Action:

- Create `vyasa/extensions_builtin/default_layout/render.py`.
- Move `render_layout`, `_render_htmx_layout`, `_render_full_layout`,
  `_theme_font_links`, `_section_class`.
- Replace `_annotation_attrs` with layout hooks:
  `app.layout.main_attrs(provider)`.
- Replace slide asset branch with route/layout mode bundle request.

### `vyasa/logging.py`

Current:

- Core logging setup.

Target:

- Keep core.
- Extensions can request named loggers through context.

Action:

- Add extension id to error/log context.

### `vyasa/main.py`

Current:

- CLI, config reload, runtime refresh, uvicorn launch, browser open.

Target:

- Keep CLI core.
- Remove repeated raw `refresh_extension_runtime` calls once app factory owns
  runtime creation.

Action:

- CLI sets env/args.
- `create_app()` builds runtime exactly once per worker process.

### `vyasa/nav_views.py`

Current:

- Navbar HTML.

Target:

- Move to `default_layout`.

Action:

- Layout extension owns navbar rendering.
- Theme toggle is a theme extension contribution, not a core callback.

### `vyasa/page_shell.py`

Current:

- Static shell renderer.

Target:

- Move to `default_layout` or static-build integration.

Action:

- Static build should use layout provider, not duplicate shell.

### `vyasa/page_views.py`

Current:

- 404 page content.

Target:

- Move to `default_errors`.

Action:

- Default errors extension registers error slot.

### `vyasa/rbac_config.py`

Current:

- Normalizes RBAC config and writes `.vyasa`.

Target:

- Keep RBAC policy/storage core.
- Admin UI can be an extension.

Action:

- Leave core until a separate auth/RBAC contract exists.
- Do not move RBAC policy into optional extension because `CONTEXT.md` says RBAC
  remains core.

### `vyasa/rbac_store.py`

Current:

- Stores RBAC config in SQLite.

Target:

- Keep core.

Action:

- May use the same storage namespace mechanism internally later, but not an
  optional extension.

### `vyasa/runtime_context.py`

Current:

- Thin request/runtime wrapper for route modules.

Target:

- Keep core, expand into formal contexts:
  - `VyasaRuntimeContext`
  - `VyasaRequestContext`
  - `VyasaRenderContext`
  - `VyasaStorageNamespace`

Action:

- Extensions receive context objects, not loose callbacks.

### `vyasa/search_http.py`

Current:

- Search route response assembly.

Target:

- Move to `default_search`.

Action:

- Register search routes via extension app.

### `vyasa/search_pages.py`

Current:

- Gather search results page.

Target:

- Move to `default_search`.

Action:

- Search extension owns copy-all search page.

### `vyasa/search_service.py`

Current:

- Query parsing and cached search wrapper.

Target:

- Move to `default_search`, except generic cache helper if reused.

Action:

- Search extension owns regex/fuzzy query behavior.

### `vyasa/search_views.py`

Current:

- Search result UI.
- Directly imports bookmark toggle.

Problem:

- Search has a cross seam into Bookmarks.

Target:

- Search extension renders search rows.
- Bookmarks extension registers a row decorator or document action provider.

Action:

- Add `app.navigation.row_decorator("bookmark_toggle", provider)` or a more
  generic `app.documents.action`.
- Search asks runtime for decorators instead of importing Bookmarks.

### `vyasa/sidebar_helpers.py`

Current:

- Sidebar UI, TOC extraction, custom CSS discovery/scoping.

Target:

- Move sidebar rendering into `default_layout`.
- TOC extraction belongs to documents/markdown contract.
- Custom CSS may be a `custom_css` theme/layout extension.

Action:

- Split:
  - sidebar components -> default_layout
  - TOC extraction -> documents or markdown
  - custom CSS discovery -> themes/custom_css extension

### `vyasa/tree_rendering.py`

Current:

- Renders file tree.
- Directly imports bookmark toggle.

Problem:

- Tree has a cross seam into Bookmarks.

Target:

- Move to filesystem or default_layout navigation extension.
- Bookmarks registers row decorator.

Action:

- Replace `_bookmarkable_row` and `_bookmarkable_tree_row` with runtime row
  decorators.

### `vyasa/tree_service.py`

Current:

- Thin wrapper around `ContentTree`.

Target:

- Merge into filesystem content source or `ContentTree`.

Action:

- Remove after content source contract is real.

### `vyasa/tree_tables.py`

Current:

- Parses and renders `.tree` files.

Target:

- Move to `tree_document` extension.

Action:

- Register document kind:
  - suffix `.tree`
  - kind `tree`
  - renderer `render_tree_table_html`

### `vyasa/auth/*`

Current:

- Auth and RBAC support modules are already in an `auth` package.

Target:

- Core owns auth/RBAC enforcement.
- Optional auth providers can later become extensions.

Action:

- Do not move policy enforcement out of core now.
- Move only admin UI routes into `rbac_admin` extension.
- Keep Google OAuth route provider core until an auth-provider extension contract
  exists.

### `vyasa/static/scripts.js`

Current:

- 6310 lines.
- Contains Tasks, Mermaid, D2, Cytograph, tabs, theme switching, sidebar,
  search, bookmarks, annotations, PDF focus, iframe fullscreen, JSON focus,
  headings, code copy, KaTeX, Highlight.js, HTMX swap handlers, mobile menus.

Target:

- Keep only core shell bootstrap if needed.
- Split per extension:
  - tasks/static/tasks.js
  - mermaid/static/mermaid.js
  - d2/static/d2.js
  - cytograph/static/cytograph.js
  - tabs/static/tabs.js
  - themes/static/theme-debug.js
  - default_layout/static/layout.js
  - default_search/static/search.js
  - bookmarks/static/bookmarks.js
  - annotations/static/annotations.js
  - documents/static/documents.js
  - pdf_document/static/pdf.js
  - iframe_embed/static/iframe.js
  - math/static/math.js
  - code_highlight/static/code-highlight.js

Action:

- Cut sections with `awk` by function names and top-level sentinels.
- Keep global event orchestration small:
  - `vyasa:init`
  - `vyasa:after-swap`
  - `vyasa:theme-change`
- Extensions listen to these events in their own JS.

### `vyasa/static/header.css`

Current:

- 1160 lines.
- Contains global shell, theme variables, sidebars, bookmarks, tabs, PDF focus,
  iframe fullscreen, code blocks, KaTeX, search, layout, and feature styles.

Target:

- Split by extension.
- Core CSS should only include reset variables and event-shell hooks if needed.

Action:

- Move feature selectors by prefix.
- If a selector references an extension class, it belongs to that extension.

### `vyasa/static/present.css` And `present.js`

Current:

- Shared static path.
- Slides extension has copies under its folder, but runtime still uses
  `/static/present.css` and `/static/present.js`.

Target:

- Served only from Slides extension asset bundle.

Action:

- Delete global present files after route uses extension asset URLs.

### `vyasa/theme_extensions/*`

Current:

- Theme selector lives outside `extensions_builtin`.

Target:

- `vyasa/extensions_builtin/themes`.

Action:

- Move files:
  - `theme_extensions/base.py` -> `extensions_builtin/themes/base.py`
  - `theme_extensions/selector.py` -> `extensions_builtin/themes/selector.py`
  - `theme_extensions/dice.py` -> `extensions_builtin/themes/dice.py`
  - `theme_extensions/__init__.py` -> `extensions_builtin/themes/__init__.py`
- Update imports in `config.py` and tests.
- Then wrap as real `ThemesExtension`.

## Built-In Extension Inventory

### `markdown`

Category:

- Core-adjacent render contract, currently built-in extension.

Should own:

- Mistletoe renderer setup.
- Core Markdown syntax:
  - paragraphs
  - headings
  - links
  - images
  - code blocks
  - tables
  - inline tokens
  - footnotes
  - callouts if kept default
  - code includes if kept default

Should not own:

- Mermaid
- D2
- Cytograph
- Tasks
- Cryptograph
- Tabs
- Slides actions
- Wikilinks if user wants it optional

Plan:

- Rename current `from_md` to a renderer service behind `app.markdown.render`.
- Make feature hooks external.
- Delete all hard-coded feature fallback branches.

### `tabs`

Should own:

- `preprocess_tabs`
- `postprocess_tabs`
- tab CSS
- tab JS

Plan:

- Register preprocessor and postprocessor through extension app.
- Remove direct imports from Markdown.

### `mermaid`

Should own:

- fence parser
- render HTML
- Mermaid JS lifecycle
- zoom/fullscreen controls
- CSS

Plan:

- Extract `_render_mermaid_block`.
- Extract all Mermaid JS from `scripts.js`.
- Register `bundle:mermaid.runtime`.

### `d2`

Should own:

- fence parser
- render HTML
- D2 JS import/lifecycle
- zoom/fullscreen controls
- CSS

Plan:

- Extract `_render_d2_block`.
- Extract all D2 JS from `scripts.js`.
- Register `bundle:d2.runtime`.

### `cytograph`

Should own:

- fence parser
- `.cytree` or JSON source loading behavior
- graph payload shape
- JS renderer
- CSS

Plan:

- Extract Cytograph renderer helpers.
- Register `bundle:cytograph.runtime`.

### `tasks`

Should own:

- `items` and `tasks` fences
- task model/parser
- collapsed graph layout
- React Flow runtime
- task persistence route if still present or future
- CSS/JS

Plan:

- Move `_render_tasks_block`.
- Move all Tasks JS and CSS.
- Register both fence capabilities.

### `cryptograph`

Should own:

- `cryptograph` fence.
- any reveal/check UI.

Plan:

- Create extension from current Markdown private renderer.

### `slides`

Should own:

- `/slides` routes.
- slide splitting.
- slide navigation.
- slide asset bundles.
- document action for "Present".
- heading action for "Present from here".

Plan:

- Move route function out of `content_routes.py`.
- Move `present_href_for_anchor` usage out of Markdown heading rendering.
- Add a document/heading action contract.

### `default_layout`

Should own:

- page shell
- navbar
- sidebars
- mobile panels
- footer
- TOC placement
- layout CSS/JS

Plan:

- Move `layout_page.py`, `layout_helpers.py`, `nav_views.py`,
  relevant `sidebar_helpers.py`, and `page_shell.py`.

### `themes`

Should own:

- theme preset selector.
- dice selector.
- font links.
- theme debug UI.
- code theme link selection if treated as theme behavior.

Plan:

- Move `theme_extensions` under built-ins.
- Convert to real extension.
- Keep TOML files in `vyasa/themes` for now.

### `blog_home`

Should own:

- fallback home page.
- blog feed cards.
- home feed route.
- home sort.

Plan:

- Move current `core.py` home functions into extension.
- Register `slot:home`.
- Register route `/_home/feed`.

### `default_search`

Should own:

- file search index.
- sidebar search UI.
- gather page.
- preview page.
- search routes.
- search JS/CSS.

Plan:

- Move `file_search.py`, `search_*`, and search static code.
- Replace bookmark import with row decorator hook.

### `bookmarks`

Should own:

- bookmark store.
- bookmark routes.
- bookmark sidebar section.
- bookmark row decorators.
- bookmark JS/CSS.
- storage namespace.

Plan:

- Move route registration out of core.
- Add `app.storage.namespace`.
- Add navigation decorator contract.

### `annotations`

Should own:

- annotation store.
- annotation routes.
- annotation main-content attributes.
- annotation JS/CSS.
- storage namespace.

Plan:

- Move route registration out of core.
- Add layout main-attrs hook.
- Add `bundle:annotations.runtime`.

### `filesystem`

Should own:

- default content source.
- raw markdown route.
- static attachment route.
- JSON attachment route.
- download route.
- folder note policy if made replaceable.

Plan:

- Register content source.
- Register file routes.
- Expose content path resolver through core contract.

### `documents`

Should own:

- document shell content.
- breadcrumbs.
- copy raw markdown.
- copy relative path.
- metadata chips.
- frontmatter error display.
- previous/next.

Plan:

- Move `document_pages.py`.
- Register document actions from other extensions.

### `tree_document`

Should own:

- `.tree` parsing/rendering.

Plan:

- Move `tree_tables.py`.
- Register `.tree` document kind.

### `pdf_document`

Should own:

- PDF render route behavior.
- PDF focus controls.
- PDF CSS/JS.

Plan:

- Extract PDF branch from `render_post_detail`.

### `live_reload`

Should own:

- `/_vyasa/reload`.
- live reload script injection.

Plan:

- Make it route extension or development extension.
- Enable through config/CLI.

### `code_highlight`

Should own:

- Highlight.js CSS links.
- Highlight.js script.
- code copy button behavior.
- line number highlighting if kept.

Plan:

- Extract code-related CSS/JS and renderer hooks.

### `math`

Should own:

- KaTeX CSS/JS.
- math render client behavior.

Plan:

- Extract KaTeX assets and `renderMathSafely`.

### `embeds`

Should own:

- YouTube embeds.
- iframe embeds.
- download inline embed if treated as markdown syntax.
- iframe fullscreen JS/CSS.

Plan:

- Split into `youtube_embed`, `iframe_embed`, `download_embed`, or one
  `embeds` extension.

## Mechanical Migration Plan

### Phase 0: Freeze Current Behavior

Goal:

- Make sure future moves can prove old behavior stays intact.

Steps:

1. Run full test suite.
2. Add missing tests before moving code:
   - disabled Mermaid renders as code
   - disabled D2 renders as code
   - disabled Cytograph renders as code
   - disabled Tasks renders as code
   - disabled Tabs leaves tab syntax unprocessed
   - disabled Wikilinks leaves `[[target]]` literal
   - default preset keeps old behavior
   - minimal preset boots with no render extensions
   - asset bundle emitted only when fence is present
   - extension route conflict fails before app startup
   - storage namespace path is extension-scoped
3. Do not add compatibility shims.

Verification:

```bash
pytest -q
python -m compileall vyasa
```

### Phase 1: Build The Real Contract

Goal:

- Add contract without moving features.

Files:

- `vyasa/extensions.py`
- `test_extensions.py`

Steps:

1. Add `VyasaExtensionBase`.
2. Add `VyasaExtensionApp`.
3. Add namespace classes:
   - `RouteRegistry`
   - `AssetRegistry`
   - `MarkdownRegistry`
   - `LayoutRegistry`
   - `ConfigRegistry`
   - `LifecycleRegistry`
   - `StorageRegistry`
   - `DocumentRegistry`
   - `NavigationRegistry`
4. Add registration validation against `ExtensionMeta.provides`.
5. Make `ExtensionRuntime` hold frozen registries.
6. Keep old direct runtime fields temporarily only as adapter output from the
   app facade.
7. Add tests that extension code cannot register undeclared capabilities.

Acceptance:

- No built-in must be moved yet.
- Tests prove the app facade exists and rejects invalid registrations.

### Phase 2: Convert Built-In Registry To Extension Objects

Goal:

- Replace module-level `META` and `configure(runtime)` with extension objects.

Files:

- `vyasa/extensions_builtin/**/extension.py`
- `vyasa/extensions_builtin/__init__.py`
- `vyasa/extensions.py`

Steps:

1. For each built-in, add `extension.py`.
2. Move `META` into `class <Name>Extension(VyasaExtensionBase)`.
3. Implement `register(self, app)`.
4. Export `EXTENSION` from `__init__.py`.
5. Change `BUILTIN_EXTENSION_MODULES` to `BUILTIN_EXTENSIONS`.
6. Delete `configure(runtime)` once all runtime writes are behind app facade.

Acceptance:

- `rg "def configure\\(" vyasa/extensions_builtin` returns no results.
- `rg "runtime\\.markdown_fences|runtime\\.layout_renderer|runtime\\.home_renderer|runtime\\.error_renderer|runtime\\.slide_renderer" vyasa/extensions_builtin` returns no results.

### Phase 3: Move Themes Under Built-In Extensions

Goal:

- Fix wrong folder shape before deeper work.

Commands:

```bash
mkdir -p vyasa/extensions_builtin/themes
mv vyasa/theme_extensions/base.py vyasa/extensions_builtin/themes/base.py
mv vyasa/theme_extensions/selector.py vyasa/extensions_builtin/themes/selector.py
mv vyasa/theme_extensions/dice.py vyasa/extensions_builtin/themes/dice.py
mv vyasa/theme_extensions/__init__.py vyasa/extensions_builtin/themes/__init__.py
```

Follow-up:

- Update imports:
  - `vyasa/config.py`
  - `tests/test_theme_extensions.py`
- Add `vyasa/extensions_builtin/themes/extension.py`.
- Register theme selector as `slot:theme`.
- Delete empty `vyasa/theme_extensions` directory.

Acceptance:

- `rg "theme_extensions" vyasa tests` returns no results.
- Theme tests pass.

### Phase 4: Extract Diagram Renderers From Markdown

Goal:

- Mermaid, D2, Cytograph own their renderers.

Mermaid cut:

```bash
mkdir -p vyasa/extensions_builtin/mermaid/static
awk '/^def _render_mermaid_block/{flag=1} /^def _render_tasks_block/{flag=0} flag' vyasa/extensions_builtin/markdown/renderer.py > /tmp/mermaid_render.py
```

Then paste into `vyasa/extensions_builtin/mermaid/render.py` and add local
imports for `html`, `re`, `_escape_attr` equivalent if needed, and a local id
generator.

D2 cut:

```bash
mkdir -p vyasa/extensions_builtin/d2/static
awk '/^def _render_d2_block/{flag=1} /^def _render_mermaid_block/{flag=0} flag' vyasa/extensions_builtin/markdown/renderer.py > /tmp/d2_render.py
```

Cytograph cut:

```bash
mkdir -p vyasa/extensions_builtin/cytograph/static
awk '/^def _clean_scalar/{flag=1} /^def _render_cryptograph_block/{flag=0} flag' vyasa/extensions_builtin/markdown/renderer.py > /tmp/cytograph_render.py
```

After paste:

- Change imports in extension registration to local `from .render import ...`.
- Delete original functions from Markdown after tests pass.
- Delete hard-coded fallback branches in `render_block_code`.

Acceptance:

- `rg "_render_mermaid_block|_render_d2_block|_render_cytograph_block" vyasa/extensions_builtin/markdown/renderer.py` returns no results.
- `rg "from ..markdown.renderer" vyasa/extensions_builtin/mermaid vyasa/extensions_builtin/d2 vyasa/extensions_builtin/cytograph` returns no results.

### Phase 5: Extract Tasks Rendering From Markdown

Goal:

- Tasks extension owns all task fence behavior.

Cut:

```bash
mkdir -p vyasa/extensions_builtin/tasks/static
awk '/^def _resolve_items_node_href/{flag=1} /^def _clean_scalar/{flag=0} flag' vyasa/extensions_builtin/markdown/renderer.py > /tmp/tasks_render_helpers.py
awk '/^def _render_tasks_block/{flag=1} /^def _clean_scalar/{flag=0} flag' vyasa/extensions_builtin/markdown/renderer.py > /tmp/tasks_render.py
```

Move:

- `_resolve_items_node_href`
- `_normalize_items_model_hrefs`
- `_split_fence_frontmatter` if not shared
- `_render_tasks_block`

Then:

- If `_split_fence_frontmatter` is needed by multiple extensions, move it to a
  core markdown utility with a public name, not a private Markdown renderer
  function.
- Register `items` and `tasks` separately.
- Delete fallback branches from Markdown.

Acceptance:

- `rg "_render_tasks_block|parse_tasks_text|build_collapsed_graph" vyasa/extensions_builtin/markdown/renderer.py` returns no results.

### Phase 6: Create Cryptograph Extension

Goal:

- No hidden render feature remains inside Markdown.

Cut:

```bash
mkdir -p vyasa/extensions_builtin/cryptograph/static
awk '/^def _render_cryptograph_block/{flag=1} /^class ContentRenderer/{flag=0} flag' vyasa/extensions_builtin/markdown/renderer.py > /tmp/cryptograph_render.py
```

Then:

- Create `vyasa/extensions_builtin/cryptograph/render.py`.
- Create `extension.py`.
- Add to default render preset.
- Add disabled behavior tests.

Acceptance:

- `rg "_render_cryptograph_block" vyasa/extensions_builtin/markdown/renderer.py` returns no results.

### Phase 7: Make Markdown A Pure Pipeline Host

Goal:

- Markdown renderer owns the pipeline, not feature implementations.

Steps:

1. Remove direct imports:
   - `..tabs.render`
   - `..tasks.layout`
   - `..tasks.model`
   - `..slides.deck`
   - `..wikilinks.rewrite`
2. Replace tabs with registered preprocess/postprocess hooks.
3. Replace wikilinks with registered preprocessor.
4. Replace slide heading action with a heading action registry.
5. Replace task/diagram fallbacks with normal code rendering.
6. Expose public helper:
   - `render_fragment(markdown, context)`
   - `parse_fence_frontmatter(text)`
   - `escape_html_attr(value)`

Acceptance:

- `rg "extensions_builtin\\.(tasks|tabs|slides|wikilinks|mermaid|d2|cytograph|cryptograph)" vyasa/extensions_builtin/markdown` returns no results.
- Markdown tests cover disabled feature behavior.

### Phase 8: Split Global JavaScript Into Extension Assets

Goal:

- Global JS stops being the feature junk drawer.

Cut order:

1. Tasks: lines around task constants through `openTasksFullscreen`.
2. D2: D2 import and D2 functions.
3. Mermaid: Mermaid import and Mermaid functions.
4. Tabs: `switchTab`, `initTabPanelHeights`.
5. Themes: theme debug functions.
6. Sidebar/layout: sidebar reveal, mobile menus, keyboard shortcuts.
7. Search: search persistence, command palette if search-owned.
8. Bookmarks.
9. Annotations.
10. Documents: code copy, heading permalink, PDF focus, iframe fullscreen,
    JSON focus.
11. Math/code highlight.

Use marker extraction. Example:

```bash
awk '/^const vyasaBookmarks/{flag=1} /^function loadSidebarFolderBranch/{flag=0} flag' vyasa/static/scripts.js > vyasa/extensions_builtin/bookmarks/static/bookmarks.js
```

After each cut:

- Register a bundle.
- Request the bundle from renderer/route/layout.
- Remove the copied section from `scripts.js`.
- Run browser smoke test if UI changed.

Acceptance:

- `vyasa/static/scripts.js` is under 500 lines or deleted.
- No extension-specific selectors remain in global JS.

### Phase 9: Split Global CSS Into Extension Assets

Goal:

- CSS ownership matches feature ownership.

Move by selector:

- `.tabs-*` -> Tabs.
- `.mermaid-*`, `.mermaidTooltip` -> Mermaid.
- `.d2-*` -> D2.
- `.cytograph-*` -> Cytograph.
- `.tasks-*`, `.vyasa-tasks-*` -> Tasks.
- `.vyasa-bookmark-*` -> Bookmarks.
- annotation/sidenote reply rules -> Annotations.
- `.pdf-focus`, `.pdf-viewer` -> PDF document.
- `.iframe-fullscreen-*` -> iframe embed.
- `.posts-search-*`, command palette search result rules -> Search.
- `.vyasa-sidebar-*`, navbar/footer/mobile panels -> Default layout.
- `.vyasa-code-*`, `.code-block`, `.code-copy-button` -> Code highlight/documents.
- `.katex-*` -> Math.
- `.vyasa-zen-*`, `.vyasa-reveal-*` -> Slides.

Acceptance:

- `header.css` contains only core variables or is owned by default layout.
- Feature extension CSS sits beside feature JS.

### Phase 10: Move Default Layout

Goal:

- Core does not render page shell.

Steps:

1. Move `layout_page.py` into `default_layout/render.py`.
2. Move `layout_helpers.py` into `default_layout/config.py`.
3. Move `nav_views.py` into `default_layout/nav.py`.
4. Move layout-owned parts of `sidebar_helpers.py`.
5. Register `slot:layout`.
6. Register global layout CSS/JS bundles.
7. Replace core `layout()` with runtime slot lookup only.

Acceptance:

- `rg "_default_layout|render_layout|navbar_view" vyasa/core.py` returns no
  feature implementation, only slot invocation.

### Phase 11: Move Blog Home

Goal:

- Home feed is a real home extension.

Move from `core.py`:

- `iter_blog_home_files`
- `_default_render_blog_home`
- `render_blog_home`
- `_render_blog_preview_card`
- `render_blog_home_feed`
- `render_search_preview_feed` if search owns preview, move to search instead
- `_sort_blog_home_entries`
- `_blog_home_is_ignored`
- `home_feed`

Target:

- `vyasa/extensions_builtin/blog_home/extension.py`
- `vyasa/extensions_builtin/blog_home/routes.py`
- `vyasa/extensions_builtin/blog_home/views.py`

Acceptance:

- Core has no blog-feed card rendering.
- Home extension registers `slot:home` and `/_home/feed`.

### Phase 12: Move Search

Goal:

- Search is a real extension, not core sidebar support.

Move:

- `file_search.py`
- `search_http.py`
- `search_pages.py`
- `search_service.py`
- `search_views.py`
- search JS/CSS

Target:

- `vyasa/extensions_builtin/default_search/`

Fix cross seam:

- Remove direct bookmark import from search views.
- Use navigation/document row decorators.

Acceptance:

- `rg "search_" vyasa/core.py` finds only route dispatch through runtime, then
  eventually no search code.

### Phase 13: Move Bookmarks Fully

Goal:

- Bookmarks owns routes, store, view decorators, sidebar section, assets.

Steps:

1. Move core store cache into extension store object.
2. Register storage namespace.
3. Register routes:
   - `/api/bookmarks`
   - `/api/bookmarks/{path:path}`
4. Register sidebar section provider.
5. Register row decorator for tree/search rows.
6. Register `bundle:bookmarks.runtime`.
7. Move CSS/JS.

Acceptance:

- `core.py`, `tree_rendering.py`, and `search_views.py` do not import
  `bookmarks`.

### Phase 14: Move Annotations Fully

Goal:

- Annotations owns routes, store, layout attrs, and assets.

Steps:

1. Move core store cache into extension store object.
2. Register storage namespace.
3. Register API routes.
4. Register layout main attrs provider:
   - `data-annotations-enabled`
   - `data-annotation-path`
   - `data-annotation-author`
5. Register document-scoped or layout-scoped asset bundle.
6. Move JS/CSS.

Acceptance:

- `layout_page.py` or default layout has no annotation-specific code.
- `core.py` does not import annotations.

### Phase 15: Move Slides Fully

Goal:

- Slides owns its route, deck logic, document action, heading action, and assets.

Steps:

1. Move `render_slide_deck` from `content_routes.py` into Slides.
2. Move slide route from `core.py` into Slides.
3. Register route prefix `/slides`.
4. Register layout mode `slide`.
5. Register `bundle:slides.runtime`.
6. Move document present button into Slides document action provider.
7. Move heading present action out of Markdown into Slides heading action
   provider.

Acceptance:

- `content_routes.py` does not import `extensions_builtin.slides`.
- Markdown does not import Slides.

### Phase 16: Move Documents And Document Kinds

Goal:

- Post/PDF/tree document rendering becomes extension-compatible.

Steps:

1. Create `documents` extension.
2. Move `document_pages.py`.
3. Move document route composition from `content_routes.py`.
4. Add document kind registry.
5. Create `pdf_document` extension from PDF branch.
6. Create `tree_document` extension from `.tree` branch.
7. Register actions from Slides and Bookmarks through hooks.

Acceptance:

- New document kind can be added without editing core routes.

### Phase 17: Move Filesystem Content Source

Goal:

- Filesystem is the default content source extension.

Steps:

1. Move content mount/path operations from helpers into filesystem content
   source or core path service with provider registry.
2. Register raw routes:
   - `/posts/{path:path}.md`
   - `/posts/{path:path}.{ext:static}`
   - `/posts/{path:path}.json`
   - `/download/{path:path}`
3. Expose resolver to render extensions through `RenderContext`.

Acceptance:

- Content source can be replaced by another source later without editing render
  extensions.

### Phase 18: Move Default Errors

Goal:

- Error pages comply with `slot:error_pages`.

Steps:

1. Move `page_views.py` into `default_errors`.
2. Register `slot:error_pages`.
3. Add structured `ErrorPageContext`.
4. Core catch-all calls error slot.

Acceptance:

- Normal users see public detail.
- Admins can see admin detail.

### Phase 19: Move Live Reload

Goal:

- Browser reload is a development extension.

Steps:

1. Create `live_reload` extension.
2. Move `_live_reload_roots`, `_is_live_reload_path`,
   `_live_reload_events`, and route `/_vyasa/reload`.
3. Register global route asset script only when enabled.
4. Keep CLI flag mapping.

Acceptance:

- No live reload code in core.

### Phase 20: Static Build Parity

Goal:

- Static build uses the same extension contracts as live server.

Steps:

1. Build runtime once from config.
2. Render documents through document registry.
3. Render markdown through markdown registry.
4. Render shell through layout slot.
5. Collect page asset bundles.
6. Copy core and extension static assets.
7. Remove hard-coded CSS/JS from `generate_static_html`.

Acceptance:

- Static and live output load the same extension assets.
- Static build tests cover Mermaid/Tasks/Tabs presence only when used.

## Required Tests

Add these tests before and during migration:

### Contract Tests

- `test_extension_objects_are_loaded_not_modules`
- `test_extension_app_rejects_undeclared_markdown_fence`
- `test_extension_app_rejects_undeclared_asset_bundle`
- `test_extension_app_rejects_undeclared_route_prefix`
- `test_extension_app_rejects_duplicate_markdown_fence`
- `test_extension_runtime_is_frozen_after_build`
- `test_extension_storage_namespace_is_scoped_to_extension_id`

### Disabled Behavior Tests

- `test_mermaid_disabled_renders_as_code_block`
- `test_d2_disabled_renders_as_code_block`
- `test_cytograph_disabled_renders_as_code_block`
- `test_tasks_disabled_renders_as_code_block`
- `test_tabs_disabled_leaves_source_unprocessed`
- `test_wikilinks_disabled_leaves_source_literal`
- `test_slides_disabled_returns_404_or_not_found_for_slides_route`
- `test_search_disabled_removes_search_routes_and_sidebar_section`
- `test_bookmarks_disabled_removes_bookmark_buttons_and_api`
- `test_annotations_disabled_removes_annotation_attrs_and_api`

### Asset Tests

- `test_mermaid_bundle_emitted_only_for_mermaid_fence`
- `test_tasks_bundle_emitted_only_for_tasks_fence`
- `test_slides_bundle_emitted_only_for_slides_route`
- `test_bookmarks_bundle_emitted_when_bookmark_decorator_used`
- `test_extension_asset_url_has_mtime_token`
- `test_static_build_copies_extension_assets`

### Cross-Seam Tests

- `test_markdown_renderer_does_not_import_render_extensions`
- `test_search_does_not_import_bookmarks`
- `test_tree_rendering_does_not_import_bookmarks`
- `test_layout_does_not_import_annotations_or_slides`
- `test_core_does_not_import_builtin_feature_extensions_except_registry`

These can use source scanning with `path.read_text()` and forbidden import
strings.

## Source-Scanning Gates

Add a test file such as `tests/test_extension_boundaries.py`.

Forbidden after final migration:

```text
from ..markdown.renderer import _render_
from .extensions_builtin.bookmarks
from .extensions_builtin.annotations
from .extensions_builtin.slides
runtime.markdown_fences[
runtime.markdown_preprocessors.append
runtime.markdown_postprocessors.append
runtime.layout_renderer =
runtime.home_renderer =
runtime.error_renderer =
runtime.slide_renderer =
```

Allowed:

- `vyasa/extensions.py` may import `vyasa.extensions_builtin` registry.
- Built-in registry may import extension objects.
- Tests may import extension internals directly.

## Migration Safety Rules For A Small LLM

Use this checklist for every extension move:

1. Identify one feature owner.
2. Move only that feature.
3. Use `awk`/`sed` extraction by function boundaries.
4. Paste into the extension folder.
5. Add missing local imports.
6. Register through `VyasaExtensionApp`.
7. Delete the original function.
8. Delete fallback branches.
9. Run focused tests.
10. Run full tests.
11. Search for forbidden imports.

Do not:

- Move multiple feature owners in one patch.
- Add import shims.
- Leave original private functions behind.
- Make core call extension-specific helpers.
- Make one extension import another extension's private implementation.

## Concrete First Patch Order

Do this exact order:

1. Move `theme_extensions` into `extensions_builtin/themes`.
2. Add `VyasaExtensionBase` and `VyasaExtensionApp`.
3. Convert Mermaid only to the new contract.
4. Delete Markdown's Mermaid fallback.
5. Add disabled Mermaid test.
6. Repeat for D2.
7. Repeat for Cytograph.
8. Repeat for Tasks.
9. Create Cryptograph extension.
10. Only then split JS/CSS for those render extensions.

Reason:

- Mermaid is the smallest visible proof.
- If Mermaid cannot be clean, the contract is wrong.
- Tasks is large; do not start with it.

## Mermaid Example Target

Target files:

```text
vyasa/extensions_builtin/mermaid/
  __init__.py
  extension.py
  render.py
  static/mermaid.js
  static/mermaid.css
```

`__init__.py`:

```python
from .extension import EXTENSION
```

`extension.py`:

```python
from ...extensions import ExtensionMeta, VyasaExtensionBase
from .render import render_mermaid_block


class MermaidExtension(VyasaExtensionBase):
    meta = ExtensionMeta(
        id="mermaid",
        category="render",
        provides=("cap:markdown:fence:mermaid", "bundle:mermaid.runtime"),
        requires=("cap:markdown_pipeline",),
    )

    def register(self, app):
        app.assets.bundle(
            "mermaid.runtime",
            css=("static/mermaid.css",),
            js=("static/mermaid.js",),
            scope="document",
        )
        app.markdown.fence("mermaid", render_mermaid_block)


EXTENSION = MermaidExtension()
```

The renderer must live in `render.py`, not in Markdown.

## End-State Acceptance Criteria

The refactor is not complete until all of these are true:

- `rg "VyasaExtension" vyasa/extensions_builtin` finds real subclasses or
  extension objects.
- `rg "def configure\\(" vyasa/extensions_builtin` finds no results.
- `rg "from ..markdown.renderer import _render" vyasa/extensions_builtin` finds
  no results.
- `rg "_render_mermaid_block|_render_d2_block|_render_cytograph_block|_render_tasks_block|_render_cryptograph_block" vyasa/extensions_builtin/markdown/renderer.py` finds no results.
- `rg "runtime\\.markdown_fences|runtime\\.layout_renderer|runtime\\.home_renderer|runtime\\.error_renderer|runtime\\.slide_renderer" vyasa/extensions_builtin` finds no results.
- `vyasa/static/scripts.js` no longer contains feature code for Mermaid, D2,
  Cytograph, Tasks, Tabs, Bookmarks, Annotations, Search, or Slides.
- `vyasa/static/header.css` no longer contains feature selectors for moved
  extensions.
- `vyasa/theme_extensions` does not exist.
- `core.py` does not import built-in feature extensions directly.
- Disabling a render extension actually disables its syntax.
- Static build and live server use the same extension runtime.
- Full test suite passes.

## Current Biggest Risks

1. `core.py` global state makes route extensions hard to register cleanly.
   Fix with an app factory and frozen runtime.

2. Markdown currently acts as a feature hub. Fix by moving each fence renderer
   out and deleting fallback branches.

3. Shared `scripts.js` couples unrelated features through global events. Fix by
   adding a tiny event bus and extension-owned JS.

4. Search/tree/bookmarks are tangled. Fix with a row decorator contract.

5. Slides touches Markdown headings, document actions, layout mode, and routes.
   Fix only after the document action and heading action contracts exist.

6. Static build duplicates live behavior. Fix after live extension asset
   collection works.

## Final Target Mental Model

Core should answer:

- What content roots exist?
- What request is this?
- What user roles does this request have?
- Which extensions are enabled?
- Which extension owns this route, slot, fence, asset, or storage namespace?
- How do I call the registered provider safely?

Extensions should answer:

- How does Mermaid render?
- How do Tasks parse and draw?
- How does the default layout look?
- How do bookmarks store and render?
- How does search rank files?
- How does a slide deck work?

That split is the developer-friendly layer. Anything else is just moving boxes
around.
