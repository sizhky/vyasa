# Vyasa Architecture System Design Demo
Demo for Vyasa itself: markdown, diagrams, navigation, authoring, build, and ops.
Nested groups intentionally stress groups inside groups inside groups.

```items
---
title: Vyasa Architecture
default_open_depth: 2
spacing: airy
---
- cli :: CLI + Config Bootstrap
- content :: Content Roots + `.vyasa` + Mounted Trees
- app :: FastHTML Runtime Core
- auth :: Auth + RBAC Gate
- routes :: Route Layer
- render :: Content Pipeline
- shell :: Layout + Shell
- aux :: Auxiliary APIs + Stores
- browser :: Browser + HTMX Client
- build :: Static Build Path

cli ->|loads root folder\nmerges CLI flags with env and `.vyasa`\nmounts package static\nboots shared runtime once| app
content ->|feeds markdown, pdf, `.tree`\nfeeds folder landing notes and mounted roots\nfeeds favicon inputs and local assets| app
app ->|runs request entrypoint\nowns runtime helpers\nwires route registrations\nexposes shared config and services| auth
auth ->|skips static and login routes\nresolves session or Google auth\nderives roles\nblocks unauthorized reads early| routes
app ->|hands out content tree helpers\nhands out search plumbing\nhands out bookmark and annotation adapters\nhands out layout callable| routes
routes ->|resolves slug or folder note\nchooses markdown or pdf or tree or slide flow\nasks for visible title and body render| render
content ->|supplies raw source files\nsupplies inline include targets\nsupplies source-relative paths\nsupplies branch-local config context| render
render ->|returns body html\nreturns toc source and heading anchors\nreturns diagram output and preview fragments\nreturns route-ready content payloads| shell
aux ->|provides nav trees\nprovides role-filtered search records\nprovides bookmark rows and annotation rows\nprovides persisted RBAC config and file search| routes
shell ->|wraps content with navbar and sidebars\nadds pager and footer\nadds custom CSS hooks and theme presets\nadds HTMX-aware page chrome| browser
app ->|reuses same content resolution and render helpers\nkeeps live server behavior and export behavior aligned| build
content ->|enumerates source docs and assets for html export\nsupplies raw downloads and copied static files\nsupplies generated favicon output| build
render ->|reused for markdown html and toc extraction\nreused for tree rendering and preview shaping\nreused for prev-next link generation during export| build
shell ->|provides static shell model\nprovides final page frame composition for generated html pages| build
```
