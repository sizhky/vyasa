# Frontmatter, Index, Raw

Frontmatter is YAML at the top of markdown files.
Use supported keys only.

Code-link keys:

- `code_root`: a path, relative to the document's folder, that holds the code files the document links.
- `code_extensions`: the suffixes that may use that fallback, such as `[py, js, ts]`.
- See `topics/markdown/code-includes-links.md` for the resolution order.

Index behavior:

- Folder notes can act as landing pages.
- For folder-note links, prefer `[[guide]]`, not `[[guide/index]]`.
- The canonical route is the folder URL.

Raw markdown access exists for source views/downloads.
For user-facing navigation, prefer route slugs and anchors like `/posts/guide#part` or `guide#part`.
Do not append `.md` unless the user explicitly wants raw markdown source.
