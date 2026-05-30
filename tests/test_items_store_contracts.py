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
from vyasa.extensions_builtin.tasks.items_pack import read_kg_pack
from vyasa.extensions_builtin.tasks.model import parse_tasks_text

import sys
from pathlib import Path

SKILL_SCRIPT_DIR = Path(__file__).resolve().parents[1] / ".agents/skills/vyasa/scripts"
if str(SKILL_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_SCRIPT_DIR))

from kg_pack_convert import convert_legacy_items_markdown


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

    assert "items_schema: legacy.kg.schema" in conversion.markdown_text
    assert "color_by:\n  status:" not in conversion.markdown_text
    assert "edge_color_palette:" not in conversion.markdown_text
    assert '"status"' in conversion.palette_text
    assert '"enables": "#2563eb"' in conversion.palette_text
    assert "base:\n\tnodes=legacy.kg.nodes\n\tedges=legacy.kg.edges\n\tattrs=legacy.kg.attrs" in conversion.schema_text
    assert "overview:\n\tsource=base\n\tgroup_by,color_by=status" in conversion.schema_text
    assert conversion.nodes_text.startswith("n1: API")
    assert "status:\n  done: n1" in conversion.attrs_text
    assert "owner:\n  eng: n1" in conversion.attrs_text
    assert conversion.edges_text.startswith("e1: n1 -> n-ui enables")


def test_items_parser_loads_kg_schema_pack(tmp_path):
    (tmp_path / "roadmap.kg.schema").write_text(
        """@graph id=roadmap title=Roadmap initial_view=delivery

@sources
base:
    nodes=roadmap.kg.nodes
    edges=roadmap.kg.edges
    attrs=roadmap.kg.attrs
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
    group_by=owner
    color_by=status
    edge_label_from=relation
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
    assert model["tasks"][0]["status"] == "todo"
    assert model["dependency_edges"][0]["relation"] == "unlocks"
    assert model["dependency_edges"][0]["confidence"] == "high"
    assert model["view_projections"][0]["caption"] == "Track delivery"
    assert model["default_projection"] == "delivery"


def test_kg_pack_checked_state_is_separate_from_node_attrs():
    checked = CheckedStateContract(checked_node_ids=("n-api",), persistence_id="roadmap")

    assert checked.checked_node_ids == ("n-api",)
    assert checked.persistence_id == "roadmap"
    assert QueryKind.CHECKED_STATE == "checked_state"
    assert MutationKind.SET_CHECKED_STATE == "set_checked_state"
