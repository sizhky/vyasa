# MkDocs Compatibility

Vyasa can serve an existing MkDocs project without changes to the project. When Vyasa starts in a folder that has an `mkdocs.yml` (or `mkdocs.yaml`) and no `.vyasa`, it reads the MkDocs configuration and enables the built-in `mkdocs` extension. The extension implements the MkDocs `nav`, the Material for MkDocs header tabs, and the Markdown syntax of Python-Markdown and pymdown-extensions. The code is in [`vyasa/extensions_builtin/mkdocs/`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/extensions_builtin/mkdocs/).

## Start A Server For An MkDocs Project

```bash
cd my-mkdocs-project
vyasa
```

`vyasa path/to/my-mkdocs-project` gives the same result. Vyasa serves `docs_dir` (default `docs`) as the content root and uses `site_name` as the site title. If the folder also has a `.vyasa`, Vyasa uses `.vyasa` and ignores `mkdocs.yml`. Set `VYASA_IGNORE_MKDOCS=true` to serve the folder as a plain Vyasa site.

## Configuration

[`config.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/extensions_builtin/mkdocs/config.py) translates `mkdocs.yml` into Vyasa configuration keys. The raw MkDocs data stays available to the extension under the `mkdocs` key. The YAML loader accepts `!ENV`, `!relative`, and `!!python/name:` tags, and it merges an `INHERIT` parent file the same way MkDocs does: nested mappings merge, and every other value is replaced.

| `mkdocs.yml` key | Vyasa behavior |
|---|---|
| `site_name` | Site title. |
| `docs_dir` | Content root. |
| `nav` | Sidebar tree, header tabs, and prev/next order. See [Navigation](#navigation). |
| `exclude_docs`, `not_in_nav`, `draft_docs` | Pages that match are left out of the derived nav. Vyasa still serves them by URL. |
| `theme.font.text`, `theme.font.code` | Body, heading, UI, and code fonts. |
| `theme.palette.primary`, `accent` | Link and accent colour (`theme_primary`). An `extra_css` value for `--md-typeset-a-color` or `--md-primary-fg-color` wins over the palette name. |
| `theme.features` | `navigation.tabs`, `navigation.sections`, `navigation.expand`, `navigation.indexes`, and `content.action.edit` change Vyasa behavior. Other flags are ignored. |
| `extra_css`, `extra_javascript` | Added to every page. Paths resolve against `docs_dir`. |
| `repo_url`, `repo_name` | Repository link in the navbar. |
| `edit_uri`, `edit_uri_template` | **Edit** button on each page. The button appears when one of these keys is set or `content.action.edit` is on. |
| `copyright` | Footer text. HTML is allowed. |
| `markdown_extensions` | Selects which MkDocs syntax the translator rewrites. See [Markdown](#markdown). |

## Navigation

[`nav.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/extensions_builtin/mkdocs/nav.py) parses `nav` into a tree of pages, sections, and links. Each page title comes from the nav entry. If the entry has no title, the title comes from the page's front matter `title`, then its first H1, then its filename. When `nav` is absent, the tree is derived from the files the same way MkDocs derives it: `index.md` or `README.md` first, then files, then subdirectories as sections. A nav entry that points to a missing file is shown with a strike-through and is not a link.

