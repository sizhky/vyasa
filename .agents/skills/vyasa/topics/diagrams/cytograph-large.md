# Cytograph Large Trees

Optimize graph shape before spacing.

Rules:

- Keep top level at concept/module level.
- Shorten labels.
- Group high-fanout branches.
- Move file-level leaves into linked subgraphs or follow-on pages.
- Prefer `initial_depth: 1`.
- Treat `All` as diagnostic, not the primary reading mode.
- Split graphs once visible node count or label width makes the view sparse or unreadable.

Horizontal space is scarce and vertical space is cheaper.
Prefer the reading-oriented `vyasa` preset over top-down DAG layouts unless the semantics require ranks.
