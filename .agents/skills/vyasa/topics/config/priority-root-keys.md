# Priority And Root Keys

Precedence:

1. CLI args
2. `.vyasa`
3. Environment variables
4. Defaults

Root `.vyasa` app keys include server, auth, layout, reload, filtering, annotations, drawing passwords, OAuth, RBAC, and theme keys.
Supported theme keys include `theme_preset` and `theme_primary`.
Bundled presets include `serene-manuscript`, `kinetic-scholar`, and `ultra-soft`.

Homepage card feed:

- `home_sort = "name_asc"` or `"name_desc"` sorts cards when no root page exists.
- Root `ignore = [...]` filters homepage cards too.
- Folder `sort` is for sidebar/tree order, not homepage cards.
