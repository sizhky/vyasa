from vyasa.extensions_builtin.tasks.items_store_contracts import (
    BulkAttrPatch,
    CheckedStateContract,
    MutationKind,
    MutationRequest,
    NodeRecord,
    QueryKind,
    QueryRequest,
    RecordKind,
    RecordSelector,
    STORE_FILE_EXTENSION,
    STORE_SYNTAX_NAME,
    ValidationCode,
    ValidationFinding,
)
from vyasa.extensions_builtin.tasks.items_pack import read_edges, read_kg_pack, read_nodes
from vyasa.extensions_builtin.tasks.api import _view_sidecar_text
from vyasa.extensions_builtin.tasks.model import _resolve_tasks_source_path, parse_tasks_text
from vyasa.config import reload_config

import sys
import json
from pathlib import Path

SKILL_SCRIPT_DIR = Path(__file__).resolve().parents[1] / ".agents/skills/vyasa/scripts"
if str(SKILL_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_SCRIPT_DIR))

from kg_pack_convert import convert_legacy_items_markdown


def test_kg_pack_named_edge_without_relation_still_loads(tmp_path):
    edges_path = tmp_path / "base.edges"
    edges_path.write_text("e-api-ui: n-api -> n-ui\n", encoding="utf-8")

    edges = read_edges(edges_path)

    assert edges == [{"id": "e-api-ui", "source": "n-api", "target": "n-ui"}]


def test_kg_pack_names_are_stable():
    assert STORE_SYNTAX_NAME == "KG Pack"
    assert STORE_FILE_EXTENSION == ".kg.nodes"
    assert QueryKind.NEIGHBORS == "neighbors"
    assert MutationKind.BULK_SET_ATTR == "bulk_set_attr"


def test_kg_pack_bulk_attr_patch_is_single_kv_for_many_records():
    patch = BulkAttrPatch(
        selector=RecordSelector(kind=RecordKind.NODE, ids=("a", "b")),
        key="status",
        value="done",
    )

    assert patch.selector.ids == ("a", "b")
    assert patch.key == "status"
    assert patch.value == "done"


def test_kg_pack_query_contract_supports_projection_scoped_neighbors():
    query = QueryRequest(kind=QueryKind.NEIGHBORS, target_id="n-api", projection_id="city")

    assert query.target_id == "n-api"
    assert query.projection_id == "city"
    assert query.include_edges is True


def test_kg_pack_mutation_contract_keeps_record_and_payload_separate():
    node = NodeRecord(id="n-api", label="API", group="g-platform", attrs={"owner": "eng"})
    mutation = MutationRequest(kind=MutationKind.UPSERT_RECORD, record=node)

    assert mutation.record == node
    assert mutation.payload == {}


def test_kg_pack_validation_finding_names_dangling_edges():
    finding = ValidationFinding(
        code=ValidationCode.DANGLING_EDGE,
        message="edge points at missing node",
        record_id="e-a-b",
        refs=("a", "b"),
    )

    assert finding.code == "dangling_edge"
    assert finding.refs == ("a", "b")


def test_kg_pack_preserves_inline_markdown_kg_compatibility():
    model = parse_tasks_text("""```items
Roadmap:
  - n-api :: API | status: done
n-api -> n-ui
```""")

    assert model["groups"][0]["id"] == "roadmap"
    assert model["tasks"][0]["status"] == "done"
    assert model["dependency_edges"][0] == {"source": "n-api", "target": "n-ui"}


