# Vyasa Architecture System Design Demo
Demo for Vyasa itself: markdown, diagrams, navigation, authoring, build, and ops.
Nested groups intentionally stress groups inside groups inside groups.

```items
---
title: Vyasa Architecture
default_open_depth: -1
---
group runtime Runtime System
  group content Content Pipeline
    group markdown Markdown Blocks
      item t1 Define page frontmatter contract
      item t2 Parse markdown into typed blocks
      item t3 Support callouts, tables, footnotes, and tabs
      item t4 Normalize heading ids and anchors
      item t5 Preserve raw markdown source access
      item t6 Render page body from block tree
        depends t1 t2 t3 t4 t5
    group diagrams Diagram Blocks
      item t10 Load Mermaid safely
      item t11 Load D2 safely
      item t12 Load Cytograph and .cytree sources
      item t13 Render inline items graph blocks
      item t14 Support diagram sizing and fit controls
        depends t6 t10 t11 t12 t13
  group discovery Navigation and Search
    group navtree Sidebar and Pager
      item t20 Build sidebar tree and folder landing pages
      item t21 Build TOC from headings
      item t22 Generate previous and next pager
      item t23 Resolve canonical URLs and raw URLs
        depends t4 t5 t20 t21 t22
    group search Search Index
      item t24 Index titles, tags, and body text
        depends t6 t20
      item t25 Rank local search results
        depends t24
      item t26 Render search preview actions
        depends t23 t25
group interface Authoring Interface
  group visual Theme and Layout
    group shell Page Shell
      item t30 Apply bundled theme presets
      item t31 Allow site accent overrides
      item t32 Keep desktop and mobile shells aligned
      item t33 Style code blocks and callouts consistently
        depends t6 t30 t31 t32
    group canvas Diagram Surface
      item t34 Keep graph surfaces readable in dark and light themes
        depends t14 t30 t31
      item t35 Keep item cards, group cards, and edges layered correctly
        depends t13 t34
  group editing Editing Workflow
    group docs Document Editing
      item t40 Support inline editing for markdown pages
      item t41 Support move, rename, and delete flows
      item t42 Preserve document order and folder rules
        depends t20 t23 t40 t41
    group itemgraph Item Graph Editing
      item t43 Support item graph editing and dependency changes
        depends t13 t40
      item t44 Keep graph edits block-scoped and reversible
        depends t2 t6 t43
      item t45 Warn about dependency cycles before saving
        depends t43
group delivery Build Deploy and Ops
  group build Static Build
    group assets Pages and Assets
      item t50 Build static output for pages and assets
        depends t6 t14 t23 t33
      item t51 Cache compiled markdown and diagram artifacts
        depends t6 t14
      item t52 Preserve raw downloads and source links
        depends t5 t23 t50
    group preview Local Preview
      item t53 Handle previews and local dev reloads
        depends t40 t44 t50
      item t54 Surface failed render diagnostics
        depends t51 t53
  group governance Security and Release
    group access Auth and RBAC
      item t60 Expose auth and RBAC gates
        depends t23 t40
      item t61 Hide unauthorized nav branches
        depends t20 t60
      item t62 Protect raw source routes
        depends t5 t60
    group launch Release Ops
      item t70 Add monitoring for failed renders and broken embeds
        depends t14 t50 t54
      item t71 Run end-to-end authoring and static build drill
        depends t42 t44 t52 t61 t62
      item t72 Ship stable release checklist
        depends t26 t35 t54 t70 t71
```
