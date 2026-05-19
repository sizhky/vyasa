# Config Examples

Minimal root:

```toml
title = "My Site"
home_sort = "name_asc"
theme_preset = "serene-manuscript"
```

Protected wiki shape:

```toml
auth_enabled = true
users = { alice = "<hashed-password>" }
```

Folder order shape:

```toml
order = ["README.md", "chapter-1.md"]
sort = "name_asc"
```

Use placeholders for secrets and hashes unless the user provides explicit test values.