def test_kg_pack_converter_splits_legacy_inline_graph(tmp_path):
    markdown_path = tmp_path / "legacy.md"
    markdown_path.write_text(
        """# Demo

```items
---
title: Legacy
default_color_by: status
color_by:
  status:
    done: "#01ce27"
edge_color_palette:
  relation:
    enables: "#2563eb"
---
Roadmap:
  - n-api :: API | status: done | owner: eng
n-api -> n-ui | relation: enables
```
""",
        encoding="utf-8",
    )

    conversion = convert_legacy_items_markdown(markdown_path)

    assert "items_schema: legacy.kg/kg.schema" in conversion.markdown_text
    assert "color_by:\n  status:" not in conversion.markdown_text
    assert "edge_color_palette:" not in conversion.markdown_text
    assert '"status"' in conversion.palette_text
    assert '"enables": "#2563eb"' in conversion.palette_text
    assert "nodes=kg.nodes" in conversion.schema_text
    assert "attrs=kg.attrs" in conversion.schema_text
    assert "\tedges=kg.edges" in conversion.schema_text
    assert "overview:\n\tsource=base\n\tgroup_by,color_by=status" in conversion.schema_text
    assert conversion.nodes_text.startswith("n1: API")
    assert "status:\n  done: n1" in conversion.attrs_text
    assert "owner:\n  eng: n1" in conversion.attrs_text
    assert conversion.edges_text.startswith("e1: n1 -> n-ui enables")


def test_items_parser_loads_kg_schema_pack(tmp_path):
    (tmp_path / "roadmap.kg.schema").write_text(
        """@graph id=roadmap title=Roadmap initial_view=delivery hover_attrs=owner,status card_states="Not Done,Done,Deferred/Cancelled"

@sources
nodes=roadmap.kg.nodes
attrs=roadmap.kg.attrs
base:
    edges=roadmap.kg.edges
palette=roadmap.kg.palette
cache=roadmap.kg.cache

@relations
unlocks color="#2563eb"

@views
delivery:
    source=base
    group_by,color_by=status
    caption="Track delivery"
ownership:
    source=base
    where=owner:eng
    group_by=owner
    color_by=status
    edge_color_by=relation
    edge_label_from=relation
    hover_attrs=owner,status
    aggregate_edges="when_collapsed=true by=relation"
    filter_query='{"combinator":"or","rules":[{"field":"status","operator":"=","value":"todo","muted":true}],"not":true}'
    query_builder_enabled=false
    search="login"
    filters_collapsed=false
    edges_visible=false
    edge_animation_enabled=false
    edge_opacity=0.37
    projection_unspecified_content_opacity=0.44
""",
        encoding="utf-8",
    )
    (tmp_path / "roadmap.kg.nodes").write_text("n1: Login\n\tsummary=User signs in\nn2: Checkout\n", encoding="utf-8")
    (tmp_path / "roadmap.kg.edges").write_text("e1: n1 -> n2 unlocks\n", encoding="utf-8")
    (tmp_path / "roadmap.kg.attrs").write_text("@node_attrs\nstatus:\n  todo: n1\n  done: n2\nowner:\n  eng: n1 n2\n\n@edge_attrs\nconfidence:\n  high: e1\n", encoding="utf-8")
    (tmp_path / "roadmap.kg.palette").write_text('{"node_color_palettes":{"status":{"todo":"#f00","done":"#0f0"}}}', encoding="utf-8")

    graph = read_kg_pack(tmp_path / "roadmap.kg.schema")
    model = parse_tasks_text("""```items
---
items_schema: roadmap.kg.schema
---
```""", current_path=tmp_path / "graph.md")

    assert graph["tasks"][0]["summary"] == "User signs in"
    assert graph["hover_attrs"] == ["owner", "status"]
    assert model["tasks"][0]["status"] == "todo"
    assert model["dependency_edges"][0]["relation"] == "unlocks"
    assert model["dependency_edges"][0]["confidence"] == "high"
    assert model["hover_attrs"] == ["owner", "status"]
    assert model["view_projections"][1]["where"] == {"owner": "eng"}
    assert model["view_projections"][1]["edge_color_by"] == "relation"
    assert model["view_projections"][1]["hover_attrs"] == ["owner", "status"]
    assert model["view_projections"][1]["aggregate_edges"] == {"when_collapsed": True, "by": "relation"}
    assert model["view_projections"][1]["filter_query"]["rules"][0]["muted"] is True
    assert model["view_projections"][1]["query_builder_enabled"] is False
    assert model["view_projections"][1]["search"] == "login"
    assert model["view_projections"][1]["filters_collapsed"] is False
    assert model["view_projections"][1]["edges_visible"] is False
    assert model["view_projections"][1]["edge_animation_enabled"] is False
    assert model["view_projections"][1]["edge_opacity"] == "0.37"
    assert model["view_projections"][1]["projection_unspecified_content_opacity"] == "0.44"
    assert model["projection_models"]["ownership"]["model"]["edge_color_by"] == "relation"
    assert model["projection_models"]["ownership"]["model"]["hover_attrs"] == ["owner", "status"]
    assert model["index_attributes"] == ["status", "owner"]
    assert model["filter_attributes"] == ["status", "owner"]
    assert model["node_color_palettes"]["status"] == {"todo": "#f00", "done": "#0f0"}
    assert model["view_projections"][0]["caption"] == "Track delivery"
    assert model["default_projection"] == "delivery"
    assert model["card_states"] == ["Not Done", "Done", "Deferred/Cancelled"]


