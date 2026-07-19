import pytest

from vyasa.extensions_builtin.tasks.items_pack import read_kg_pack
from vyasa.extensions_builtin.tasks.query import KnowledgeGraphQuery, QueryError


@pytest.fixture
def context_pack(tmp_path):
    (tmp_path / "kg.schema").write_text(
        """@graph id=delivery
pool=kg.nodes
attrs=kg.attrs
contexts=*.context
default_context=day2

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
    (tmp_path / "z-day1.context").write_text(
        """@context id=day1 seq=1 label="Day one"
@attrs
status:
  open: claim old
@edges
  old -> claim allocates_to confidence=low
  claim -> jira allocates_to
""",
        encoding="utf-8",
    )
    (tmp_path / "a-day2.context").write_text(
        """@context id=day2 seq=2 label="Day two"
@attrs
status:
  done: claim
  open: new
@edges
  claim -> jira allocates_to
  new -> claim allocates_to confidence=high
""",
        encoding="utf-8",
    )
    (tmp_path / "m-day3.context").write_text(
        """@context id=day3 seq=3 label="Day three"
@attrs
status:
  open: new
  done: claim
@edges
  new -> claim allocates_to confidence=high
  claim -> jira allocates_to
""",
        encoding="utf-8",
    )
    return tmp_path / "kg.schema"


def test_renderer_reads_one_complete_context(context_pack):
    day1 = read_kg_pack(context_pack, "day1")
    day2 = read_kg_pack(context_pack, "day2")

    assert {node["id"] for node in day1["tasks"]} == {"old", "claim", "jira"}
    assert {node["id"] for node in day2["tasks"]} == {"new", "claim", "jira"}
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
