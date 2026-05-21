# Where CSS Goes

Use project CSS surfaces already supported by Vyasa.
CSS may be global, folder-scoped, or folder-level `global.css` depending on intent.

Rules:

- Use folder-scoped CSS for local content styling.
- Use global CSS for site-wide shell/content styling.
- Do not hardcode around the theme system when a variable or hook exists.
- Theme implementation lives in `vyasa/theme_extensions/`.
- `vyasa/extensions_builtin/themes/` is compatibility surface, not primary new theme logic.
