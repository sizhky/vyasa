# Global And Shell Examples

For navbar, footer, sidebar, and mobile panel styling, target hook classes.
Keep shell changes semantic and shared between runtime and static build.

Narrative/book navigation:

- Prefer Vyasa built-in sibling previous/next pager.
- It follows the folder `.vyasa` ordering.
- It does not use raw filename sort.
- Do not invent manual chapter-footer HTML unless the built-in pager cannot fit.

When changing shell layout, inspect actual rendered structure before deciding selectors.
