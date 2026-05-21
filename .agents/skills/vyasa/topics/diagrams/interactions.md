# Diagram Interactions

Mermaid and D2 interaction behavior should follow existing Vyasa contracts.
Do not add one-off click handlers that bypass shared route/link handling.

For Cytograph behavior changes, inspect implementation notes in code first:

- Extension route registration
- Static asset bundle declarations
- Browser runtime module
- Static build asset copying

Runtime and static builds must produce compatible diagram output.
If a diagram relies on external source loading, verify the route shape is valid for static output too.
