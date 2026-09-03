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


def test_a_broken_view_spoils_only_itself():
    """The bad view keeps its place and carries its error; the rest are clean."""
    views = normalize_projections([
        {"id": "good", "layout": "matrix", "matrix_col": "layer", "matrix_row": "flow"},
        {"id": "typo", "layout": "matrix", "matrix_col": "layer", "matrix_rows": "flow"},
        {"id": "unknown", "layout": "spiral"},
        {"id": "plain", "group_by": "kind"},
    ])

    by_id = {view["id"]: view for view in views}
    assert set(by_id) == {"good", "typo", "unknown", "plain"}, "no view may be dropped"
    assert "layout_error" not in by_id["good"]
    assert "layout_error" not in by_id["plain"]
    assert "matrix_rows" in by_id["typo"]["layout_error"]
    assert "matrix_col" in by_id["typo"]["layout_error"], "the message must list what is accepted"
    assert "spiral" in by_id["unknown"]["layout_error"]


def test_a_layout_error_reaches_the_viewer():
    model = attach_projection_models({
        "graph_id": "g",
        "tasks": [{"id": "a", "label": "A", "layer": "surface"}],
        "groups": [],
        "dependency_edges": [],
        "view_projections": [{"id": "typo", "layout": "matrix", "matrix_rows": "flow"}],
    })
    carried = model["projection_models"]["typo"]["model"]["layout_error"]
    assert "matrix_rows" in carried


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


def test_view_keys_the_viewer_reads_survive_normalization():
    """A view key the browser reads must reach the browser.

    `normalize_projections` copies only listed keys, so a key added to the
    viewer alone is silently dropped and the feature never runs. `pair_by` is
    a view rule, not a layout rule, so `all_layout_keys()` does not cover it.
    """
    from vyasa.extensions_builtin.tasks.projections import normalize_projections

    view = {"id": "flow", "layout": "sequence", "sequence_role": "role", "pair_by": "pair"}
    normalized = normalize_projections([view])[0]
    assert normalized["pair_by"] == "pair"
    assert not normalized.get("layout_error")

    source = Path("vyasa/extensions_builtin/tasks/static/tasks_layouts.js").read_text()
    assert "projection.pair_by" in source, "the viewer reads a key the server does not send"


def test_pair_by_can_be_set_on_the_graph_so_the_base_view_pairs_too():
    """A pack with no projection still has a view: the plain graph.

    The base view reads the graph, not a projection, so `pair_by` has to reach
    the model as well as the view or the double harpoon appears in one view only.
    """
    model = read_kg_pack(Path("demo/vyasa.kg/kg.schema"))
    assert model["pair_by"] == "pair"
    assert attach_projection_models(model)["projection_models"]["flow"]["model"]["pair_by"] == "pair"

    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    assert source.count("activeProjection?.pair_by || model?.pair_by") == 2, (
        "both edge-building paths must fall back to the graph-level key"
    )
