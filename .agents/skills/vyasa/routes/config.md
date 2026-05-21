# Config Route

Read these drawers as needed:

- `topics/config/installation-cli.md`
- `topics/config/priority-root-keys.md`
- `topics/config/folder-ordering.md`
- `topics/config/examples.md`
- `topics/config/env-auth.md`

Rules:

- Treat `.vyasa` as TOML.
- Precedence is CLI args > `.vyasa` > environment variables > defaults.
- Distinguish root app config from folder-local ordering/navigation config.
- Use placeholders for secrets.
