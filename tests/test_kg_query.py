import pytest

from vyasa.extensions_builtin.tasks.items_pack import read_kg_pack, read_schema
from vyasa.extensions_builtin.tasks.model import parse_tasks_text
from vyasa.extensions_builtin.tasks.query import KnowledgeGraphQuery, QueryError


@pytest.fixture
def context_pack(tmp_path):
    (tmp_path / "kg.schema").write_text(
        """@graph id=delivery
pool=kg.nodes
attrs=kg.attrs
contexts=*.context
default_context=day2

@sources
edges=kg.edges

@relations
allocates_to

@status_defaults
claim=todo
work=todo
""",
        encoding="utf-8",
    )
    (tmp_path / "kg.nodes").write_text(
        """claim: Delivery claim
jira: Jira item
old: Old requirement
new: New requirement
""",
        encoding="utf-8",
    )
    (tmp_path / "kg.attrs").write_text(
        """@node_attrs
kind:
  claim: claim
  work: jira old new
owner:
  Mia: claim old
  Lee: jira new
score:
  2: claim old
  4: jira new
""",
        encoding="utf-8",
    )
    (tmp_path / "kg.edges").write_text(
        """old-allocates_to-claim: old -> claim allocates_to
    confidence=low
claim-allocates_to-jira: claim -> jira allocates_to
new-allocates_to-claim: new -> claim allocates_to
    confidence=high
    definition=[Allocation contract](../edge-proxies/new-allocates_to-claim.md)
""",
        encoding="utf-8",
    )
    (tmp_path / "z-day1.context").write_text(
        """@context id=day1 seq=1 label="Day one" stage=first
@attrs
status:
  open: claim old
@edges
  old-allocates_to-claim: old -> claim allocates_to
  claim-allocates_to-jira: claim -> jira allocates_to
""",
        encoding="utf-8",
    )
    (tmp_path / "a-day2.context").write_text(
        """@context id=day2 seq=2 label="Day two" stage=second
@attrs
status:
  done: claim
  open: new
@edges
  claim-allocates_to-jira: claim -> jira allocates_to
  new-allocates_to-claim: new -> claim allocates_to
""",
        encoding="utf-8",
    )
    (tmp_path / "m-day3.context").write_text(
        """@context id=day3 seq=3 label="Day three" stage=third
@attrs
status:
  open: new
  done: claim
@edges
  new-allocates_to-claim: new -> claim allocates_to
  claim-allocates_to-jira: claim -> jira allocates_to
""",
        encoding="utf-8",
    )
    return tmp_path / "kg.schema"


def test_renderer_reads_one_complete_context(context_pack):
    day1 = read_kg_pack(context_pack, "day1")
    day2 = read_kg_pack(context_pack, "day2")

    assert {node["id"] for node in day1["tasks"]} == {"old", "claim", "jira"}
    assert {node["id"] for node in day2["tasks"]} == {"new", "claim", "jira"}
    assert day1["node_reference_labels"] == {
        "claim": "Delivery claim",
        "jira": "Jira item",
        "old": "Old requirement",
        "new": "New requirement",
    }
    assert {node["id"]: node["status"] for node in day1["tasks"]}["claim"] == "open"
    assert {node["id"]: node["status"] for node in day2["tasks"]}["claim"] == "done"


def test_unknown_context_names_requested_id(context_pack):
    with pytest.raises(QueryError, match="missing"):
        KnowledgeGraphQuery(context_pack).run("nodes at missing")

    with pytest.raises(ValueError, match="missing"):
        read_kg_pack(context_pack, "missing")


def test_context_source_uses_seq_order_and_answer_names_context(context_pack):
    query = KnowledgeGraphQuery(context_pack)

    contexts = query.run("contexts | select id seq")
    nodes = query.run("nodes | select id")

    assert contexts == [{"id": "day1", "seq": 1}, {"id": "day2", "seq": 2}, {"id": "day3", "seq": 3}]
    assert nodes.context == "day2"
    assert nodes.as_dict()["context"] == "day2"


def test_traversal_is_isolated_and_can_explain_paths(context_pack):
    query = KnowledgeGraphQuery(context_pack)

    day1 = query.run("nodes at day1 | where id=jira | incoming* allocates_to | paths | select id path")
    day2 = query.run("nodes at day2 | where id=jira | incoming* allocates_to | paths | select id path")

    assert [row["id"] for row in day1] == ["claim", "old"]
    assert [row["id"] for row in day2] == ["claim", "new"]
    assert day2[1]["path"] == [
        {"source": "claim", "relation": "allocates_to", "target": "jira"},
        {"source": "new", "relation": "allocates_to", "target": "claim"},
    ]


