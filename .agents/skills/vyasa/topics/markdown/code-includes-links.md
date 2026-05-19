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

## Regression Surface

Stable regression surface: `demo/wikilinks-lab/README.md`.
It covers unique targets, duplicates, aliases, folder notes, self-headings, nested heading chains, and intentional unresolved ambiguity.
