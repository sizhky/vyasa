# Extension Refactor Task Graph
Date: 2026-05-18

```items
---
title: Vyasa Extension Refactor
default_open_depth: 2
width: 92vw
color_by:
  status:
    Todo: "#fa7115"
    Ready: "#facc15"
    Blocked: "#ef4444"
    Done: "#2cd013"
---
id: vyasa-extension-refactor
title: Make extension authoring boring

Core Kernel Rule | acceptance: core only loads config, validates extension graph, mounts routes, carries request context, and serves declared assets:
  - kernel :: Shrink core to extension kernel | status: Todo | affected: vyasa/core.py, vyasa/extensions.py, vyasa/bootstrap.py, vyasa/main.py | tests: default boot + minimal boot tests | acceptance: every user-visible feature is selected as builtin/external extension
  - classify :: Classify all current features as kernel or extension | status: Done | affected: docs/refactor/analysis-2.md, vyasa/extensions_builtin/* | tests: architecture checklist review | acceptance: no feature remains in core without explicit kernel reason

Phase 1 - Measure And Stabilize | acceptance: no refactor starts blind; trace and context seams exist first:
  - debug-perf :: Make debug_perf extension | status: Done | affected: vyasa/extensions.py, vyasa/runtime_context.py, vyasa/extensions_builtin/debug_perf/* | tests: focused request trace test | acceptance: perf baseline names extension_plan, content_resolve, tree, markdown, toc, layout, sidebar, assets, total
  - trace-hooks :: Add tiny trace hook seam | status: Done | affected: vyasa/runtime_context.py, vyasa/core.py, vyasa/content_routes.py, vyasa/layout_page.py | tests: no-op trace hook test | acceptance: kernel exposes timing hook, debug_perf owns collection/reporting
  - ctx :: Create request/render context object | status: Done | affected: vyasa/runtime_context.py, vyasa/extensions.py | tests: extension registration/runtime tests | acceptance: extensions receive one stable context instead of raw globals

Phase 2 - Core Extension Surfaces | acceptance: assets and markdown become deep modules with narrow interfaces:
  - assets :: Deepen AssetManifest | status: Done | affected: vyasa/assets.py, vyasa/extensions.py, vyasa/build.py | tests: document asset emission tests | acceptance: rendered features request bundles and shell emits each bundle once
  - pipeline :: Deepen RenderPipeline | status: Done | affected: vyasa/extensions_builtin/markdown/*, vyasa/extensions.py | tests: markdown fence and processor ordering tests | acceptance: markdown core owns ordering, fence extensions own behavior

Phase 3 - Layout And Navigation | acceptance: extensions register UI intent; core owns consistent shell markup and styling:
  - frame :: Extract PageFrame module | status: Done | affected: vyasa/layout_page.py, vyasa/page_shell.py, vyasa/core.py | tests: page shell runtime + static tests | acceptance: page model in, FastHTML nodes out, no giant render_layout kitchen args
  - navmodel :: Create NavigationModel rows | status: Done | affected: vyasa/tree_rendering.py, vyasa/sidebar_helpers.py, vyasa/nav_views.py | tests: tree rendering tests | acceptance: tree rows are data with slots, not pre-glued HTML
  - actions :: Add ActionRegistry | status: Done | affected: vyasa/extensions.py, vyasa/document_pages.py, vyasa/tree_rendering.py | tests: action rendering tests | acceptance: extensions register icon, label, placement, visibility; core renders style
  - js-split :: Split global JS into owned bundles | status: Todo | affected: vyasa/static/scripts.js, vyasa/extensions_builtin/*/static/* | tests: browser smoke + asset tests | acceptance: feature JS lives with owning extension and stable hooks remain
  - css-hooks :: Harden CSS hook contract | status: Todo | affected: vyasa/static/header.css, vyasa/layout_page.py, vyasa/sidebar_helpers.py | tests: shell class snapshot tests | acceptance: extensions use stable classes, not positional selectors

Phase 4 - Default Builtins | acceptance: default preset is made of real builtins, not wrappers back into core:
  - shell-ext :: Make document_shell default builtin | status: Done | affected: vyasa/extensions_builtin/default_layout.py, vyasa/layout_page.py | tests: default/minimal preset tests | acceptance: default layout stops calling core._default_layout
  - actions-ext :: Make document_actions builtin | status: Ready | affected: vyasa/document_pages.py, vyasa/extensions_builtin/document_actions/* | tests: document header action tests | acceptance: present/copy/fold/export actions are registered, not hardcoded
  - search-ext :: Deepen search builtin | status: Todo | affected: vyasa/search_service.py, vyasa/search_http.py, vyasa/search_views.py, vyasa/extensions_builtin/default_search.py | tests: search preview and ranking tests | acceptance: search can be disabled/replaced through extension slot
  - home-ext :: Deepen home_blog_feed builtin | status: Todo | affected: vyasa/core.py, vyasa/extensions_builtin/blog_home.py | tests: home feed tests | acceptance: sort, ignore, infinite feed live behind home extension
  - content-ext :: Deepen filesystem content source | status: Todo | affected: vyasa/content_tree.py, vyasa/helpers.py, vyasa/extensions_builtin/filesystem.py | tests: content tree/source tests | acceptance: one local root resolves through ContentResolver without route callers knowing filesystem details
  - roots-ext :: Make multiple_roots default builtin | status: Todo | affected: vyasa/config.py, vyasa/content_tree.py, vyasa/helpers.py, vyasa/extensions_builtin/filesystem.py | tests: multi-root content/tree/search tests | acceptance: root mounting, root labels, and cross-root slug policy live behind extension interface
  - auth-ext :: Deepen auth_rbac builtin | status: Todo | affected: vyasa/auth/*, vyasa/extensions_builtin/auth_routes.py, vyasa/extensions_builtin/rbac_admin/* | tests: auth runtime tests | acceptance: routes/policy/admin UI own one auth extension surface

Phase 5 - More Feature Extensions | acceptance: every user-visible feature has an owner extension or explicit kernel exemption:
  - toc-ext :: Make table_of_contents builtin | status: Ready | affected: vyasa/sidebar_helpers.py, vyasa/layout_page.py | tests: TOC extraction/render tests | acceptance: TOC sidebar and mobile panel can be disabled/replaced
  - pdf-ext :: Make pdf_viewer builtin | status: Todo | affected: vyasa/content_routes.py, vyasa/tree_rendering.py | tests: PDF route render tests | acceptance: PDF document rendering is selected by extension, not hardcoded in post route
  - tree-table-ext :: Make tree_table builtin | status: Todo | affected: vyasa/tree_tables.py, vyasa/content_routes.py, vyasa/tree_rendering.py | tests: tree table parse/render tests | acceptance: .tree support is a document type extension
  - raw-files-ext :: Make raw_files/download builtin | status: Todo | affected: vyasa/extensions_builtin/filesystem_routes.py, vyasa/build.py | tests: raw/download route tests | acceptance: raw source routes and static copy rules live outside core
  - custom-css-ext :: Make scoped_custom_css builtin | status: Ready | affected: vyasa/sidebar_helpers.py, vyasa/layout_page.py, vyasa/static/header.css | tests: scoped CSS link tests | acceptance: folder/page CSS loading is feature-owned and static/runtime match
  - code-tools-ext :: Make code_tools builtin | status: Ready | affected: vyasa/static/scripts.js, vyasa/layout_page.py, vyasa/extensions_builtin/markdown/renderer.py | tests: code copy/highlight asset tests | acceptance: copy buttons and highlighting load only for code pages
  - favicon-ext :: Make favicon builtin | status: Ready | affected: vyasa/favicon.py, vyasa/page_shell.py, vyasa/build.py | tests: favicon route/build tests | acceptance: icon discovery and fallback are extension-owned

Phase 6 - Git Refs Proof | acceptance: external extension uses first-class seams and stops copying Vyasa internals:
  - git-port :: Define content-root adapter seam | status: Done | affected: vyasa/extensions.py, vyasa/helpers.py, /Users/yeshwanth/Code/Personal/vyasa-git-refs/vyasa_git_refs/__init__.py | tests: snapshot resolver tests | acceptance: git refs resolves root/ref/path without route callers knowing snapshot paths
  - git-action :: Replace sidebar button glue with tree-root action | status: Done | affected: vyasa/tree_rendering.py, vyasa/extensions.py, /Users/yeshwanth/Code/Personal/vyasa-git-refs/vyasa_git_refs/__init__.py | tests: tree action render test | acceptance: git refs does not own row flex, classes, or button placement
  - git-assets :: Serve external extension assets through AssetManifest | status: Done | affected: vyasa/assets.py, vyasa/extensions.py, /Users/yeshwanth/Code/Personal/vyasa-git-refs/vyasa_git_refs/static/* | tests: external asset URL test | acceptance: external extension does not hand-roll static routes for CSS/JS

Phase 7 - Verification | acceptance: runtime, static build, minimal preset, and perf comparison all prove migration held:
  - preset-tests :: Strengthen extension preset tests | status: Done | affected: test_extensions.py | tests: pytest test_extensions.py | acceptance: duplicate slot/capability/prefix fail; minimal preset boots clean
  - integration-tests :: Add end-to-end extension smoke tests | status: Todo | affected: test_build.py, test_page_shell.py, test_markdown_renderer.py | tests: runtime + static build smoke | acceptance: runtime and static HTML request same bundles and shell hooks
  - perf-compare :: Compare dev branch performance | status: Blocked | affected: docs/refactor/perf-results.md | tests: same-doc benchmark on dev and current branch | acceptance: measured p50/p95 before any speed fix

classify -> kernel
kernel -> ctx, assets, pipeline, frame
debug-perf -> trace-hooks, perf-compare
trace-hooks -> ctx, frame, pipeline
ctx -> assets, pipeline, shell-ext, search-ext, content-ext, roots-ext
assets -> js-split, git-assets, integration-tests
frame -> navmodel, actions, shell-ext
navmodel -> actions, git-action
actions -> actions-ext, git-action
pipeline -> shell-ext, search-ext, integration-tests
content-ext -> roots-ext, git-port, search-ext
roots-ext -> git-port, search-ext
frame -> toc-ext, custom-css-ext, favicon-ext
content-ext -> pdf-ext, tree-table-ext, raw-files-ext
pipeline -> code-tools-ext
assets -> custom-css-ext, code-tools-ext, favicon-ext
git-port -> git-action
shell-ext, actions-ext, search-ext, home-ext, content-ext, roots-ext, auth-ext, toc-ext, pdf-ext, tree-table-ext, raw-files-ext, custom-css-ext, code-tools-ext, favicon-ext -> preset-tests, integration-tests
perf-compare -> js-split, css-hooks
```

## Classification Snapshot

Kernel:
- Config loading and precedence.
- Extension catalog, plan validation, capability conflict checks, and route mounting.
- Request/render context accessors.
- Declared asset serving and extension static route plumbing.

Default extensions:
- `default_layout`: document shell and page frame.
- `default_theme`: theme preset and token loading.
- `default_search`: index, ranking, sidebar search, and preview cards.
- `blog_home`: fallback post-card home feed.
- `filesystem`: local content roots, folder notes, tree projection, and raw path resolution.
- `filesystem_routes`: raw/download routes.
- `markdown`: markdown pipeline, processors, and fence dispatch.
- `wikilinks`, `tabs`, `mermaid`, `d2`, `cytograph`, `cryptograph`, `tasks`: markdown feature adapters.
- `slides`, `annotations`, `bookmarks`, `auth_routes`, `rbac_admin`, `sidebar_routes`: feature route owners.

Kernel exceptions still present:
- `core.py` still assembles home, search, sidebar, page layout, auth wiring, and document routes.
- `layout_page.py` is still a kitchen-args page renderer, not a deep `PageFrame`.
- `helpers.py` still knows filesystem and content-root policy.
