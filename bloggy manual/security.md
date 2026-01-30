# Security & Auth

Bloggy supports optional basic authentication for local or internal deployments.

## Authentication (optional)

Set `username` and `password` in your `.bloggy` file or via `BLOGGY_USER` / `BLOGGY_PASSWORD` environment variables to enable session-based authentication. When enabled:

- **Beforeware middleware**: Intercepts all requests (except login page, static files, and CSS/JS)
- **Login flow**: 
  - Unauthenticated users redirected to `/login` with `next` URL saved in session
  - Login form uses MonsterUI styling (UK input classes, styled buttons)
  - Successful login stores username in `request.session["auth"]`
  - Redirects to original `next` URL after authentication
- **Error handling**: Invalid credentials show red error message below form
- **Route exclusions**: RegEx patterns skip auth for `^/login$`, `^/_sidebar/.*`, `^/static/.*`, `.*\.css`, `.*\.js`

Authentication is completely optional—if no credentials configured, Beforeware is set to `None` and all routes are publicly accessible.

## Google OAuth (optional)

Bloggy can also use Google OAuth for login if configured. This is fully optional and only activated when `client_id` and `client_secret` are set.

Install OAuth dependency (optional):

```bash
pip install "bloggy[auth]"
```

```toml
[google_oauth]
client_id = "your-google-client-id"
client_secret = "your-google-client-secret"
allowed_domains = ["example.com"] # optional
allowed_emails = ["alice@example.com"] # optional
```

Environment variables:

- `BLOGGY_GOOGLE_CLIENT_ID`
- `BLOGGY_GOOGLE_CLIENT_SECRET`
- `BLOGGY_GOOGLE_ALLOWED_DOMAINS` (comma-separated)
- `BLOGGY_GOOGLE_ALLOWED_EMAILS` (comma-separated)

When enabled:
- Login page shows a **Continue with Google** button.
- Google users are stored in the session with `provider = "google"` and their email.
- If `allowed_domains` or `allowed_emails` are set, only matching accounts can sign in.

## RBAC (optional)

Role-based access control can be configured to protect specific paths. If `rbac` is configured without any auth provider, RBAC is ignored to avoid lockouts.

```toml
[rbac]
enabled = true
default_roles = ["reader"]
user_roles = { "alice@example.com" = ["admin"], "bob" = ["editor"] }
role_users = { "admin" = ["alice@example.com"], "editor" = ["bob"] }

[[rbac.rules]]
pattern = "^/admin"
roles = ["admin"]

[[rbac.rules]]
pattern = "^/private"
roles = ["admin", "editor"]
```

Notes:
- If `auth_required = false`, only the RBAC-protected paths require login.
- If `auth_required = true` (default when any auth is configured), all routes require login.
- If both `user_roles` and `role_users` are provided, roles are unioned at runtime.

### Security Features
- **HTML escaping**: Code blocks automatically escaped via `html.escape()`
- **External link protection**: `rel="noopener noreferrer"` on external links
- **Path validation**: Relative path resolution checks if resolved path is within root
- **Session-based auth**: Uses Starlette sessions, not exposed in URLs
- **CSRF protection**: Forms use POST with `enctype="multipart/form-data"`
