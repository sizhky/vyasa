---
name: vyasa
description: Use when working on the Vyasa project or when the user wants help using Vyasa itself. Invoke for `.vyasa` TOML config, content organization, markdown features, theming, Mermaid, D2, or Cytograph/`.cytree` embeds, auth and RBAC, static build behavior, or repo-aware Vyasa implementation work.
---

# Vyasa

Use this skill for real Vyasa behavior. All reference files are self-contained — no external docs or repo clone needed.

| If you want to... | Read |
|---|---|
| Configure `.vyasa`, CLI flags, env vars, RBAC, OAuth, or homepage card sorting | `references/config.md` |
| Write or explain markdown features, including inline item graphs | `references/markdown.md` |
| Embed or explain Mermaid, D2, Cytograph, or `.cytree` diagrams | `references/diagrams.md` |
| Style with CSS or theming | `references/theming.md` |
| Create Mermaid, D2, Cytograph, or `.cytree` diagrams | `references/diagrams.md` |
| Build or deploy a static site | `references/static-build.md` |

Start here:

1. Identify the request type from the table above and read only that file.
2. Prefer existing Vyasa conventions over inventing new ones.
3. When generating `.vyasa`, output valid TOML with only supported keys.
4. When changing repo code, cite the concrete file that implements the behavior.
5. For recent markdown work, check `references/markdown.md` for Obsidian-style callouts, aliases, nesting/folding, code snippet includes, inline `items` fences, and explicit heading IDs/permalinks before inventing new syntax.
6. For Mermaid, D2, Cytograph, or `.cytree` embeds, check `references/diagrams.md` before inventing fence syntax, frontmatter keys, or source-loading behavior.
7. For code-block color changes, check `references/theming.md` for the `--vyasa-code-*` CSS variables so users can override palettes from `custom.css`.
8. For books/tutorials/docs sequences, prefer Vyasa's built-in sibling previous/next pager before inventing manual chapter-footer HTML; it follows the folder's `.vyasa` ordering, not raw filename sort.
9. For shell theming, prefer Vyasa's explicit stable hooks over positional selectors: `.vyasa-navbar-shell`, `.vyasa-navbar-card`, `.vyasa-content-grid`, `.vyasa-main-shell`, `.vyasa-sidebar`, `.vyasa-sidebar-card`, `.vyasa-sidebar-toggle`, `.vyasa-sidebar-body`, `.vyasa-posts-sidebar`, `.vyasa-toc-sidebar`, `.vyasa-mobile-panel`, `.vyasa-mobile-panel-header`, `.vyasa-mobile-panel-body`, `.vyasa-footer-shell`, `.vyasa-footer-card`.
10. For FastHTML or MonsterUI form controls, inspect the rendered HTML before wiring DOM events; helper components may wrap or hide the native input. If you need a direct `change` handler or debug-only control, prefer a plain native element over a styled helper.
11. For Vyasa boot-time scripts, only depend on data available in the head. Do not read globals from `head-init.js` that are emitted later from body/navbar markup; if the data is body-scoped, apply it from the main runtime script after DOM creation.
12. For Cytograph work, always read `references/diagrams.md` before proposing syntax, layout defaults, or interaction behavior; Cytograph has project-specific presets (`vyasa`, `dagre`, `cola`) and large-tree conventions that differ from generic Cytoscape advice.

Core rules:

