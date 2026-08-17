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