def test_items_parser_reads_multiline_graph_header(tmp_path):
    (tmp_path / "roadmap.kg.schema").write_text(
        """@graph id=roadmap title=Roadmap
initial_view=delivery
hover_attrs=owner,status

@sources
nodes=roadmap.kg.nodes
base:
    edges=roadmap.kg.edges

@views
delivery:
    source=base
    group_by=owner
""",
        encoding="utf-8",
    )
    (tmp_path / "roadmap.kg.nodes").write_text("n1: Login\n", encoding="utf-8")
    (tmp_path / "roadmap.kg.edges").write_text("", encoding="utf-8")

    graph = read_kg_pack(tmp_path / "roadmap.kg.schema")

    assert graph["default_projection"] == "delivery"
    assert graph["hover_attrs"] == ["owner", "status"]


def test_kg_pack_reads_tmp_view_sidecars(tmp_path):
    (tmp_path / "roadmap.kg.schema").write_text(
        "@graph id=roadmap\n@sources\nnodes=roadmap.kg.nodes\n@views\nbase:\n    source=base\n",
        encoding="utf-8",
    )
    (tmp_path / "roadmap.kg.nodes").write_text("n1: Login\n", encoding="utf-8")
    view_id, text = _view_sidecar_text("Todo Now", "old:\n\tgroup_by=status\n\tfilter_query='{\"combinator\":\"and\",\"rules\":[{\"field\":\"status\",\"operator\":\"=\",\"value\":\"todo\",\"muted\":true}]}'\n")
    view_dir = tmp_path / "roadmap.kg"
    view_dir.mkdir()
    (view_dir / f"{view_id}.view").write_text(text, encoding="utf-8")

    graph = read_kg_pack(tmp_path / "roadmap.kg.schema")

    assert view_id.startswith("tmp.")
    assert graph["view_projections"][1]["id"] == view_id
    assert graph["view_projections"][1]["label"] == "Todo Now"
    assert graph["view_projections"][1]["filter_query"]["rules"][0]["muted"] is True


def test_kg_view_sidecar_accepts_raw_json_filter_query_quotes(tmp_path):
    (tmp_path / "kg.schema").write_text("@graph id=roadmap\n@sources\nnodes=kg.nodes\n@views\nbase:\n    source=base\n", encoding="utf-8")
    (tmp_path / "kg.nodes").write_text("n1: Login\n", encoding="utf-8")
    (tmp_path / "tmp.RawJson.view").write_text(
        'tmp.RawJson:\n\tlabel="Raw JSON"\n\tfilter_query="{"combinator":"and","rules":[{"field":"built","operator":"=","value":"yes"}]}"\n',
        encoding="utf-8",
    )

    graph = read_kg_pack(tmp_path / "kg.schema")

    assert graph["view_projections"][1]["filter_query"]["rules"][0]["field"] == "built"


