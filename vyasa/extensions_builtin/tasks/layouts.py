"""Which view keys each fixed layout owns.

The viewer holds the placement code; this module holds only the key names, so
that an authored key survives normalization and a misspelt one is reported
instead of dropped. Keys are deliberately per-layout and not a shared grammar:
``layered_tier`` and ``matrix_row`` both name an attribute, but one reads a node
and the other reads an edge, and one common ``row=`` would hide that.

Aliases keep packs written against an earlier key working.

>>> sorted(layout_keys("sequence"))
['sequence_phase', 'sequence_role']
>>> layout_keys("nope")
()
>>> sorted(all_layout_keys())[:3]
['layered_aside', 'layered_order', 'layered_tier']
>>> unknown_layout_keys({"layout": "matrix", "matrix_col": "layer", "matrix_rows": "flow"})
['matrix_rows']
>>> unknown_layout_keys({"layout": "matrix", "matrix_col": "layer", "caption": "hi"})
[]
"""

from __future__ import annotations

LAYOUT_KEYS: dict[str, tuple[str, ...]] = {
    "sequence": ("sequence_role", "sequence_phase"),
    "layered": ("layered_tier", "layered_order", "layered_aside"),
    "matrix": ("matrix_col", "matrix_row", "matrix_col_order"),
}

# Old name -> current name. A pack written before a rename keeps working.
LAYOUT_KEY_ALIASES: dict[str, str] = {}


def layout_keys(layout: str) -> tuple[str, ...]:
    return LAYOUT_KEYS.get(str(layout or "").strip().lower(), ())


def all_layout_keys() -> set[str]:
    return {key for keys in LAYOUT_KEYS.values() for key in keys} | set(LAYOUT_KEY_ALIASES)


def unknown_layout_keys(view: dict) -> list[str]:
    """Keys on a view that look like a layout key but belong to no layout.

    A key that carries the active layout's prefix but is not one of its keys is
    almost always a typo. Silence there is what let ``initial_view=`` do nothing
    for months.
    """
    layout = str(view.get("layout") or "").strip().lower()
    if not layout:
        return []
    owned = set(layout_keys(layout))
    prefix = f"{layout}_"
    return sorted(
        key
        for key in view
        if key.startswith(prefix) and key not in owned and LAYOUT_KEY_ALIASES.get(key) not in owned
    )


def apply_layout_aliases(view: dict) -> dict:
    for old, new in LAYOUT_KEY_ALIASES.items():
        if old in view and new not in view:
            view[new] = view[old]
    return view
