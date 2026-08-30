import re
from pathlib import Path

from vyasa.extensions_builtin.tasks.items_pack import read_kg_pack
from vyasa.extensions_builtin.tasks.layouts import LAYOUT_KEYS, layout_keys, unknown_layout_keys
from vyasa.extensions_builtin.tasks.projections import (
    PROJECTION_DISPLAY_KEYS,
    attach_projection_models,
    normalize_projections,
)

DEMO_PACKS = sorted(Path("demo").glob("*.kg/kg.schema"))


def test_every_layout_key_survives_normalization():
    """A layout key that is not in the display set is dropped in silence.

    That silence is what let ``initial_view=`` do nothing unnoticed, so the set
    is derived from the registry rather than typed out a second time.
    """
    for keys in LAYOUT_KEYS.values():
        for key in keys:
            assert key in PROJECTION_DISPLAY_KEYS, key


def test_authored_layout_keys_reach_the_projection_model():
    schema = Path("demo/vyasa-architecture.kg/kg.schema")
    model = attach_projection_models(read_kg_pack(schema))
    views = {view["id"]: view for view in model["view_projections"]}
    assert views["layered"]["layered_tier"] == "layer"
    assert views["layered"]["layered_aside"] == "configuration"
    assert views["matrix"]["matrix_row"] == "flow"
    assert views["render"]["sequence_role"] == "role"
    # A view with no layout stays an ordinary graph view.
    assert "layout" not in views["layers"]


def test_a_misspelt_layout_key_is_named_not_dropped():
    bad = [{"id": "m", "layout": "matrix", "matrix_col": "layer", "matrix_rows": "flow"}]
    try:
        normalize_projections(bad)
    except ValueError as error:
        assert "matrix_rows" in str(error)
    else:
        raise AssertionError("a misspelt layout key must be reported")


def test_a_key_from_another_layout_is_left_alone():
    # Only keys carrying the active layout's own prefix are checked, so a view
    # may still carry unrelated display keys.
    assert unknown_layout_keys({"layout": "matrix", "matrix_col": "layer", "sequence_role": "role"}) == []
    assert layout_keys("layered") == ("layered_tier", "layered_order", "layered_aside")


def test_python_and_javascript_agree_on_every_layout_key():
    """The registry lives in JS; the key names are repeated in Python.

    A key added on one side only is invisible until a pack uses it, and then
    the pack fails to load entirely. This locks the two lists together.
    """
    source = Path("vyasa/extensions_builtin/tasks/static/tasks_layouts.js").read_text()
    blocks = re.findall(r"id: '(\w+)',\n\s+label: '[^']*',\n\s+keys: \[([^\]]*)\]", source)
    assert blocks, "could not read the layout registry"

    from_js = {name: tuple(re.findall(r"'([^']+)'", keys)) for name, keys in blocks}
    assert from_js, "no layouts parsed out of the registry"
    assert set(from_js) == set(LAYOUT_KEYS), f"layouts differ: {set(from_js) ^ set(LAYOUT_KEYS)}"
    for name, keys in from_js.items():
        assert set(keys) == set(LAYOUT_KEYS[name]), f"{name}: {set(keys) ^ set(LAYOUT_KEYS[name])}"


def test_every_demo_pack_still_parses():
    assert DEMO_PACKS, "no demo packs found"
    for schema in DEMO_PACKS:
        model = attach_projection_models(read_kg_pack(schema))
        node_ids = {task["id"] for task in model["tasks"]}
        dangling = [
            edge["id"]
            for edge in model["dependency_edges"]
            if edge["source"] not in node_ids or edge["target"] not in node_ids
        ]
        assert not dangling, f"{schema}: {dangling}"