def test_kg_palette_design_palette_feeds_color_and_image_modes(tmp_path):
    (tmp_path / "roadmap.kg.schema").write_text(
        "@graph id=roadmap initial_view=base\n@sources\nnodes=roadmap.kg.nodes\npalette=roadmap.kg.palette\n@views\nbase:\n    source=base\n",
        encoding="utf-8",
    )
    (tmp_path / "roadmap.kg.nodes").write_text("n1: API\n\ttype=service\nn2: DB\n\ttype=database\n", encoding="utf-8")
    (tmp_path / "roadmap.kg.palette").write_text(
        json.dumps({
            "default_design_palette": "architecture",
            "default_image_by": "type",
            "node_color_palettes": {"status": {"todo": "#f59e0b"}},
            "design_palette": {
                "architecture": {
                    "colors": {"service": "#2563eb", "database": "#16a34a"},
                    "images": {"service": "iconify:mdi:cube-outline", "database": "iconify:devicon:postgresql"},
                },
            },
        }),
        encoding="utf-8",
    )

    model = parse_tasks_text("""```items
---
items_schema: roadmap.kg.schema
default_color_by: type
---
```""", current_path=tmp_path / "graph.md")

    assert model["default_design_palette"] == "architecture"
    assert model["image_by"] == "type"
    assert model["node_color_palettes"]["status"] == {"todo": "#f59e0b"}
    assert model["node_color_palettes"]["type"]["database"] == "#16a34a"
    assert model["node_image_palettes"]["type"]["service"] == "iconify:mdi:cube-outline"


def test_read_kg_pack_writes_and_refreshes_kg_cache(tmp_path):
    (tmp_path / "roadmap.kg.schema").write_text("@graph id=roadmap\n@sources\nnodes=roadmap.kg.nodes\nbase:\n    edges=roadmap.kg.edges\ncache=roadmap.kg.cache\n", encoding="utf-8")
    (tmp_path / "roadmap.kg.nodes").write_text("n1: Login\n", encoding="utf-8")
    (tmp_path / "roadmap.kg.edges").write_text("", encoding="utf-8")

    read_kg_pack(tmp_path / "roadmap.kg.schema")
    first_cache = json.loads((tmp_path / "roadmap.kg.cache").read_text(encoding="utf-8"))
    assert sorted(first_cache["nodes"]) == ["n1"]

    (tmp_path / "roadmap.kg.nodes").write_text("n1: Login\nn2: Checkout\n", encoding="utf-8")
    read_kg_pack(tmp_path / "roadmap.kg.schema")
    refreshed_cache = json.loads((tmp_path / "roadmap.kg.cache").read_text(encoding="utf-8"))
    assert sorted(refreshed_cache["nodes"]) == ["n1", "n2"]


def test_items_parser_inherits_attrs_after_attr_overlay(tmp_path):
    (tmp_path / "nest.kg.schema").write_text(
        """@graph id=nest title=Nest initial_view=module

@sources
nodes=nest.kg.nodes
attrs=nest.kg.attrs
base:
    edges=nest.kg.edges

@views
module:
    source=base
    group_by=module
""",
        encoding="utf-8",
    )
    (tmp_path / "nest.kg.nodes").write_text("n1: Root\n\tinherit=module\n\tn2: Child\n", encoding="utf-8")
    (tmp_path / "nest.kg.attrs").write_text("@node_attrs\nmodule:\n  Data & Ingest: n1\n", encoding="utf-8")
    (tmp_path / "nest.kg.edges").write_text("", encoding="utf-8")

    graph = read_kg_pack(tmp_path / "nest.kg.schema")

    assert graph["tasks"][0]["module"] == "Data & Ingest"
    assert graph["tasks"][1]["module"] == "Data & Ingest"
    assert graph["index_attributes"] == ["module"]


def test_items_parser_applies_tab_indented_attrs(tmp_path):
    (tmp_path / "tabbed.kg.schema").write_text(
        "@graph id=tabbed title=Tabbed initial_view=by_owner\n\n"
        "@sources\nnodes=tabbed.kg.nodes\nattrs=tabbed.kg.attrs\nbase:\n\tedges=tabbed.kg.edges\n\n"
        "@views\nby_owner:\n\tsource=base\n\tgroup_by=owner\n",
        encoding="utf-8",
    )
    (tmp_path / "tabbed.kg.nodes").write_text("n1: First\nn2: Second\n", encoding="utf-8")
    # Attr value lines indented with tabs (as emitted by the KG authoring tools).
    (tmp_path / "tabbed.kg.attrs").write_text(
        "@node_attrs\nowner:\n\tyr: n1\n\tmg: n2\nstatus:\n\tdone: n1\n", encoding="utf-8"
    )
    (tmp_path / "tabbed.kg.edges").write_text("", encoding="utf-8")

    graph = read_kg_pack(tmp_path / "tabbed.kg.schema")
    by_id = {task["id"]: task for task in graph["tasks"]}

    assert by_id["n1"]["owner"] == "yr"
    assert by_id["n2"]["owner"] == "mg"
    assert by_id["n1"]["status"] == "done"
    assert graph["index_attributes"] == ["owner", "status"]


