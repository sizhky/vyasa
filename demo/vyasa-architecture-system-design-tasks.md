# Vyasa Architecture System Design Demo
Demo for Vyasa itself: markdown, diagrams, navigation, authoring, build, and ops.
Nested groups intentionally stress groups inside groups inside groups.

```items
---
title: Vyasa Architecture
default_open_depth: 2
---
CLI + Config Bootstrap:
  Paths + Flags:
    - cli_root :: Root Resolution
    - cli_config :: Config Reload + Merge
  Dev Server Launch:
    - cli_uvicorn :: Uvicorn + Reload Watch
    - cli_browser :: Browser Open Sentinel
Content Roots + `.vyasa` + Mounted Trees:
  Source Documents:
    - content_md :: Markdown Files
    - content_pdf :: PDF Files
    - content_tree :: `.tree` Files
  Root Metadata:
    - content_notes :: Folder Notes + Index Files
    - content_mounts :: Mounted Roots + Local Assets
FastHTML Runtime Core:
  ASGI Boundary:
    - app_entry :: ASGI App Entry
    - app_startup :: Lifespan Startup Hooks
  Runtime State:
    - app_state :: Runtime Context + Shared State
    - app_services :: Shared Services + Adapters
  Route + Service Wiring:
    - app_beforeware :: Beforeware + Static Mount
    - app_wiring :: Route Registration
Auth + RBAC Gate:
  Identity Providers:
    - auth_local :: Local Session Login
    - auth_google :: Google OAuth Login
  Access Policy:
    - auth_roles :: Role Resolution
    - auth_allow :: Path Allow / Deny Check
  Admin Flows:
    - auth_impersonate :: Impersonation Flow
    - auth_rbac_admin :: RBAC Admin Flow
Route Layer:
  Content Routes:
    - route_home :: Home + Index Route
    - route_post :: Post / PDF / Tree Route
    - route_slides :: Slide + Present Route
  Search + API Routes:
    - route_search :: Search + Preview Route
    - route_marks :: Bookmarks + Annotations API
Render Pipeline:
  Markdown Prep:
    - render_frontmatter :: Frontmatter + Title Resolve
    - render_md_prep :: Callouts + Footnotes + Includes
  Rich Block Rendering:
    - render_from_md :: Markdown to HTML
    - render_rich :: Diagrams + Tree Tables + Preview Fragments
  Output Shaping:
    - render_toc :: TOC + Heading Anchors
    - render_payload :: Route-ready Content Payload
Layout + Shell:
  Shell Frame:
    - shell_layout :: Main Layout Composer
    - shell_nav :: Navbar + Sidebar + Pager
  Theme + Assets:
    - shell_theme :: Theme Presets + Custom CSS
    - shell_favicon :: Favicon + Static Asset URLs
Browser + HTMX Client:
  Client Surface:
    - browser_nav :: HTMX Navigation + Search Preview
    - browser_present :: Present Mode + Theme Toggle
Auxiliary APIs + Stores:
  Navigation + Search Data:
    - aux_tree :: Content Tree + Sidebar Data
    - aux_search :: File Search + Search Records
  User + Policy State:
    - aux_marks :: Bookmark + Annotation Stores
    - aux_policy :: Persisted RBAC Config
Static Build Path:
  Export Walk:
    - build_walk :: Source Enumeration + Output Paths
    - build_render :: Static Markdown + Tree Render
  Final Output:
    - build_shell :: Static Shell Composition
    - build_assets :: Asset Copy + Raw Downloads + Generated Favicon

cli_root ->|resolves content root\nnormalizes working folder and CLI path\nsets runtime root env| cli_config
cli_config ->|reloads config from CLI env and `.vyasa`\nturns flags into runtime settings| cli_uvicorn
cli_uvicorn ->|starts live server\nwatches content and source changes\nhands startup to app| app_entry
cli_browser ->|opens one browser tab per launch\nwaits for startup complete signal| app_startup
content_mounts ->|exposes mounted roots\nexposes local asset branches\nexposes extra source space| app_state
content_notes ->|supplies folder landing notes\nsupplies index and README fallbacks| route_home
app_entry ->|forwards request scope receive send\nhands lifespan traffic inward| app_startup
app_startup ->|initializes core app once\ntriggers browser-open hook| app_state
app_state ->|holds config getters\nholds request-time runtime access\nholds current root and title context| app_services
app_services ->|collects tree search bookmark annotation and layout helpers\npackages shared adapters for route use| app_wiring
app_beforeware ->|mounts package static\nskips static and login paths\nwraps protected request flow| auth_local
app_wiring ->|registers page routes and API routes\nbinds shared helpers into handlers| route_home
auth_local ->|reads session auth\nsupports username and password login| auth_roles
auth_google ->|starts OAuth redirect\nhandles callback and userinfo fetch| auth_roles
auth_roles ->|normalizes auth payload\nderives effective roles from RBAC and provider defaults| auth_allow
auth_allow ->|blocks unauthorized reads early\npasses allowed requests onward| route_post
auth_impersonate ->|swaps acting identity for admin testing\nfeeds updated auth back into policy checks| auth_roles
auth_rbac_admin ->|edits RBAC config\npersists config and clears nav caches| aux_policy
content_md ->|supplies raw markdown source\nsupplies current file and folder context| render_frontmatter
content_pdf ->|supplies binary document targets for document page flow| route_post
content_tree ->|supplies structured task tree source for tree table rendering| render_rich
route_home ->|resolves home feed or folder landing page\nasks for rendered page body when markdown exists| render_payload
route_post ->|resolves slug or folder note\nbranches into markdown pdf or tree document handling| render_payload
route_slides ->|splits markdown into deck or reveal units\nasks renderer for slide-safe html fragments| render_from_md
route_search ->|gathers search matches and previews\nfilters results by visible roles| aux_search
route_marks ->|handles bookmark and annotation API reads and writes\nchecks read permissions before store access| aux_marks
render_frontmatter ->|parses frontmatter\nfinds visible title\nextracts markdown body| render_md_prep
render_md_prep ->|preprocesses callouts footnotes includes super-sub and markdown extensions| render_from_md
render_from_md ->|turns markdown into html fragments\nrenders page body and slide body| render_rich
render_rich ->|renders diagrams tree tables and preview snippets\nprepares rich fragments for shell placement| render_toc
render_toc ->|extracts headings and anchors\nbuilds TOC source for sidebar and shell| render_payload
render_payload ->|packages title body toc and document metadata\nreturns route-ready content payloads| shell_layout
aux_tree ->|provides content tree entries\nprovides folder visibility and sidebar structure| shell_nav
aux_search ->|provides gathered search records\nprovides previewable file matches to routes| route_search
aux_marks ->|persists bookmark and annotation rows\nreturns user-scoped state to API routes| route_marks
aux_policy ->|stores RBAC config and compiled rule inputs\nfeeds admin edits back into runtime policy| auth_allow
shell_layout ->|wraps content in page frame\ncoordinates shell parts and htmx-aware response shape| shell_nav
shell_nav ->|adds navbar sidebar pager footer and branch navigation| shell_theme
shell_theme ->|applies theme presets and custom CSS\nselects visual chrome for live and static pages| shell_favicon
shell_favicon ->|builds asset URLs and favicon references\nhands final shell toward browser and build output| browser_nav
browser_nav ->|drives htmx swaps local search preview and lightweight page navigation| browser_present
browser_present ->|runs present mode and client theme interactions\nconsumes shell html and static scripts| build_shell
app_wiring ->|reuses same content resolution and shared helpers\nkeeps live and export paths aligned| build_walk
build_walk ->|enumerates source docs and output targets\nplans html files raw copies and asset destinations| build_render
build_render ->|reuses markdown render tree render toc extraction and prev-next generation| build_shell
build_shell ->|composes final static page frame from rendered content and shell model| build_assets
build_assets ->|copies static assets\ncopies raw downloads\ngenerates favicon output and final dist tree| browser_nav
```
