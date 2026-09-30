"""Which view keys each fixed layout owns.

The viewer holds the placement code; this module holds only the key names, so
that an authored key survives normalization and a misspelt one is reported
instead of dropped. Keys are deliberately per-layout and not a shared grammar:
``layered_tier`` and ``matrix_row`` both name an attribute, but one reads a node
and the other reads an edge, and one common ``row=`` would hide that.

Aliases keep packs written against an earlier key working.

>>> sorted(layout_keys("sequence"))
['sequence_activation', 'sequence_fragment', 'sequence_lanes', 'sequence_message', 'sequence_operand', 'sequence_operand_note', 'sequence_phase', 'sequence_role']
>>> layout_keys("nope")
()
>>> sorted(all_layout_keys())[:3]
['grid_col', 'grid_col_order', 'grid_row']
>>> unknown_layout_keys({"layout": "matrix", "matrix_col": "layer", "matrix_rows": "flow"})
['matrix_rows']
>>> unknown_layout_keys({"layout": "matrix", "matrix_col": "layer", "caption": "hi"})
[]
"""

from __future__ import annotations

import logging

LAYOUT_KEYS: dict[str, tuple[str, ...]] = {
    "sequence": (
        "sequence_role",
        "sequence_phase",
        "sequence_activation",
        "sequence_lanes",
        # UML interaction keys: the message kind on an arrow, and the combined
        # fragment plus operand guard a row sits in.
        "sequence_message",
        "sequence_fragment",
        "sequence_operand",
        "sequence_operand_note",
    ),
    "layered": ("layered_tier", "layered_order", "layered_aside"),
    "matrix": ("matrix_col", "matrix_row", "matrix_col_order", "matrix_tint"),
    "grid": ("grid_col", "grid_row", "grid_col_order", "grid_row_order"),
}

# View-wide style defaults. A node or edge attr of the same name overrides them.
# Any layout accepts them, so they are not layout keys.
STYLE_KEYS: dict[str, tuple[str, ...]] = {
    "node_look": ("card", "outline"),
    "edge_path": ("ribbon", "line", "orthogonal"),
}

# Keys a site or an @graph line may set as the starting default for every view.
KG_STYLE_DEFAULT_KEYS: tuple[str, ...] = (*STYLE_KEYS, "subtitle_from")


def kg_style_defaults(site: dict, graph: dict) -> dict:
    """The style defaults a graph starts from: the site's, then its @graph line.

    A site key or value that is not a style is dropped with a warning, because
    a typo in a server flag should not silently restyle nothing.

    >>> kg_style_defaults({"node_look": "outline", "edge_path": "orthogonal"}, {"edge_path": "line"})
    {'node_look': 'outline', 'edge_path': 'line'}
    >>> kg_style_defaults({"node_look": "fancy", "colour": "red"}, {})
    {}
    """
    merged = {}
    for key, value in (site or {}).items():
        allowed = STYLE_KEYS.get(key)
        if key not in KG_STYLE_DEFAULT_KEYS or (allowed and str(value).lower() not in allowed):
            logging.getLogger(__name__).warning("kg_defaults: %s=%s is not a KG style default; ignored.", key, value)
            continue
        merged[key] = str(value).lower() if allowed else str(value)
    merged.update({key: graph[key] for key in KG_STYLE_DEFAULT_KEYS if graph.get(key)})
    return merged


# Old name -> current name. A pack written before a rename keeps working.
LAYOUT_KEY_ALIASES: dict[str, str] = {}


def layout_keys(layout: str) -> tuple[str, ...]:
    return LAYOUT_KEYS.get(str(layout or "").strip().lower(), ())


def all_layout_keys() -> set[str]:
    return {key for keys in LAYOUT_KEYS.values() for key in keys} | set(LAYOUT_KEY_ALIASES)


def layout_error(view: dict) -> str:
    """One reader-facing sentence naming what is wrong with this view, or "".

    A bad view spoils only itself. Raising here used to empty the whole pack,
    so a typo in a view nobody opened blanked the page.

    >>> layout_error({"layout": "matrix", "matrix_col": "a", "matrix_row": "b"})
    ''
    >>> layout_error({"layout": "matrix", "matrix_rows": "b"})
    "layout=matrix has no key 'matrix_rows'. It accepts matrix_col, matrix_col_order, matrix_row, matrix_tint."
    >>> layout_error({"layout": "spiral"})
    'layout=spiral is not a layout. Known layouts: grid, layered, matrix, sequence.'
    >>> layout_error({"group_by": "kind"})
    ''
    >>> layout_error({"edge_path": "curvy"})
    'edge_path=curvy is not a style. Use one of ribbon, line, orthogonal.'
    """
    for key, allowed in STYLE_KEYS.items():
        value = str(view.get(key) or "").strip().lower()
        if value and value not in allowed:
            return f"{key}={value} is not a style. Use one of {', '.join(allowed)}."
    layout = str(view.get("layout") or "").strip().lower()
    if not layout:
        return ""
    if layout not in LAYOUT_KEYS:
        return f"layout={layout} is not a layout. Known layouts: {', '.join(sorted(LAYOUT_KEYS))}."
    stray = unknown_layout_keys(view)
    if stray:
        accepted = ", ".join(sorted(layout_keys(layout)))
        return f"layout={layout} has no key {stray[0]!r}. It accepts {accepted}."
    return ""


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
