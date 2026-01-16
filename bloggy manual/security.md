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

### Security Features
- **HTML escaping**: Code blocks automatically escaped via `html.escape()`
- **External link protection**: `rel="noopener noreferrer"` on external links
- **Path validation**: Relative path resolution checks if resolved path is within root
- **Session-based auth**: Uses Starlette sessions, not exposed in URLs
- **CSRF protection**: Forms use POST with `enctype="multipart/form-data"`
