# Diagrams Route

Read only the drawer needed:

- `topics/diagrams/mermaid.md`
- `topics/diagrams/d2.md`
- `topics/diagrams/cytograph-basic.md`
- `topics/diagrams/cytograph-source.md`
- `topics/diagrams/cytograph-large.md`
- `topics/diagrams/interactions.md`

Rules:

- For Mermaid labels, use literal `<br/>`, not `\n`.
- For Cytograph, prefer `layout: vyasa` unless the user asks for `dagre` or `cola`.
- For large Cytograph trees, prefer `.cytree` sidecars over embedded JSON.
