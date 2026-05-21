# Extension Refactor Tracker

Date: 2026-05-15

## Done

- [x] Add real extension contract in `vyasa/extensions.py`
- [x] Switch built-ins to `EXTENSION.register(app)`
- [x] Remove markdown hard-coded fence fallbacks
- [x] Move Mermaid/D2/Cytograph/Tasks/Cryptograph render ownership into extension modules
- [x] Move bookmarks and annotations route/storage wiring out of `core.py`
- [x] Move search and RBAC admin route registration behind extensions
- [x] Serve slide assets from extension-owned URLs under `/static/extensions/...`

## Next

- [x] Split `vyasa/static/scripts.js` into:
  - [x] shell bootstrap
  - [x] `extensions_builtin/mermaid/static/mermaid.js`
  - [x] `extensions_builtin/d2/static/d2.js`
  - [x] `extensions_builtin/tasks/static/tasks.js`
  - [x] `extensions_builtin/bookmarks/static/bookmarks.js`
  - [x] `extensions_builtin/annotations/static/annotations.js`
- [x] Shrink global script include to shell-only bootstrap
- [x] Register real asset bundles for Mermaid/D2/Tasks/Bookmarks/Annotations instead of pointing back at global `scripts.js`
- [x] Move feature CSS out of `vyasa/static/header.css` into extension `static/*.css`
- [x] Emit requested extension bundles from runtime/asset collector instead of relying on always-on global assets
- [x] Make static build copy and reference extension assets, not just package `static/`
- [x] Make static build consume requested runtime bundles per page/route

## Later

- [ ] `EXT-035` document type ownership
  - [x] Gate `.pdf` and `.tree` visibility through owner extensions (`pdf_viewer`, `tree_table`)
  - [x] Cover disabled type behavior in content tree, search, and static tree tests
  - [ ] Move raw/download ownership fully behind the document/file owner path in `EXT-023`
- [ ] Move remaining core-owned route surfaces behind extensions where justified:
  - [x] sidebar lazy/search branch helpers
  - [x] raw markdown/download/static attachment routes
  - [x] optional auth adjunct routes
- [x] Replace `vyasa/extensions_builtin/themes/__init__.py` re-export shim with real moved theme package
- [x] Revisit `agent.py` as optional extension
- [x] Add contract tests for asset bundle emission and extension static build parity
