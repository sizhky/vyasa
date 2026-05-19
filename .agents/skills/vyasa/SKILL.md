---
name: vyasa
description: Use for Vyasa project work, Vyasa site authoring, .vyasa config, markdown features, diagrams, theming, static builds, extensions, auth/RBAC, slides, and repo-aware implementation.
---

# Vyasa

Load the smallest relevant files. Do not read a whole topic when a narrow drawer exists.

## Start

1. Read `core/triage.md`.
2. Read one route file from `routes/`.
3. Read only the topic drawers named by that route.
4. For repo code changes, inspect the implementation file before editing.
5. Prefer existing Vyasa contracts over new syntax or shell-global behavior.

## Routes

| Request | Route |
|---|---|
| `.vyasa`, CLI, env, auth, RBAC | `routes/config.md` |
| Markdown authoring or rendering | `routes/markdown.md` |
| Mermaid, D2, Cytograph, `.cytree` | `routes/diagrams.md` |
| CSS, theme presets, shell styling | `routes/theming.md` |
| Static build or deploy | `routes/static-build.md` |
| Debug/performance tracing | `routes/debug-perf.md` |
| Extensions or new features | `routes/extensions.md` |
| Slides/decks | `routes/slides.md` |

## Hard Rules

- Do not invent unsupported frontmatter, config keys, sort modes, or fence syntax.
- New feature logic usually belongs in an extension, not `core.py`.
- Runtime and static build output must agree.
- Never emit real secret values; use explicit placeholders.
