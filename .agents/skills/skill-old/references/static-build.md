# Vyasa Static Site Build

## Usage

```bash
# Build from a directory into ./dist
vyasa build my-notes

# Custom output directory
vyasa build my-notes -o site

# Build from current directory
vyasa build

# Show hidden files in the build
vyasa build my-notes --show-hidden
```

Python API:

```python
from vyasa.build import build_static_site

output_dir = build_static_site(
    input_dir="my-notes",
    output_dir="dist",
)
```

## What gets generated

- `index.html` — from `index.md` or `README.md` in the root
- `posts/*.html` — one file per markdown document
- Static assets copied from the installed package (`scripts.js`, `sidenote.css`, `favicon.png`)

All interactive features are preserved: sidenotes, Mermaid, D2, KaTeX, tabs, syntax highlighting, dark/light theme, TOC, post navigation.

## Server vs static comparison

| Feature | Server (`vyasa .`) | Static (`vyasa build`) |
|---------|-------------------|----------------------|
| Navigation | HTMX (SPA-like) | Regular `<a>` links |
| Rendering | On-demand | Pre-rendered at build time |
| Python required | Yes | No |
| Hot reload | Yes | No (rebuild to update) |
| Hosting | Python server | Any static host |

## Configuration

Static build reads the same `.vyasa` file as server mode. `host` and `port` are ignored during build.

```toml
title = "My Blog"
# host and port are unused in static mode
```

## Deployment examples

**GitHub Pages:**

```bash
vyasa build my-notes -o docs
git add docs
git commit -m "rebuild site"
git push
# Enable GitHub Pages from /docs in repo settings
```

**Netlify / Vercel:**

```bash
vyasa build my-notes -o dist
# Upload or point your hosting to the dist/ folder
```

**Local preview:**

```bash
vyasa build my-notes -o dist
cd dist
python -m http.server 8000
# Open http://localhost:8000
```

## Typical workflow

```bash
# 1. Write content
vim my-notes/new-post.md

# 2. Preview with hot reload
vyasa my-notes

# 3. Build when ready
vyasa build my-notes -o dist

# 4. Test locally
cd dist && python -m http.server 8000
```

## Notes

- Images should use relative paths or be placed under the blog root — the build copies them alongside HTML output.
- The static build uses the same markdown rendering pipeline as server mode, so output is identical.
- Rebuild is required after any content change; there is no incremental build.
