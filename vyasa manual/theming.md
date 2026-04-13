# Theming And CSS

Vyasa theming has two different jobs: shape the site chrome that `render_layout()` assembles, and shape the article body that `markdown_rendering.py` emits. Those jobs look similar in the browser, but they load through different paths and fail for different reasons. This guide is about choosing the right layer before you start writing selectors. By the end, you should know when a change belongs in `.vyasa`, `global.css`, or folder-scoped `custom.css`.

## Pick The Smallest Lever First

Use `.vyasa` for tokens such as `theme_preset`, `theme_primary`, and font stacks. Use `global.css` when the navbar, footer, body background, or keyframes need page-level control. Use folder `custom.css` when the styling should stay inside a subtree; [`get_custom_css_links()`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/sidebar_helpers.py) scopes that file under the active section class for you.

## Reuse From The Demo Folder

[`demo/quick-styling-inline-css.md`](/Users/yeshwanth/Code/Personal/vyasa/demo/quick-styling-inline-css.md) is useful as a reminder that raw HTML and inline styles still work when you need a one-off visual proof. That page belongs as an example, not as the theming strategy itself, because the durable hooks live in the layout classes such as `.vyasa-navbar-shell`, `.vyasa-main-shell`, `.vyasa-sidebar`, and `.vyasa-footer-card` from [`vyasa/layout_page.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/layout_page.py).

## Why These Layers Exist

| Layer | Why you would choose it |
|---|---|
| `.vyasa` theme keys | Stable site-wide defaults without touching CSS. |
| `global.css` | Reach `html`, `body`, and shell-level components safely. |
| folder `custom.css` | Keep article styling local to one branch of content. |
| inline HTML or style attrs | Fast experiments and demos that should not become policy. |
