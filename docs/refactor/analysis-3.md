# Extension Cleanliness Gate
Date: 2026-05-18

Goal: remove dangling feature edges before more extension work. A feature is clean only when its Python, CSS, JS, routes, assets, static build behavior, and shell hooks are owned by its extension or by an explicit kernel contract.

## Highest Priority Tasks

1. `EXT-033 asset-ownership`
   - Problem: feature assets still hang from global files.
   - Evidence: `blog_home` CSS in `vyasa/static/header.css`; code-copy template in `vyasa/layout_page.py`; code theme CSS and KaTeX includes in `vyasa/core.py` and `vyasa/build.py`; route bundles hardcoded in `vyasa/assets.py`.
   - Fix: every feature registers and requests its own bundle; global CSS/JS keeps shell-only tokens and layout hooks.
   - Tests: runtime/static asset snapshot proves disabled extensions emit no feature assets.

2. `EXT-034 core-dependency-cut`
   - Problem: builtin extensions call back into `core.py`, so ownership is nominal.
   - Evidence: `blog_home`, `auth_routes`, `rbac_admin`, `sidebar_routes`, `default_search_routes`, `filesystem_routes`, `slides`, `default_layout`, and `default_errors` import `core`.
   - Fix: pass runtime services through `RuntimeContext` or extension-specific deps; extensions import service modules, not `core`.
   - Tests: grep guard rejects `from .. import core` inside `vyasa/extensions_builtin`.

3. `EXT-035 document-type-ownership`
   - Problem: document/file type policy is spread across helpers, routes, tree rendering, search, and build.
   - Evidence: `.pdf` and `.tree` branches in `vyasa/content_routes.py`, `vyasa/helpers.py`, `vyasa/tree_rendering.py`, `vyasa/search_pages.py`, and `vyasa/build.py`.
   - Fix: document type extensions own suffix matching, render, tree labels, search previews, and static build copy/render rules.
   - Tests: disabling `pdf_viewer` or `tree_table` removes that type from routes/tree/build.
   - Progress: Done for `pdf_viewer` and `tree_table`; raw/download ownership is tracked and done in `EXT-023`.

4. `EXT-036 shell-feature-hooks`
   - Problem: feature-specific shell hooks still live in layout code.
   - Evidence: annotation data attrs, RBAC admin navbar links, TOC/mobile panel ids, and code-copy template are hardcoded in `vyasa/layout_page.py` / `vyasa/nav_views.py`.
   - Fix: features register shell annotations, navbar links, side panels, and templates through typed providers.
   - Tests: minimal preset shell contains no annotation/admin/toc/code-copy hooks.

5. `EXT-037 static-runtime-parity`
   - Problem: static build reimplements feature selection instead of asking the same extension surfaces as runtime.
   - Evidence: `vyasa/build.py` hardcodes scripts, code CSS, KaTeX, TOC extraction, favicon, `.tree`, PDF, and bundle selection.
   - Fix: static build consumes the same render/document/asset providers as runtime.
   - Tests: one smoke fixture compares runtime and static HTML for requested bundles and feature hooks.

## Rule

Do these before `EXT-021`, `EXT-022`, `EXT-023`, `EXT-031`, or performance work. Clean edges first; features after.
