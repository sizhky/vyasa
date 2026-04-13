# Theming And CSS

Vyasa theming has two different jobs: shape the site chrome that `render_layout()` assembles, and shape the article body that `markdown_rendering.py` emits. Those jobs look similar in the browser, but they load through different paths and fail for different reasons. This guide is about choosing the right layer before you start writing selectors. By the end, you should know when a change belongs in `.vyasa`, `global.css`, or folder-scoped `custom.css`.

## Pick The Smallest Lever First

Use `.vyasa` for tokens such as `theme_preset`, `theme_primary`, font stacks, and the live code themes `code_theme_light` / `code_theme_dark`. Use `global.css` when the navbar, footer, body background, or keyframes need page-level control. Use folder `custom.css` when the styling should stay inside a subtree; [`get_custom_css_links()`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/sidebar_helpers.py) scopes that file under the active section class for you.

## Reuse From The Demo Folder

[`demo/quick-styling-inline-css.md`](/Users/yeshwanth/Code/Personal/vyasa/demo/quick-styling-inline-css.md) is useful as a reminder that raw HTML and inline styles still work when you need a one-off visual proof. That page belongs as an example, not as the theming strategy itself, because the durable hooks live in the layout classes such as `.vyasa-navbar-shell`, `.vyasa-main-shell`, `.vyasa-sidebar`, and `.vyasa-footer-card` from [`vyasa/layout_page.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/layout_page.py).

## Why These Layers Exist

| Layer | Why you would choose it |
|---|---|
| `.vyasa` theme keys | Stable site-wide defaults without touching CSS. |
| `global.css` | Reach `html`, `body`, and shell-level components safely. |
| folder `custom.css` | Keep article styling local to one branch of content. |
| inline HTML or style attrs | Fast experiments and demos that should not become policy. |

## Code Themes And Inline Code

Vyasa now picks highlight.js styles from config instead of hardcoding MonsterUI's default pair. Set `code_theme_light` and `code_theme_dark` in `.vyasa` to pick any bundled highlight.js theme name, then let the runtime swap between them as the site mode changes.

```toml
theme_preset = "serene-manuscript"
theme_primary = "#45655b"
code_theme_light = "github"
code_theme_dark = "github-dark"
code_line_numbers = true
```

`code_line_numbers = true` is the default. Set it to `false` when a site wants cleaner snippets by default, then opt specific blocks back in with `ln`; when the global default is on, use `nln` on a fence or include to suppress numbers for one snippet. Inline code and block chrome now use dedicated CSS tokens from [`vyasa/static/header.css`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/static/header.css): `--vyasa-inline-code-bg`, `--vyasa-inline-code-fg`, `--vyasa-inline-code-border`, plus the existing `--vyasa-code-*` block tokens. If a preset gets the overall tone right but code still feels off, override those variables before reaching for selector-heavy CSS.