def test_items_schema_resolution_handles_route_slug_under_docs_root(tmp_path):
    root = tmp_path / "docs"
    root.mkdir()
    (root / ".vyasa").write_text("", encoding="utf-8")
    (root / "solution-architecture.kg").mkdir()
    schema_path = root / "solution-architecture.kg" / "kg.schema"
    schema_path.write_text("@graph id=demo\n", encoding="utf-8")
    reload_config(root / ".vyasa")

    try:
        resolved = _resolve_tasks_source_path("docs/solution-architecture", "solution-architecture.kg/kg.schema")
        assert resolved == schema_path.resolve()
    finally:
        reload_config()


def test_parse_tasks_text_keeps_groups_from_items_schema(tmp_path):
    (tmp_path / "nest.kg.schema").write_text(
        """@graph id=nest title=Nest

@sources
base:
    nodes=nest.kg.nodes
""",
        encoding="utf-8",
    )
    (tmp_path / "nest.kg.nodes").write_text(
        """n1: Parent
\tn2: Child
""",
        encoding="utf-8",
    )

    model = parse_tasks_text("""```items
---
items_schema: nest.kg.schema
---
```""", current_path=tmp_path / "graph.md")

    assert [group["id"] for group in model["groups"]] == ["n1"]
    assert [task["id"] for task in model["tasks"]] == ["n2"]
    assert model["task_children"]["n1"] == ["n2"]


def test_kg_pack_projection_where_scopes_projection_graph(tmp_path):
    (tmp_path / "roadmap.kg.schema").write_text(
        """@graph id=roadmap title=Roadmap initial_view=chapter

@sources
nodes=roadmap.kg.nodes
attrs=roadmap.kg.attrs
base:
    edges=roadmap.kg.edges

@views
chapter:
    where=status:now
    group_by,color_by=status
""",
        encoding="utf-8",
    )
    (tmp_path / "roadmap.kg.nodes").write_text("n1: Start\nn2: Middle\nn3: Later\n", encoding="utf-8")
    (tmp_path / "roadmap.kg.edges").write_text("e1: n1 -> n2 unlocks\ne2: n2 -> n3 unlocks\n", encoding="utf-8")
    (tmp_path / "roadmap.kg.attrs").write_text("@node_attrs\nstatus:\n  now: n1 n2\n  later: n3\n", encoding="utf-8")

    model = parse_tasks_text("""```items
---
items_schema: roadmap.kg.schema
---
```""", current_path=tmp_path / "graph.md")

    chapter = model["projection_models"]["chapter"]["model"]
    assert [task["id"] for task in chapter["tasks"]] == ["n1", "n2"]
    assert [edge["id"] for edge in chapter["dependency_edges"]] == ["e1"]


def test_kg_pack_composite_attrs_preserve_membership_and_projection_aliases(tmp_path):
    (tmp_path / "kg.schema").write_text(
        """@graph id=owners initial_view=owners
@sources
nodes=kg.nodes
attrs=kg.attrs
base:
    edges=kg.edges
@views
owners:
    group_by=owner
""",
        encoding="utf-8",
    )
    (tmp_path / "kg.nodes").write_text("n1: Shared\nn2: Solo\n", encoding="utf-8")
    (tmp_path / "kg.edges").write_text("e1: n1 -> n2\n", encoding="utf-8")
    (tmp_path / "kg.attrs").write_text(
        "@node_attrs\nowner:\n  Yeshwanth: n1 n2\n  Satyasri: n1\n",
        encoding="utf-8",
    )

    model = parse_tasks_text(
        "```items\n---\nitems_schema: kg.schema\n---\n```",
        current_path=tmp_path / "graph.md",
    )

    assert model["tasks"][0]["owner"] == ["Yeshwanth", "Satyasri"]
    owners = model["projection_models"]["owners"]["model"]
    assert [group["label"] for group in owners["groups"]] == [
        "Owner > Yeshwanth",
        "Owner > Satyasri",
    ]
    assert len(owners["tasks"]) == 3
    assert len(owners["dependency_edges"]) == 2
    assert {task["__source_node_id"] for task in owners["tasks"]} == {"n1", "n2"}


