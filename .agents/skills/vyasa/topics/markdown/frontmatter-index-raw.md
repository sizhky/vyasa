# Frontmatter, Index, Raw

Frontmatter is YAML at the top of markdown files.
Use supported keys only.

Index behavior:

- Folder notes can act as landing pages.
- For folder-note links, prefer `[[guide]]`, not `[[guide/index]]`.
- The canonical route is the folder URL.

Raw markdown access exists for source views/downloads.
For user-facing navigation, prefer route slugs and anchors like `/posts/guide#part` or `guide#part`.
Do not append `.md` unless the user explicitly wants raw markdown source.
