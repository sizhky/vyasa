# Configuration & CLI

This guide centralizes the runtime flags, `.bloggy` settings, and environment variables.

## CLI

```bash
# Run on a directory (default port 5001)
bloggy .

# Custom host/port
bloggy . --host 0.0.0.0 --port 8000

# Disable auto-reload
bloggy . --no-reload

# Enable auth
bloggy . --user admin --password secret

# Build static site
bloggy build . -o ./dist
```

## Configuration

Bloggy supports four ways to configure your blog (in priority order):

1. cli arguments (e.g. `bloggy /path/to/markdown`) - Highest priority
1. **[`.bloggy` configuration file](#using-a-.bloggy-configuration-file)** (TOML format)
2. **Environment variables** - Fallback
3. **Default values** - Final fallback

### Using a `.bloggy` Configuration File

Create a `.bloggy` file in your blog directory or current directory:

```toml
# Blog title (default: derives from root folder name via slug_to_title)
title = "My Awesome Blog"

# Root folder containing markdown files (default: current directory)
root = "."

# Server host (default: 127.0.0.1)
# Use "0.0.0.0" to make the server accessible from network
host = "127.0.0.1"

# Server port (default: 5001)
port = 5001

# Optional authentication credentials (enables Beforeware middleware)
username = "admin"
password = "hunter2"
```

All settings in the `.bloggy` file are optional. The configuration is managed by the `Config` class in `bloggy/config.py`.

### Layout Width Configuration

Set a single `layout_max_width` to control overall width (applies to both sidebar and non-sidebar pages). Values accept Tailwind max-width classes (e.g. `max-w-7xl`) or raw CSS sizes (e.g. `90vw`, `1200px`). Default is `75vw`.

```toml
layout_max_width = "90vw"
```

Environment variable equivalent:

- `BLOGGY_LAYOUT_MAX_WIDTH`

Responsive behavior:
- At viewport widths below `1280px`, layout containers are effectively full width.
- Between `1280px` and `~1520px`, the max width eases from `100%` to your configured value to avoid a hard jump.
- Above that, the configured width is fully applied.

### Custom Sidebar Ordering

Place a `.bloggy` file in any folder to control the sidebar order for that folder. `.bloggy` uses TOML format. Use `order` to pin items first, then `sort` and `folders_first` for the remainder.

```toml
# Items listed in order are shown first. Use exact names (include extensions).
order = ["todo.md", "static-build.md", "docs"]

# Sorting for items not listed in order
sort = "name_asc"          # name_asc, name_desc, mtime_asc, mtime_desc
folders_first = true
folders_always_first = false
```

Notes:
- `folders_first` only affects the items not listed in `order`.
- `folders_always_first` moves all folders to the top after ordering/sorting, while preserving their relative order.

### Environment Variables

You can also use environment variables as a fallback:

- `BLOGGY_ROOT`: Path to your markdown files (default: current directory)
- `BLOGGY_TITLE`: Your blog's title (default: folder name converted via `slug_to_title()`)
- `BLOGGY_HOST`: Server host (default: 127.0.0.1)
- `BLOGGY_PORT`: Server port (default: 5001)
- `BLOGGY_USER`: Optional username to enable session-based authentication
- `BLOGGY_PASSWORD`: Optional password paired with `BLOGGY_USER`

### Examples

**Using a `.bloggy` file:**

```bash
# Create a .bloggy file in your blog directory
title = "My Tech Blog"
port = 8000
host = "0.0.0.0"
```

**Using environment variables:**

```bash
export BLOGGY_ROOT=/path/to/your/markdown/files
export BLOGGY_TITLE="My Awesome Blog"
export BLOGGY_PORT=8000
export BLOGGY_HOST="0.0.0.0"
bloggy
```

**Passing directory as argument:**

```bash
bloggy /path/to/your/markdown/files
```

**Enabling authentication:**

```.env
# Via .bloggy file
title = "Private Blog"
username = "admin"
password = "secret123"
```

```bash
# Or via environment variables
export BLOGGY_USER="admin"
export BLOGGY_PASSWORD="secret123"
```

**Configuration priority example:**

If you have both a `.bloggy` file with `port = 8000` and an environment variable `BLOGGY_PORT=9000`, the `.bloggy` file takes precedence and port 8000 will be used.
