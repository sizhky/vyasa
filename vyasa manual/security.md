# Security And Access

Vyasa security is route-aware rather than content-export oriented: the live app decides whether a request should pass, redirect to login, or stop with `403` before the page is rendered. The core checks are assembled in [`make_user_auth_before()`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/auth/runtime.py), with config coming from [`VyasaConfig.get_google_oauth()`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/config.py) and [`VyasaConfig.get_rbac()`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/config.py). This guide is about how to think about auth in a live Vyasa site, not how to build a generic identity system. The important distinction is between "who may log in" and "which paths those people may read."

## What You Can Turn On

```toml
auth_required = true

[google_oauth]
client_id = "REPLACE_ME"
client_secret = "REPLACE_ME"
allowed_domains = ["example.com"]

[rbac]
enabled = true
default_roles = ["reader"]
```

Local username/password auth and Google OAuth can coexist on the same login page. RBAC then maps users to roles and roles to path patterns through [`resolve_roles()`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/auth/policy.py) and [`is_allowed()`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/auth/policy.py).

## Why The Split Exists

| Concern | Why it is separate |
|---|---|
| login provider | Answers who may establish an identity at all. |
| role resolution | Turns identity into stable capabilities. |
| path rules | Lets one site host public and restricted branches together. |
| drawing passwords | Protects individual Excalidraw assets without inventing full RBAC for every sketch. |
