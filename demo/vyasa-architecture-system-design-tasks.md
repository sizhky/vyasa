# Vyasa Architecture System Design Demo
Demo for Vyasa itself: markdown, diagrams, navigation, authoring, build, and ops.
Nested groups intentionally stress groups inside groups inside groups.

```items
---
title: Vyasa Architecture
default_open_depth: -1
---
Runtime System:
  Content Pipeline:
    Markdown Blocks:
      - t1 :: Define page frontmatter contract
      - t2 :: Parse markdown into typed blocks
      - t3 :: Support callouts, tables, footnotes, and tabs
      - t4 :: Normalize heading ids and anchors
      - t5 :: Preserve raw markdown source access
      - t6 :: Render page body from block tree
    Diagram Blocks:
      - t10 :: Load Mermaid safely
      - t11 :: Load D2 safely
      - t12 :: Load Cytograph and .cytree sources
      - t13 :: Render inline items graph blocks
      - t14 :: Support diagram sizing and fit controls
  Navigation and Search:
    Sidebar and Pager:
      - t20 :: Build sidebar tree and folder landing pages
      - t21 :: Build TOC from headings
      - t22 :: Generate previous and next pager
      - t23 :: Resolve canonical URLs and raw URLs
    Search Index:
      - t24 :: Index titles, tags, and body text
      - t25 :: Rank local search results
      - t26 :: Render search preview actions
Authoring Interface:
  Theme and Layout:
    Page Shell:
      - t30 :: Apply bundled theme presets
      - t31 :: Allow site accent overrides
      - t32 :: Keep desktop and mobile shells aligned
      - t33 :: Style code blocks and callouts consistently
    Diagram Surface:
      - t34 :: Keep graph surfaces readable in dark and light themes
      - t35 :: Keep item cards, group cards, and edges layered correctly
  Editing Workflow:
    Document Editing:
      - t40 :: Support inline editing for markdown pages
      - t41 :: Support move, rename, and delete flows
      - t42 :: Preserve document order and folder rules
    Item Graph Editing:
      - t43 :: Support item graph editing and dependency changes
      - t44 :: Keep graph edits block-scoped and reversible
      - t45 :: Warn about dependency cycles before saving
Build Deploy and Ops:
  Static Build:
    Pages and Assets:
      - t50 :: Build static output for pages and assets
      - t51 :: Cache compiled markdown and diagram artifacts
      - t52 :: Preserve raw downloads and source links
    Local Preview:
      - t53 :: Handle previews and local dev reloads
      - t54 :: Surface failed render diagnostics
  Security and Release:
    Auth and RBAC:
      - t60 :: Expose auth and RBAC gates
      - t61 :: Hide unauthorized nav branches
      - t62 :: Protect raw source routes
    Release Ops:
      - t70 :: Add monitoring for failed renders and broken embeds
      - t71 :: Run end-to-end authoring and static build drill
      - t72 :: Ship stable release checklist

t1, t2, t3, t4, t5 ->|compose| t6
t6, t10, t11, t12, t13 ->|enable diagrams| t14
t4, t5, t20, t21, t22 ->|route| t23
t6, t20 ->|index| t24
t24 -> t25
t23, t25 -> t26
t6, t30, t31, t32 ->|style| t33
t14, t30, t31 -> t34
t13, t34 -> t35
t20, t23, t40, t41 ->|preserve docs| t42
t13, t40 -> t43
t2, t6, t43 ->|rewrite block| t44
t43 -> t45
t6, t14, t23, t33 ->|ship static| t50
t6, t14 -> t51
t5, t23, t50 -> t52
t40, t44, t50 -> t53
t51, t53 -> t54
t23, t40 -> t60
t20, t60 -> t61
t5, t60 -> t62
t14, t50, t54 -> t70
t42, t44, t52, t61, t62 -> t71
t26, t35, t54, t70, t71 -> t72
```
