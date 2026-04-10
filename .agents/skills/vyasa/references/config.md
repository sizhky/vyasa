# Vyasa Configuration Reference

## Installation

```bash
pip install vyasa
# OAuth support (Google login):
pip install "vyasa[auth]"
```

## CLI

```bash
vyasa .                          # serve current directory on port 5001
vyasa /path/to/notes             # serve a specific directory
vyasa . --host 0.0.0.0           # expose to network
vyasa . --port 8080              # custom port
vyasa . --no-reload              # disable hot reload
vyasa . --user admin --password secret   # enable basic auth
vyasa build demo -o ./dist       # generate static site
```

## Configuration priority

CLI args > `.vyasa` file > environment variables > defaults.

**Note:** `--user` / `--password` CLI flags are written to env vars at startup, so a `.vyasa` file with `username`/`password` will override them. Use `.vyasa` or env vars for credentials, not both.

## `.vyasa` file (TOML)

Place `.vyasa` in your blog root (or any subfolder for folder-level ordering).

### Root-level keys

```toml
# Server
title    = "My Blog"     # default: derived from folder name
root     = "."           # path to markdown files
host     = "127.0.0.1"  # use "0.0.0.0" for network access
port     = 5001

# Auth (basic)
username     = "admin"
password     = "hunter2"
auth_required = true     # default: true when any auth is configured

# Layout
layout_max_width = "75vw"   # Tailwind class (e.g. "max-w-7xl") or CSS size ("90vw", "1200px")
sidebars_open    = false    # open sidebars on load
show_hidden      = false    # show dotfiles in sidebar
log_file         = false    # write DEBUG logs to vyasa.log

# Reload exclusions (merged with built-in defaults)
reload_exclude = [".obsidian", "cache"]

# Navigation filtering
abbreviations = ["API", "UI", "DB"]   # words to keep uppercase in titles
ignore  = ["drafts", "private"]       # folders to hide
include = ["posts", "docs"]           # whitelist (empty = show all)

# Annotations (inline text highlighting and comments)
[annotations]
enabled = true   # default: false

# Per-drawing passwords
[drawings_passwords]
"sketches/secret.excalidraw" = "mypassword"

# Google OAuth
[google_oauth]
client_id      = "your-client-id"
client_secret  = "your-client-secret"
allowed_domains = ["example.com"]           # optional domain allowlist
allowed_emails  = ["alice@example.com"]     # optional email allowlist

# RBAC
[rbac]
enabled       = true
default_roles = ["reader"]
user_roles    = { "alice@example.com" = ["admin"], "bob" = ["editor"] }
role_users    = { "admin" = ["alice@example.com"], "editor" = ["bob"] }

[[rbac.rules]]
pattern = "^/posts/private"
roles   = ["admin", "editor"]

[[rbac.rules]]
pattern = "^/posts/admin"
roles   = ["admin"]
```

### Folder-level ordering keys

Place a `.vyasa` file inside any content folder to control how its contents are listed in the sidebar. Only these keys are used at folder level:

```toml
# Pin specific items first (exact filenames including extension)
order = ["intro.md", "getting-started.md", "reference"]

# Sort the remaining items
sort             = "name_asc"   # name_asc | name_desc | mtime_asc | mtime_desc
folders_first    = true         # folders before files in sorted remainder
folders_always_first = false    # move ALL folders to top after full ordering

# layout_max_width, abbreviations, ignore, include also work at folder level
```

`order` pins listed items first (in that order). Items not in `order` are sorted by `sort`. `folders_always_first` runs last, grouping all folders above all files while preserving their relative order.

`abbreviations` percolates from parent to child folders — define it once in the nearest common ancestor and omit it from children. Child folders inherit the parent's abbreviations automatically.

### Example: minimal root config

```toml
title = "Tech Notes"
port  = 8080
```

### Example: protected private wiki

```toml
title         = "Private Wiki"
username      = "admin"
password      = "changeme"
auth_required = true

[google_oauth]
client_id     = "REPLACE_ME"
client_secret = "REPLACE_ME"
allowed_domains = ["mycompany.com"]
```

### Example: folder ordering

```toml
# /notes/.vyasa
order         = ["README.md", "setup.md"]
sort          = "mtime_desc"
folders_first = true
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VYASA_ROOT` | `.` | Path to markdown files |
| `VYASA_TITLE` | folder name | Blog title |
| `VYASA_HOST` | `127.0.0.1` | Server host |
| `VYASA_PORT` | `5001` | Server port |
| `VYASA_USER` | — | Basic auth username |
| `VYASA_PASSWORD` | — | Basic auth password |
| `VYASA_AUTH_REQUIRED` | — | `true`/`false` |
| `VYASA_LAYOUT_MAX_WIDTH` | `75vw` | Layout width |
| `VYASA_SIDEBARS_OPEN` | `false` | Sidebars open on load |
| `VYASA_SHOW_HIDDEN` | `false` | Show hidden files |
| `VYASA_RELOAD_EXCLUDE` | — | Comma-separated extra excludes |
| `VYASA_GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `VYASA_GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `VYASA_GOOGLE_ALLOWED_DOMAINS` | — | Comma-separated domains |
| `VYASA_GOOGLE_ALLOWED_EMAILS` | — | Comma-separated emails |
| `VYASA_RBAC_ENABLED` | — | Force enable/disable RBAC |
| `VYASA_ANNOTATIONS_ENABLED` | `false` | Enable inline annotations |

## Auth notes

- Basic auth and Google OAuth can be used together — the login page shows both options.
- If `auth_required = false`, only paths matching RBAC rules require login.
- RBAC is silently ignored if no auth provider is configured (prevents accidental lockout).
- `user_roles` and `role_users` are unioned at runtime — define either or both.
- Google OAuth requires `pip install "vyasa[auth]"`.
