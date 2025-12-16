# Bloggy Static Site Generator

Bloggy now supports generating completely standalone static websites from your markdown files! It's janky and need some polishing, but it works.

## Usage

### Command Line

```bash
# Build static site from demo directory
bloggy build demo

# Build to a custom output directory
bloggy build demo -o my-static-site

# Build from current directory
bloggy build
```

### Python API

```python
from bloggy.build import build_static_site

# Build static site
output_dir = build_static_site(
    input_dir='demo',      # Directory with markdown files
    output_dir='dist'      # Output directory (default: ./dist)
)
```

## What Gets Generated

The static site generator creates:

1. **HTML Files**: Each markdown file becomes a standalone HTML page
   - `index.html` from `index.md` or `README.md` in the root
   - `posts/*.html` for all other markdown files

2. **Static Assets**: Copies from `bloggy/static/`:
   - `sidenote.css` - Sidenote styling
   - `scripts.js` - Interactive features (Mermaid zoom/pan)
   - `favicon.png` - Site icon

3. **Complete Standalone Site**:
   - No Python runtime required
   - No server needed
   - Works with any static hosting (GitHub Pages, Netlify, Vercel, etc.)

## Features Preserved

All bloggy features work in the static site:

- ✅ **Sidenotes/Footnotes**: Interactive margin notes
- ✅ **Mermaid Diagrams**: With zoom/pan/reset controls
- ✅ **Math Rendering**: KaTeX for LaTeX equations
- ✅ **Syntax Highlighting**: Code blocks with highlight.js
- ✅ **Dark/Light Theme**: Theme toggle with localStorage
- ✅ **Tabs**: Interactive tabbed content
- ✅ **Table of Contents**: Sidebar navigation for each page
- ✅ **Post Navigation**: Collapsible folder tree
- ✅ **Responsive Design**: Mobile-friendly layout

## How It Works

1. **Discovers** all `.md` files in your directory
2. **Parses** frontmatter and markdown content
3. **Renders** markdown to HTML using the same rendering pipeline as the server
4. **Generates** complete HTML pages with:
   - Navigation sidebar (all posts)
   - Table of contents (per page)
   - Theme toggle
   - All interactive features
5. **Copies** static assets (CSS, JS, images)
6. **Outputs** a fully functional static website

## Deployment

### GitHub Pages

```bash
# Build the site
bloggy build demo -o docs

# Push to GitHub and enable GitHub Pages from /docs folder
git add docs
git commit -m "Build static site"
git push
```

### Netlify

```bash
bloggy build demo -o dist
# Upload dist/ folder to Netlify
```

### Local Preview

```bash
cd dist
python -m http.server 8000
# Open http://localhost:8000
```

## Differences from Server Mode

| Feature | Server Mode | Static Mode |
|---------|-------------|-------------|
| Navigation | HTMX (SPA-like) | Regular links (multi-page) |
| Rendering | On-demand | Pre-rendered |
| Python Required | ✅ Yes | ❌ No |
| Hot Reload | ✅ Yes | ❌ No (rebuild needed) |
| Hosting | Requires Python server | Any static host |
| Performance | Fast (cached) | Very fast (pre-rendered) |

## Configuration

Uses the same `.bloggy` configuration file as server mode:

```toml
# .bloggy
title = "My Blog"
host = "127.0.0.1"  # Not used in static mode
port = 5001         # Not used in static mode
```

## Tips

1. **Preview Before Building**: Use `bloggy demo` to preview your site with hot reload
2. **Rebuild After Changes**: Static sites need rebuilding when content changes
3. **Check Output**: Review `dist/index.html` to verify the build
4. **Assets Path**: Ensure images use relative paths or are in the static folder

## Example Workflow

```bash
# 1. Write content
vim my-blog/new-post.md

# 2. Preview locally with hot reload
bloggy my-blog

# 3. Build static site when ready
bloggy build my-blog -o site

# 4. Deploy
cd site
python -m http.server 8000  # Test locally
# Then deploy to your hosting provider
```