def test_chained_traversals_keep_the_full_path(context_pack):
    rows = KnowledgeGraphQuery(context_pack).run(
        "nodes at day2 | where id=jira | incoming allocates_to | incoming allocates_to | paths | select id path"
    )

    assert rows == [
        {
            "id": "new",
            "path": [
                {"source": "claim", "relation": "allocates_to", "target": "jira"},
                {"source": "new", "relation": "allocates_to", "target": "claim"},
            ],
        }
    ]


def test_traversal_rejects_undeclared_relation(context_pack):
    with pytest.raises(QueryError, match="Undeclared KG relation: blocks"):
        KnowledgeGraphQuery(context_pack).run("nodes | follow blocks")


def test_diff_compares_resolved_snapshots_not_file_order(context_pack):
    query = KnowledgeGraphQuery(context_pack)

    changed = query.run("diff day1 day2")
    reordered = query.run("diff day2 day3")

    assert {"change": "added", "kind": "node", "id": "new", "value": next(row["value"] for row in changed if row.get("id") == "new")} in changed
    assert any(row["kind"] == "attribute" and row["id"] == "claim" and row["field"] == "status" for row in changed)
    assert any(row["kind"] == "edge" and row["change"] == "removed" and row["source"] == "old" for row in changed)
    assert reordered == []
    assert changed.context == {"from": "day1", "to": "day2"}


def test_previous_context_diff_returns_present_changed_node_ids(context_pack):
    query = KnowledgeGraphQuery(context_pack)

    assert query.previous_context_diff("day2") == {
        "from": "day1",
        "to": "day2",
        "node_ids": ["claim", "new"],
    }
    assert query.previous_context_diff("day1") == {
        "from": "",
        "to": "day1",
        "node_ids": [],
    }


def test_filters_groups_and_aggregates_use_current_result(context_pack):
    rows = KnowledgeGraphQuery(context_pack).run(
        "nodes at day2 | where score>=2 owner=Mia,Lee | group owner | count | sum score | avg score | rate sum_score count 100 | sort group"
    )

    assert rows == [
        {"group": "Lee", "count": 2, "sum_score": 8.0, "avg_score": 4.0, "rate": 400.0},
        {"group": "Mia", "count": 1, "sum_score": 2.0, "avg_score": 2.0, "rate": 200.0},
    ]


def test_facts_join_preserves_machine_fields(context_pack):
    rows = KnowledgeGraphQuery(context_pack).run(
        "facts at day2 | where relation=allocates_to e=new | join label owner | select e a v relation label owner"
    )

    assert rows == [
        {
            "e": "new",
            "a": "allocates_to",
            "v": "claim",
            "relation": "allocates_to",
            "label": "New requirement",
            "owner": "Lee",
        }
    ]


def test_edge_facts_keep_shared_record_fields(context_pack):
    rows = KnowledgeGraphQuery(context_pack).run(
        "facts at day2 | where definition!=_none | select edge_id e relation v confidence definition introduced_stage"
    )

    assert rows == [{
        "edge_id": "new-allocates_to-claim",
        "e": "new",
        "relation": "allocates_to",
        "v": "claim",
        "confidence": "high",
        "definition": "[Allocation contract](../edge-proxies/new-allocates_to-claim.md)",
        "introduced_stage": "second",
    }]


def _write_view_context_pack(tmp_path, fixed_context="day1"):
    (tmp_path / "kg.schema").write_text(
        f"""@graph id=views
pool=kg.nodes
contexts=*.context
default_context=day1

@views
active_story:
    context=active
    group_by=kind
    slides:
        intro: Active story
            nodes=claim,jira
            caption="Start here"
            desc=|
                **Active context**

                - First point
latest_story:
    context=latest
    color_by=status
    slides:
        latest: Latest story
            nodes=new,claim
fixed_story:
    context={fixed_context}
    slides:
        fixed: Fixed story
            nodes=old,claim
plain:
    context=active
    color_by=status
""",
        encoding="utf-8",
    )
    (tmp_path / "kg.nodes").write_text(
        "claim: Claim\n\tkind=claim\njira: Jira\n\tkind=work\nold: Old\n\tkind=work\nnew: New\n\tkind=work\n",
        encoding="utf-8",
    )
    (tmp_path / "day1.context").write_text(
        "@context id=day1 seq=1\n@edges\nold -> claim\nclaim -> jira\n",
        encoding="utf-8",
    )
    (tmp_path / "day2.context").write_text(
        "@context id=day2 seq=2\n@edges\nnew -> claim\nclaim -> jira\n",
        encoding="utf-8",
    )
    return tmp_path / "kg.schema"