def test_kg_pack_projection_can_use_derived_color_modes(tmp_path):
    (tmp_path / "roadmap.kg.schema").write_text(
        """@graph id=roadmap title=Roadmap initial_view=flow

@sources
nodes=roadmap.kg.nodes
base:
    edges=roadmap.kg.edges

@views
flow:
    group_by,color_by=rank
connected:
    group_by=rank
    color_by=connectivity
""",
        encoding="utf-8",
    )
    (tmp_path / "roadmap.kg.nodes").write_text("n1: Start\nn2: Middle\nn3: End\n", encoding="utf-8")
    (tmp_path / "roadmap.kg.edges").write_text("e1: n1 -> n2 unlocks\ne2: n2 -> n3 unlocks\n", encoding="utf-8")

    model = parse_tasks_text("""```items
---
items_schema: roadmap.kg.schema
---
```""", current_path=tmp_path / "graph.md")

    flow = model["projection_models"]["flow"]["model"]
    connected = model["projection_models"]["connected"]["model"]
    assert flow["default_color_by"] == "rank"
    assert connected["default_color_by"] == "connectivity"
    assert "rank" in flow["node_color_palettes"]
    assert "connectivity" in connected["node_color_palettes"]
    assert all("rank" in task and "connectivity" in task for task in connected["tasks"])


def test_kg_pack_projection_edge_source_selects_endpoint_nodes(tmp_path):
    (tmp_path / "roadmap.kg.schema").write_text(
        """@graph id=roadmap title=Roadmap initial_view=chapter

@sources
nodes=roadmap.kg.nodes
attrs=roadmap.kg.attrs
base:
    edges=roadmap.kg.edges
chapter:
    edges=chapter.kg.edges

@views
chapter:
    source=chapter
    group_by,color_by=status
""",
        encoding="utf-8",
    )
    (tmp_path / "roadmap.kg.nodes").write_text("n1: Start\nn2: Middle\nn3: Later\n", encoding="utf-8")
    (tmp_path / "roadmap.kg.edges").write_text("e1: n1 -> n2 unlocks\ne2: n2 -> n3 unlocks\n", encoding="utf-8")
    (tmp_path / "chapter.kg.edges").write_text("c1: n2 -> n3 unlocks\n", encoding="utf-8")
    (tmp_path / "roadmap.kg.attrs").write_text("@node_attrs\nstatus:\n  now: n1 n2\n  later: n3\n", encoding="utf-8")

    model = parse_tasks_text("""```items
---
items_schema: roadmap.kg.schema
---
```""", current_path=tmp_path / "graph.md")

    chapter = model["projection_models"]["chapter"]["model"]
    assert [task["id"] for task in chapter["tasks"]] == ["n2", "n3"]
    assert [edge["id"] for edge in chapter["dependency_edges"]] == ["c1"]


