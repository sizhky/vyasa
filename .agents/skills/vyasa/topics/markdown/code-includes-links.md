# Code Includes And Links

## Wikilinks

Wikilinks supported shapes include:

- `[[note]]`
- `[[note|label]]`
- `[[note#Heading]]`
- `[[note#Heading#Subheading]]`
- `[[#Same Note Heading]]`
- aliases, folder notes, explicit IDs, and relative paths like `[[../sibling]]`

If a bare wikilink or alias matches multiple notes, Vyasa leaves raw `[[...]]` unresolved.
Use a path-qualified target like `[[area/topic]]` when duplicates exist.

## Folder Notes

For folder-note links, prefer linking the folder route:

```md
[[guide]]
```

Do not prefer:

```md
[[guide/index]]
```

The canonical route is the folder URL.

## Headings

For heading links, prefer real heading text or explicit IDs already present:

```md
[[guide#Install]]
[[guide#Install#Troubleshooting]]
[[#Current Page Heading]]
```

Do not invent synthetic anchors unless the heading ID is explicitly authored.

## Route Links

For user-facing navigation, prefer route slugs and anchors:

```md
[Guide](/posts/guide#part)
[Local part](guide#part)
```

Do not append `.md` unless the goal is raw markdown source.
Exception: `.md` is valid inside Vyasa code-include syntax.

## Link Preview Positions

Add a position to an internal Markdown route when Cmd/Ctrl-hover must open and
highlight one place in the source file:

```md
[Line 54](../notes/design:54)
[Trade-offs](../notes/design#trade-offs)
[First matching line](<../notes/design$Starting few characters>)
```

- `:54` selects source line 54.
- `#trade-offs` selects the heading and its section.
- `$Starting few characters` selects the first source line that starts with that exact text.
- Use `<...>` around a destination that contains spaces, or URL-encode the spaces as `%20`.
- When several lines start with the same `$` text, the first line wins; the author must add more characters when another line is intended.

## Code File Links

When a document refers to a code file, link the symbol and not the bare file:

```md
[quoteMarkdownCopyValue](../../vyasa/static/page_shell.js?symbol=quoteMarkdownCopyValue&kind=function)
```

- Use the symbol name as the link label, so the reader knows what to look for.
- Use a relative path that resolves to the code file, with its real extension.
- Set `symbol` to the exact identifier. A dotted name such as `DocumentPage.render` is allowed. When the whole dotted name is absent, the preview falls back to the last segment.
- Set `kind` when the file holds that name more than once. Cmd/Ctrl-hover then highlights the definition instead of the first use.
- URL-encode any character that would break a query value.

Link the bare file when the whole file is the point.
Use a `:54` position instead when a line number is the stable fact and no symbol name fits.

### Available Kinds

`kind` is case-insensitive. Vyasa reads these five values:

| Kind | Python (`.py`, `.pyi`) | JavaScript family (`.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.tsx`) |
| --- | --- | --- |
| `class` | `class` | `class` |
| `function` | `def`, `async def` | `function`, `async function`, `const`, `let`, `var` |
| `method` | `def`, `async def` | `function`, `async function` |
| `property` | `def`, `async def`, or an assignment line | `get`, `set` |
| `variable` | an assignment line, such as `NAME =` or `NAME: int =` | `const`, `let`, `var` |

- A file with any other suffix has no keyword table. The preview highlights the first whole-word match.
- An unknown `kind` value behaves the same way. Prefer no `kind` over a guessed one.

## VS Code Symbol Links

Use the installed `yeshwanth.vyasa` extension when a link must open one symbol inside one code file:

```md
[Implementation](vscode://yeshwanth.vyasa/open?workspace=%2Fpath%2Fto%2Frepo&file=src%2Fapp.js&symbol=App&kind=Class)
```

- Set `workspace` to the absolute repository root.
- Set `file` to a workspace-relative code file.
- Set `symbol` to the exact document symbol name.
- Set optional `kind` to a VS Code symbol kind such as `Class`, `Function`, or `Method`.
- URL-encode each query value.

The extension validates that `file` stays inside `workspace`, opens the file, asks VS Code for that document's symbols, and reveals the exact match. Multiple matches in the file open a picker; a missing symbol leaves the file open and reports the missing name.

Knowledge Graph node attributes can hold the same Markdown link:

```text
source=[Implementation](vscode://yeshwanth.vyasa/open?workspace=%2Fpath%2Fto%2Frepo&file=src%2Fapp.js&symbol=App&kind=Class)
```

## Regression Surface

Stable regression surface: `demo/wikilinks-lab/README.md`.
It covers unique targets, duplicates, aliases, folder notes, self-headings, nested heading chains, and intentional unresolved ambiguity.