def test_views_parse_ordered_nested_slides_and_resolve_contexts(tmp_path):
    schema_path = _write_view_context_pack(tmp_path)
    schema = read_schema(schema_path)
    compiled = read_kg_pack(schema_path, "day1")

    assert [slide["id"] for slide in schema.views[0].slides] == ["intro"]
    assert schema.views[0].slides[0]["desc"] == "**Active context**\n\n- First point"
    projections = {view["id"]: view for view in compiled["view_projections"]}
    assert projections["active_story"]["resolved_context"] == "day1"
    assert projections["latest_story"]["resolved_context"] == "day2"
    assert projections["fixed_story"]["resolved_context"] == "day1"
    assert projections["plain"].get("slides", []) == []
    assert compiled["slides"] == []
    day2 = {view["id"]: view for view in read_kg_pack(schema_path, "day2")["view_projections"]}
    assert day2["active_story"]["resolved_context"] == "day2"
    assert day2["fixed_story"]["resolved_context"] == "day1"


def test_projection_models_own_slides_and_allow_views_without_grouping(tmp_path):
    schema_path = _write_view_context_pack(tmp_path)
    model = parse_tasks_text(
        f"```items\n---\nitems_schema: {schema_path}\nkg_context_id: day1\n---\n```",
        current_path=tmp_path / "graph.md",
    )

    assert model["projection_models"]["active-story"]["model"]["slides"][0]["id"] == "intro"
    fixed = model["projection_models"]["fixed-story"]["model"]
    assert fixed["slides"][0]["id"] == "fixed"
    assert {node["__source_node_id"] for node in fixed["tasks"]} == {"old", "claim", "jira"}
    assert model["projection_models"]["plain"]["model"]["slides"] == []


def test_context_owns_its_views_and_slides(tmp_path):
    schema_path = _write_view_context_pack(tmp_path)
    with (tmp_path / "day1.context").open("a", encoding="utf-8") as handle:
        handle.write(
            """@views
day1_story:
    group_by=kind
    slides:
        intro: Day one
            nodes=old,claim
            desc=|
                **Owned by day one**
plain:
    color_by=status
"""
        )

    compiled = read_kg_pack(schema_path, "day1")

    assert [view["id"] for view in compiled["view_projections"]] == ["day1_story", "plain"]
    assert compiled["view_projections"][0]["context"] == "day1"
    assert compiled["view_projections"][0]["resolved_context"] == "day1"
    assert compiled["view_projections"][0]["slides"][0]["desc"] == "**Owned by day one**"
    assert [view["id"] for view in read_kg_pack(schema_path, "day2")["view_projections"]] == [
        "active_story",
        "latest_story",
        "fixed_story",
        "plain",
    ]
    model = parse_tasks_text(
        f"```items\n---\nitems_schema: {schema_path}\nkg_context_id: day1\n---\n```",
        current_path=tmp_path / "graph.md",
    )
    assert model["projection_models"]["day1-story"]["model"]["slides"][0]["id"] == "intro"


def test_unknown_view_context_fails_pack_loading(tmp_path):
    schema_path = _write_view_context_pack(tmp_path, fixed_context="missing")

    with pytest.raises(QueryError, match="Unknown KG context: missing"):
        read_kg_pack(schema_path, "day1")


def test_legacy_schema_and_context_slides_keep_their_fallback(tmp_path):
    schema_path = _write_view_context_pack(tmp_path)
    with schema_path.open("a", encoding="utf-8") as handle:
        handle.write("@slides\nschema: Schema story\n    nodes=claim,jira\n")
    with (tmp_path / "day1.context").open("a", encoding="utf-8") as handle:
        handle.write("@slides\ncontext: Context story\n    nodes=old,claim\n")

    assert [slide["id"] for slide in read_kg_pack(schema_path, "day1")["slides"]] == ["context"]
    assert [slide["id"] for slide in read_kg_pack(schema_path, "day2")["slides"]] == ["schema"]
