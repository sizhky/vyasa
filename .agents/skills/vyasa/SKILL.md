---
name: vyasa
description: Use when working on the Vyasa project or when the user wants help using Vyasa itself. Invoke for `.vyasa` TOML config, content organization, markdown features, theming, Mermaid or D2 rendering, auth and RBAC, static build behavior, or repo-aware Vyasa implementation work.
---

# Vyasa

Use this skill for real Vyasa behavior. All reference files are self-contained — no external docs or repo clone needed.

| If you want to... | Read |
|---|---|
| Configure `.vyasa`, CLI flags, env vars, RBAC, OAuth | `references/config.md` |
| Write or explain markdown features | `references/markdown.md` |
| Style with CSS or theming | `references/theming.md` |
| Create Mermaid or D2 diagrams | `references/diagrams.md` |
| Build or deploy a static site | `references/static-build.md` |

Start here:

1. Identify the request type from the table above and read only that file.
2. Prefer existing Vyasa conventions over inventing new ones.
3. When generating `.vyasa`, output valid TOML with only supported keys.
4. When changing repo code, cite the concrete file that implements the behavior.
5. For recent markdown work, check `references/markdown.md` for Obsidian-style callouts, aliases, nesting/folding, code snippet includes, and explicit heading IDs/permalinks before inventing new syntax.
6. For code-block color changes, check `references/theming.md` for the `--vyasa-code-*` CSS variables so users can override palettes from `custom.css`.
7. For books/tutorials/docs sequences, prefer Vyasa's built-in sibling previous/next pager before inventing manual chapter-footer HTML; it follows the folder's `.vyasa` ordering, not raw filename sort.
8. For shell theming, prefer Vyasa's explicit stable hooks over positional selectors: `.vyasa-navbar-shell`, `.vyasa-navbar-card`, `.vyasa-content-grid`, `.vyasa-main-shell`, `.vyasa-sidebar`, `.vyasa-sidebar-card`, `.vyasa-sidebar-toggle`, `.vyasa-sidebar-body`, `.vyasa-posts-sidebar`, `.vyasa-toc-sidebar`, `.vyasa-mobile-panel`, `.vyasa-mobile-panel-header`, `.vyasa-mobile-panel-body`, `.vyasa-footer-shell`, `.vyasa-footer-card`.
9. For FastHTML or MonsterUI form controls, inspect the rendered HTML before wiring DOM events; helper components may wrap or hide the native input. If you need a direct `change` handler or debug-only control, prefer a plain native element over a styled helper.
10. For Vyasa boot-time scripts, only depend on data available in the head. Do not read globals from `head-init.js` that are emitted later from body/navbar markup; if the data is body-scoped, apply it from the main runtime script after DOM creation.

Core rules:

- Treat `.vyasa` as a TOML file, usually at repo root or a content folder.
- Respect precedence: CLI args > `.vyasa` > environment variables > defaults.
- Distinguish root app config from folder-local ordering and navigation config.
- In the lazy posts tree sidebar, a folder-local `.vyasa` is also a branch-visibility marker: even if the folder has no direct markdown files and only nested subfolders, the folder should still appear so the branch can lazy-load.
- For callouts, emit Obsidian-style callouts like `> [!note] Title` or `> [!warning]- Title`; prefer aliases already supported by Obsidian (`warn`, `error`, `faq`, `check`, `done`, `summary`, `tldr`, `cite`, etc.) rather than inventing new keywords.
- For richer task cards, prefer markdown task-list items like `- [ ] Task | owner: Jane | deadline: Tomorrow | priority: high` over custom HTML tags; supported metadata families live in `references/markdown.md`.
- Use `+` and `-` fold markers when the callout should clearly default open or closed, and prefer nested `> > [!todo]` callouts over ad hoc indentation patterns.
- For custom callout types, rely on `data-callout="your-type"` plus `custom.css` rather than inventing special renderer logic unless the user explicitly wants core support.
- For navbar, footer, sidebar, and mobile-panel styling, do not teach or rely on positional selectors like `#site-navbar > *`, `#site-footer > *`, or `#posts-sidebar details > summary`; target the explicit Vyasa hook classes instead so runtime and static-build themes stay stable.
- For Mermaid labels, use literal `<br/>` for line breaks inside nodes and edge text; do not emit `\n`.
- Do not invent unsupported frontmatter keys, sort modes, or config keys.
- Supported root `.vyasa` app-level keys now include `theme_preset` for selecting a bundled preset and `theme_primary` for overriding the primary accent color without editing CSS.
- Bundled presets now live inside the package, so `theme_preset = "serene-manuscript"`, `theme_preset = "kinetic-scholar"`, or `theme_preset = "ultra-soft"` should work in normal `pip install vyasa` deployments even without a local `.vyasa-themes` folder.
- When debugging runtime theme switching, verify the actual rendered control and stacking context before retrying CSS fixes; z-index changes are not meaningful until you confirm which element receives the event and which ancestor clips or layers it.
- Never emit real secret values — use explicit placeholders.
