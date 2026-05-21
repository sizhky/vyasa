# Environment And Auth

Environment variables are lower precedence than `.vyasa` and CLI args.
Use them for deployment secrets and host-provided config.

Auth rules:

- Never emit real secrets.
- For OAuth, use explicit placeholders for client id, client secret, and redirect URI.
- For RBAC, keep roles and resource rules explicit.
- Treat per-drawing passwords as config, not markdown content.

When debugging auth, inspect config loading and route guards before changing UI.