def test_kg_pack_source_attr_groups_scope_projection_nodes(tmp_path):
    (tmp_path / "roadmap.kg.schema").write_text(
        """@graph id=roadmap title=Roadmap initial_view=chapter

@sources
nodes=roadmap.kg.nodes
attrs=roadmap.kg.attrs
chapter:
    edges=roadmap.kg.edges
    attrs:
        role: [Mechanism, Outcome]
        property: ["Next Token Prediction", Knowledge]

@views
chapter:
    source=chapter
    group_by,color_by=role
""",
        encoding="utf-8",
    )
    (tmp_path / "roadmap.kg.nodes").write_text("n1: Generator\nn2: Knowledge\nn3: Memory\n", encoding="utf-8")
    (tmp_path / "roadmap.kg.edges").write_text("e1: n1 -> n2 unlocks\ne2: n2 -> n3 unlocks\n", encoding="utf-8")
    (tmp_path / "roadmap.kg.attrs").write_text("@node_attrs\nrole:\n  Mechanism: n1 n3\n  Outcome: n2\nproperty:\n  Next Token Prediction: n1\n  Knowledge: n2\n  Working Memory: n3\n", encoding="utf-8")

    model = parse_tasks_text("""```items
---
items_schema: roadmap.kg.schema
---
```""", current_path=tmp_path / "graph.md")

    chapter = model["projection_models"]["chapter"]["model"]
    assert [task["id"] for task in chapter["tasks"]] == ["n1", "n2"]
    assert [edge["id"] for edge in chapter["dependency_edges"]] == ["e1"]


def test_kg_pack_nodes_support_nested_children_and_inherit_whitelist(tmp_path):
    (tmp_path / "home.kg.schema").write_text("@graph id=home\n@sources\nnodes=home.kg.nodes\n", encoding="utf-8")
    (tmp_path / "home.kg.nodes").write_text(
        """b1: Apartment Building
    city=Hyderabad
    type=building
    inherit=city
    p1: Yesh
        role=tenant
    c1: Honda City
        type=car
""",
        encoding="utf-8",
    )

    graph = read_kg_pack(tmp_path / "home.kg.schema")

    assert graph["groups"][0]["id"] == "b1"
    assert graph["groups"][0]["type"] == "building"
    assert [task["id"] for task in graph["tasks"]] == ["p1", "c1"]
    assert all(task["group_id"] == "b1" for task in graph["tasks"])
    assert all(task["city"] == "Hyderabad" for task in graph["tasks"])
    assert "type" not in graph["tasks"][0]
    assert graph["tasks"][1]["type"] == "car"


def test_kg_pack_nodes_support_multiline_inline_attributes(tmp_path):
    nodes_path = tmp_path / "kg.nodes"
    nodes_path.write_text(
        """n1: Recommendation
\tsummary=|
\t\t**Why it works**

\t\t- Preserves clusters
\t\t- Avoids centroid blur
\tn2: Candidate
""",
        encoding="utf-8",
    )

    nodes = read_nodes(nodes_path)

    assert nodes[0]["summary"] == "**Why it works**\n\n- Preserves clusters\n- Avoids centroid blur"
    assert nodes[1]["id"] == "n2"


def test_kg_pack_slides_support_multiline_description_attrs(tmp_path):
    schema_path = tmp_path / "kg.schema"
    schema_path.write_text(
        """@graph id=deck
@slides
intro: Intro
\tnodes=n1,n2
\tdesc=|
\t\t**Why this slide matters**

\t\t- Shows the first arc
\t\t- Names the follow-up
""",
        encoding="utf-8",
    )

    graph = read_kg_pack(schema_path)

    assert graph["slides"][0]["nodes"] == ["n1", "n2"]
    assert graph["slides"][0]["desc"] == "**Why this slide matters**\n\n- Shows the first arc\n- Names the follow-up"


def test_kg_pack_nodes_reject_duplicate_child_with_conflicting_label(tmp_path):
    nodes_path = tmp_path / "bad.kg.nodes"
    nodes_path.write_text("b1: Building\n    p1: Person\np1: Parking\n", encoding="utf-8")

    try:
        (tmp_path / "bad.kg.schema").write_text("@graph id=bad\n@sources\nnodes=bad.kg.nodes\n", encoding="utf-8")
        read_kg_pack(tmp_path / "bad.kg.schema")
    except ValueError as exc:
        assert "conflicting labels" in str(exc)
    else:
        raise AssertionError("expected duplicate node guard")


def test_kg_pack_checked_state_is_separate_from_node_attrs():
    checked = CheckedStateContract(checked_node_ids=("n-api",), persistence_id="roadmap")

    assert checked.checked_node_ids == ("n-api",)
    assert checked.persistence_id == "roadmap"
    assert QueryKind.CHECKED_STATE == "checked_state"
    assert MutationKind.SET_CHECKED_STATE == "set_checked_state"