[`render.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/extensions_builtin/mkdocs/render.py) renders the tree with the same row views as the filesystem tree, so bookmarks, pins, and the active-row highlight work in the same way.

- `navigation.tabs`: each top-level nav item becomes a tab below the navbar. A section tab links to the section's first page. On wide screens the sidebar shows only the active tab's pages. [`mkdocs.js`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/extensions_builtin/mkdocs/static/mkdocs.js) updates the active tab after each htmx navigation.
- `navigation.sections`: second-level sections (first-level without tabs) render as labels that stay open.
- `navigation.expand`: every section starts open.
- `navigation.indexes`: a section whose first page is `index.md` links to that page. The page is removed from the section's children.

Prev/next links follow nav order. A page that is not in the nav gets no prev/next links, as in MkDocs.

## Markdown

[`dialect.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/extensions_builtin/mkdocs/dialect.py) rewrites MkDocs syntax into Vyasa Markdown before Vyasa parses a page. The table of contents uses the same rewritten text. A construct is rewritten only when its extension is listed in `markdown_extensions`. [`html_post.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/extensions_builtin/mkdocs/html_post.py) finishes two constructs after rendering: attribute lists and abbreviations.

| Extension | Syntax | Vyasa output |
|---|---|---|
| `admonition` | `!!! note "Title"` with an indented body | Vyasa callout. The body is full Markdown and can nest. |
| `pymdownx.details` | `??? tip`, `???+ tip` | Collapsible Vyasa callout, closed or open. |
| `pymdownx.tabbed` | `=== "Label"` with an indented body | Vyasa tab set. `===!` starts a new set and `===+` selects a tab. |
| `pymdownx.blocks.*` | `/// note \| Title`, `/// details`, `/// tab`, `/// html`, `/// define`, `/// caption` | Callout, collapsible callout, tab set, HTML element, definition list, caption. |
| `md_in_html` | `<div markdown>` | The HTML element, with its content parsed as Markdown. Material grids (`<div class="grid cards" markdown>`) get grid CSS. |
| `def_list` | `Term` then `:   Definition` | `<dl>` with Markdown in each definition. |
| `attr_list` | `{ #id .class key=value }` after a link, image, or icon, on a heading, or on the line after a paragraph | The attributes on that element. `.md-button` and `.md-button--primary` get button CSS. |
| `abbr` | `*[HTML]: Hyper Text Markup Language` | `<abbr title>` on each matching word outside code. |
| `toc` | `[TOC]` | A list of the page's headings. |
| `pymdownx.snippets` | `--8<-- "file.md"`, line ranges, named sections, block form, `auto_append` | The file content, read relative to `base_path`. With `restrict_base_path` (the default), files outside `base_path` are not read. URLs are not fetched. |
| `pymdownx.superfences`, `pymdownx.highlight` | ```` ```py title="a.py" hl_lines="2 3" ````, ```` ``` { .py } ```` | Vyasa code block with `title=` and `hl=`. Mermaid custom fences render as Vyasa Mermaid. |
| `pymdownx.inlinehilite` | `` `#!python len(x)` `` | Inline code without the language prefix. |
| `pymdownx.emoji` | `:smile:`, `:material-penguin:`, `:fontawesome-brands-github:`, `:octicons-heart-16:`, `:simple-python:` | Unicode emoji when pymdown-extensions is installed. Icons load as CSS masks from the npm packages that Material uses, through jsDelivr, so they take the text colour. |
| `pymdownx.keys` | `++ctrl+alt+del++` | `<kbd>` keys. |
| `pymdownx.critic` | `{++ ++}`, `{-- --}`, `{~~ ~> ~~}`, `{== ==}`, `{>> <<}` | Insert, delete, substitute, highlight, and comment marks in view mode. |
| `pymdownx.caret`, `pymdownx.tilde`, `pymdownx.mark` | `^^ins^^`, `x^2^`, `H~2~O`, `~~del~~`, `==mark==` | `<ins>`, `<sup>`, `<sub>`, `<del>`, `<mark>`, including inside words. |
| `pymdownx.progressbar` | `[=65% "label"]` | Progress bar. |
| `pymdownx.smartsymbols`, `smarty` | `(c)`, `-->`, `1/2`, `1st`, `--`, `---`, `...` | The typographic characters. `smarty` quotes are not converted. |
| `pymdownx.magiclink` | A bare `https://` URL | A link. Repository shorthands such as `@user` and `#123` are not converted. |
| `pymdownx.arithmatex` | `\(..\)`, `\[..\]`, `\begin{align}` | Vyasa math (`$..$`, `$$..$$`). |
| `pymdownx.fancylists` | `a)`, `i.`, `A.` lists | `<ol type>` lists. |
| `nl2br` | A newline inside a paragraph | A line break. |
| `footnotes`, `tables`, `pymdownx.tasklist`, `wikilinks`, `pymdownx.quotes` | Their usual syntax | Vyasa supports these natively. |

Material image fragments `#only-light` and `#only-dark` hide an image in the other colour scheme. Headings keep Vyasa's anchor IDs. When the MkDocs slug of a heading is different, the heading also gets the MkDocs slug as an anchor, so existing `page.md#slug` links resolve. For example, `## A & B` has the Vyasa ID `a--b` and the MkDocs anchor `a-b`.

Front matter `title` sets the page title. Front matter `hide: [toc]` hides the table of contents, and `hide: [navigation, toc]` hides both sidebars.

## Features Vyasa Does Not Implement

Each item below would need a change to Vyasa's architecture or a Python runtime that MkDocs provides. Each item names the Vyasa feature to use instead.

- Jinja templates, `custom_dir` overrides, and theme partials are not supported. Vyasa has no template layer. Use `.vyasa` themes, `custom.css`, or a layout extension.
- MkDocs plugins (`plugins:`), including `mkdocstrings`, `mkdocs-macros`, `blog`, `tags`, `social`, `offline`, and `i18n`, are not run. Vyasa search replaces the `search` plugin. Vyasa code includes (`{* path/to/file.py *}`) can show source code in place of `mkdocstrings`.
- `hooks:` (Python event hooks) are not run.
- `use_directory_urls` is not applied. Vyasa page URLs are `/posts/<path>`. Relative `.md` links in Markdown still resolve.
- Material code annotations (`# (1)!` with a following list) render as the code comment and an ordered list.
- `hide: [navigation]` without `toc` has no effect. Vyasa can hide both sidebars or only the TOC.
- `theme.logo`, `theme.favicon`, and `theme.icon.*` are not applied. Vyasa uses the favicon file in the content root.
- `navigation.path` breadcrumbs follow folders, not nav sections.
- `extra_css` rules for Material classes such as `.md-header` and `.md-typeset` match nothing, because Vyasa pages do not use those classes.
- Static builds (`vyasa build`) apply the Markdown translation, but the sidebar, tabs, and prev/next links come from the filesystem tree. The static build has its own tree renderer in [`build.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/build.py).
- Multi-paragraph footnotes, nested content tabs, and the `smarty` quote conversion are not supported.

## Design Notes

Block constructs such as admonitions, content tabs, definition lists, and `md_in_html` are rewritten into an HTML wrapper with blank lines around a Markdown body. A CommonMark HTML block ends at a blank line, so the renderer parses the body as ordinary Markdown, and nested constructs need no second render pass. The wrapper markup comes from the same functions that render native Vyasa callouts and tabs (`_render_callout` and `render_tabs_html`), so MkDocs pages and Vyasa pages produce the same HTML.

The rewrite runs through the `markdown.translator` extension hook. Vyasa calls every registered translator first in `from_md` and in TOC heading extraction, so the TOC and the rendered page see the same headings. Other hooks added for this extension:

- `content_source.posts_tree`: replaces the filesystem sidebar tree.
- `content_source.adjacent`: replaces filesystem prev/next order.
- `layout.navbar_band`: adds a full-width row below the navbar.
- `documents.page_options`: lets front matter change `show_toc` and `show_sidebar`.