- Treat `.vyasa` as a TOML file, usually at repo root or a content folder.
- Respect precedence: CLI args > `.vyasa` > environment variables > defaults.
- Distinguish root app config from folder-local ordering and navigation config.
- Use `home_sort = "name_asc"` or `home_sort = "name_desc"` for the blog-style homepage card feed when no root page exists; keep folder `sort` for the sidebar/tree.
- Treat root `ignore = [...]` as a homepage feed filter too; ignored files should not appear as cards even when the homepage falls back to the post grid.
- In the lazy posts tree sidebar, a folder-local `.vyasa` is also a branch-visibility marker: even if the folder has no direct markdown files and only nested subfolders, the folder should still appear so the branch can lazy-load.
- For callouts, emit Obsidian-style callouts like `> [!note] Title` or `> [!warning]- Title`; prefer aliases already supported by Obsidian (`warn`, `error`, `faq`, `check`, `done`, `summary`, `tldr`, `cite`, etc.) rather than inventing new keywords.
- For lightweight task callouts, prefer markdown task-list items like `- [ ] Task | owner: Jane | deadline: Tomorrow | priority: high` over custom HTML tags; supported metadata families live in `references/markdown.md`.
- For dependency planning UIs, use fenced `items` blocks inside normal markdown pages instead of separate graph files.
- `items` fences are terse line-based graphs, not YAML.
- Canonical syntax: `id <graph-id>`, `title <graph-title>`, `group <id> <label>`, `item <id> <label>`, then indented attrs.
- Use indentation for nesting. `group` lines nested under `group` lines make child groups. `item` lines nested under a group belong to that group.
- Use `depends <A> <B>` for DAG edges. First-class item attrs today: `estimate`, `depends`, `priority`, `points`, `owner`, `phase`.
- Graph layout attrs exist but are renderer-owned: `graph_x`, `graph_y`. Do not surface them in user guidance unless debugging persistence.
- Current `items` view is a React Flow graph: draggable cards, dependency edges, group expand/collapse, keyboard fit/unfold controls, and a popout button.
- `items` graph persistence is block-scoped through `/api/tasks/blocks/...`; editing a graph rewrites the fenced block source and clears legacy chain state. Do not propose separate item graph files unless the user explicitly asks for legacy compatibility work.
- Use `+` and `-` fold markers when the callout should clearly default open or closed, and prefer nested `> > [!todo]` callouts over ad hoc indentation patterns.
- For custom callout types, rely on `data-callout="your-type"` plus `custom.css` rather than inventing special renderer logic unless the user explicitly wants core support.
- For long-form writing where a single thematic break is too light, use two back-to-back `---` lines to create a stronger section separator; Vyasa renders doubled rules distinctly from a single `---`.
- For navbar, footer, sidebar, and mobile-panel styling, do not teach or rely on positional selectors like `#site-navbar > *`, `#site-footer > *`, or `#posts-sidebar details > summary`; target the explicit Vyasa hook classes instead so runtime and static-build themes stay stable.
- For Mermaid labels, use literal `<br/>` for line breaks inside nodes and edge text; do not emit `\n`.
- Markdown tables now default to a per-cell max width of `33vw`; override globally with `.vyasa` `table_col_max_width` or per table with `<!-- table max-col=24vw -->` immediately above the table.
- For markdown tables with long cell content, still prefer manual line breaks inside the cell using literal `<br/>` when prose would otherwise become visually noisy even within the width cap.
- For Cytograph, prefer `layout: vyasa` by default unless the user explicitly wants `dagre` or `cola`.
- For Cytograph, prefer a `source:` sidecar for large trees instead of embedding hundreds of nodes directly in the markdown fence; keep the page payload and live viewport graph small.
- For Cytograph, prefer `.cytree` over JSON for large tree-shaped sources; it is materially smaller for LLM read/write loops because hierarchy, ids, and shared URL bases are implicit instead of repeated.
- For Cytograph, `source:` for non-markdown files should resolve to a raw file route such as `/download/...`, not `/posts/...`; `/posts/...` renders HTML and will poison the graph loader.
- For large Cytograph trees, optimize the graph shape before tweaking spacing: keep the top-level graph at concept/module level, shorten labels, group high-fanout branches, and move file-level leaves into linked subgraphs or follow-on pages instead of dumping every leaf into one graph.
- For large Cytograph trees, prefer `initial_depth: 1`, treat `All` as a diagnostic affordance rather than the primary reading mode, and split graphs once visible node count or label width makes the graph sparse or unreadable.
- For source-backed Cytograph graphs, `All` should mean “expand all currently visible/materialized parents,” not “load and expand the entire backing tree.”
- For text-heavy Cytograph labels, treat horizontal space as scarce and vertical space as cheaper; prefer the reading-oriented `vyasa` preset over top-down DAG layouts unless the semantic flow truly requires top-to-bottom ranks.
- For the current slide system, do not talk about Reveal.js, `---`/`--` separators, or `reveal_*` frontmatter unless the user explicitly says they are on the old engine; Vyasa now uses the document itself as the deck source.
- The current zen-slide split is structural: `##` starts a horizontal slide, `###+` becomes a downward/detail slide under the active `##`, and empty `##` parent slides should be skipped.
- Slide pages must inherit the normal document shell, theme, fonts, and `custom.css`; if a slide page theme diverges from doc view, fix the layout/scoping path before adding more slide CSS.
- When slide navigation should preserve sidebars on exit, prefer full navigation (`hx_boost="false"`) for links that return to normal doc routes such as navbar/home, breadcrumbs, title, and "Back to doc view".
- For slide-to-slide movement, prefer the same HTMX main-content swap contract Vyasa already uses for normal page changes; avoid building a parallel client-side deck state machine unless the user explicitly asks for that tradeoff.
- When splitting markdown into slides, make the splitter fence-aware: headings inside code fences or `:::tabs` blocks are content, not slide boundaries.
- Do not invent unsupported frontmatter keys, sort modes, or config keys.
- Supported root `.vyasa` app-level keys now include `theme_preset` for selecting a bundled preset and `theme_primary` for overriding the primary accent color without editing CSS.
- Bundled presets now live inside the package, so `theme_preset = "serene-manuscript"`, `theme_preset = "kinetic-scholar"`, or `theme_preset = "ultra-soft"` should work in normal `pip install vyasa` deployments even without a local `.vyasa-themes` folder.
- When debugging runtime theme switching, verify the actual rendered control and stacking context before retrying CSS fixes; z-index changes are not meaningful until you confirm which element receives the event and which ancestor clips or layers it.
- Never emit real secret values — use explicit placeholders.
