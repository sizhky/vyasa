# Vyasa Architecture System Design Demo
Demo for Vyasa itself: markdown, diagrams, navigation, search, theming, and build flow.
Flat DAG only. Bias toward graph breadth, not long chains.

```tasks
id vyasa-architecture
title Vyasa Architecture
group content Content Model and Markdown
  task t1 Define page frontmatter contract
  task t2 Parse markdown into typed blocks
  task t3 Support callouts, tables, footnotes, and tabs
  task t4 Normalize heading ids and anchors
  task t5 Preserve raw markdown source access
  task t6 Render page body from block tree
    depends t1 t2 t3 t4 t5
group diagrams Diagram Embeds and Task Graphs
  task t10 Load Mermaid safely
  task t11 Load D2 safely
  task t12 Load Cytograph and .cytree sources
  task t13 Render inline tasks graph blocks
  task t14 Support diagram sizing and fit controls
    depends t6 t10 t11 t12 t13
group navigation Navigation and Discovery
  task t20 Build sidebar tree and folder landing pages
  task t21 Build TOC from headings
  task t22 Generate previous and next pager
  task t23 Support search by title, tag, and body
  task t24 Resolve canonical URLs and raw URLs
    depends t4 t5 t20 t21 t22 t23
group presentation Theme and Layout
  task t30 Apply bundled theme presets
  task t31 Allow site accent overrides
  task t32 Style code blocks and callouts consistently
  task t33 Keep desktop and mobile shells aligned
  task t34 Keep diagram surfaces readable in dark and light themes
    depends t6 t14 t30 t31 t32 t33
group authoring Editing and Workflow
  task t40 Support inline editing for markdown pages
  task t41 Support tasks graph editing and dependency changes
  task t42 Support move, rename, and delete flows
  task t43 Keep graph edits block-scoped and reversible
  task t44 Preserve document order and folder rules
    depends t2 t6 t13 t20 t24 t41 t42 t43
group platform Build Deploy and Ops
  task t50 Build static output for pages and assets
  task t51 Cache compiled markdown and diagram artifacts
  task t52 Expose auth and RBAC gates
  task t53 Handle previews and local dev reloads
  task t54 Add monitoring for failed renders and broken embeds
  task t55 Ship a stable release checklist
    depends t6 t14 t24 t34 t40 t44 t50 t51 t52 t53 t54
```
