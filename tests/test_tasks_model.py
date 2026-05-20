import json

from vyasa.extensions_builtin.tasks.model import parse_tasks_text
from vyasa.extensions_builtin.tasks.layout import build_collapsed_graph


DEMO_TASKS = """```tasks
id: hybrid-task-demo
title: Hybrid Task Rendering
foundation :: Foundation:
  model :: Model:
    - t1 :: Define graph payload
    - t2 :: Validate parser
    - t3 :: Emit collapsed graph
  api :: API:
    - t4 :: Add save route
    - t5 :: Persist block edits
ui :: UI:
  canvas :: Canvas:
    - t6 :: Render cards
    - t7 :: Render edges
  interactions :: Interactions:
    - t8 :: Expand groups
    - t9 :: Drag cards
    - t10 :: Save edits

t7 -> t8
t5 -> t10
```"""


def test_grouped_tasks_demo_parses_into_stable_model():
    model = parse_tasks_text(DEMO_TASKS)

    assert model["graph_id"] == "hybrid-task-demo"
    assert model["title"] == "Hybrid Task Rendering"
    assert model["group_tree"][None] == ["foundation", "ui"]
    assert model["group_tree"]["foundation"] == ["model", "api"]
    assert model["group_tree"]["ui"] == ["canvas", "interactions"]
    assert model["task_children"]["model"] == ["t1", "t2", "t3"]
    assert model["task_children"]["api"] == ["t4", "t5"]
    assert model["task_children"]["canvas"] == ["t6", "t7"]
    assert model["task_children"]["interactions"] == ["t8", "t9", "t10"]
    assert {"source": "t7", "target": "t8"} in model["dependency_edges"]
    assert {"source": "t5", "target": "t10"} in model["dependency_edges"]
    assert model["document_order"][:3] == ["foundation", "model", "api"]
    assert model["document_order"][-3:] == ["t8", "t9", "t10"]


def test_tasks_parser_reads_real_tasks_fence():
    model = parse_tasks_text(DEMO_TASKS)

    assert model["groups"][0]["id"] == "foundation"
    assert model["tasks"][0]["id"] == "t1"


def test_tasks_parser_generates_graph_id_when_missing():
    model = parse_tasks_text("""```tasks
title: Demo Graph
foundation :: Foundation:
```""")

    assert model["graph_id"].startswith("demo-graph-")


def test_tasks_parser_supports_explicit_labeled_edges():
    model = parse_tasks_text("""```items
foundation :: Foundation:
  - t1 :: Parse graph
  - t2 :: Render graph
t1 ->|feeds UI| t2
```""")

    assert {"source": "t1", "target": "t2", "label": "feeds UI"} in model["dependency_edges"]


def test_items_parser_supports_chained_edges():
    model = parse_tasks_text("""```items
Migrations:
  - m-1 :: Migration 1
  - m-2 :: Migration 2
  - m-3 :: Migration 3
  - m-4 :: Migration 4

m-1 -> m-2 -> m-3 -> m-4
```""")

    assert model["dependency_edges"] == [
        {"source": "m-1", "target": "m-2"},
        {"source": "m-2", "target": "m-3"},
        {"source": "m-3", "target": "m-4"},
    ]


def test_items_parser_reads_nested_groups_and_fanout_edges():
    model = parse_tasks_text(
        """```items
runtime :: Runtime:
  content :: Content:
    - parse :: "Parse markdown [v2]"
    - render :: Render page | owner: Alice | estimate: 2d
  search :: Search:
    - index :: Index docs

parse ->|"feeds AST"| render, index
render -> deploy
```"""
    )

    assert model["group_tree"][None] == ["runtime"]
    assert model["group_tree"]["runtime"] == ["content", "search"]
    assert model["task_children"]["content"] == ["parse", "render"]
    assert model["tasks"][1]["owner"] == "Alice"
    assert {"source": "parse", "target": "render", "label": "feeds AST"} in model["dependency_edges"]
    assert {"source": "parse", "target": "index", "label": "feeds AST"} in model["dependency_edges"]


def test_items_parser_uses_json_strings_for_complex_text():
    model = parse_tasks_text(
        r'''```items
"Group: [quoted]":
  - "task-id" :: "Line one\nLine two with \"quotes\", [brackets], and hyphens - ok"
  - "target-id" :: "Target"

"task-id" ->|"edge says \"yes\" -> [ok]"| "target-id"
```'''
    )

    assert model["groups"][0]["label"] == "Group: [quoted]"
    assert model["tasks"][0]["label"] == 'Line one\nLine two with "quotes", [brackets], and hyphens - ok'
    assert model["dependency_edges"] == [
        {"source": "task-id", "target": "target-id", "label": 'edge says "yes" -> [ok]'}
    ]


def test_items_parser_supports_color_palette_and_node_color_override():
    model = parse_tasks_text(
        """```items
color_palette: phase
  Phase 1: "#7c3aed"
  Phase 2: "#0f766e"

Roadmap:
  - one :: First | phase: Phase 1
  - two :: Second | phase: Phase 2 | color: "#ff006e"
```"""
    )

    assert model["color_by"] == "phase"
    assert model["color_palette"] == {"Phase 1": "#7c3aed", "Phase 2": "#0f766e"}
    assert model["tasks"][0]["phase"] == "Phase 1"
    assert model["tasks"][1]["color"] == "#ff006e"


def test_items_parser_supports_group_color_attributes():
    model = parse_tasks_text(
        """```items
Foundation | color: "#8fa8d8":
  Platform | color: "#9db8ab":
    - t1 :: Build auth
  - t2 :: Seed data
```"""
    )

    assert model["groups"][0]["color"] == "#8fa8d8"
    assert model["groups"][1]["color"] == "#9db8ab"
    assert model["tasks"][0]["group_id"] == "platform"


def test_items_parser_supports_boolean_attributes():
    model = parse_tasks_text(
        """```items
Roadmap | frozen:
  - one :: First | blocked | hidden: false
```"""
    )

    assert model["groups"][0]["frozen"] is True
    assert model["tasks"][0]["blocked"] is True
    assert model["tasks"][0]["hidden"] is False


def test_items_parser_reads_frontmatter_color_by_palettes():
    model = parse_tasks_text(
        """```items
---
title: Palette Demo
color_by:
  critical_path:
    "true": "#e53935"
    "false": "#9e9e9e"
---
Roadmap:
  - one :: First | critical_path: true
```"""
    )

    assert model["title"] == "Palette Demo"
    assert model["color_by"] == "critical_path"
    assert model["node_color_palettes"]["critical_path"] == {"true": "#e53935", "false": "#9e9e9e"}


def test_items_parser_reads_default_color_by():
    model = parse_tasks_text(
        """```items
---
default_color_by: sprint
color_by:
  sprint:
    One: "#2563eb"
---
Roadmap:
  - one :: First | sprint: One
```"""
    )

    assert model["default_color_by"] == "sprint"


def test_items_parser_adds_rank_color_mode_from_dag_depth():
    model = parse_tasks_text(
        """```items
---
default_color_by: rank
---
Plan:
  Backend:
    - api :: API
    - db :: DB
  Frontend:
    - ui :: UI

db -> api
api -> ui
```"""
    )

    tasks = {task["id"]: task for task in model["tasks"]}
    groups = {group["id"]: group for group in model["groups"]}
    assert model["default_color_by"] == "rank"
    assert tasks["db"]["rank"] == "0"
    assert tasks["api"]["rank"] == "1"
    assert tasks["ui"]["rank"] == "2"
    assert groups["backend"]["rank"] == "1"
    assert groups["frontend"]["rank"] == "2"
    assert model["node_color_palettes"]["rank"] == {
        "0": "#22c55e",
        "1": "#facc15",
        "2": "#dc2626",
    }


def test_items_parser_supports_edge_color_palette_and_override():
    model = parse_tasks_text(
        """```items
---
edge_color_palette: relation
  reads: "#2563eb"
  writes: "#dc2626"
---
System:
  - api :: API
  - db :: DB
api -> db | relation: reads
db -> api | relation: writes | color: "#7c3aed"
```"""
    )

    assert model["edge_color_by"] == "relation"
    assert model["edge_color_palette"] == {"reads": "#2563eb", "writes": "#dc2626"}
    assert model["dependency_edges"][0]["relation"] == "reads"
    assert model["dependency_edges"][1]["color"] == "#7c3aed"


def test_items_parser_loads_shared_palette_from_json_file(tmp_path):
    palette_path = tmp_path / "shared-palettes.json"
    palette_path.write_text(
        json.dumps({
            "node_color_palettes": {
                "status": {
                    "Todo": "#fa7115",
                    "Done": "#2cd013",
                }
            },
            "edge_color_palettes": {
                "relation": {
                    "depends_on": "#2563eb",
                    "validates": "#84cc16",
                }
            }
        }),
        encoding="utf-8",
    )
    markdown_path = tmp_path / "graph.md"
    markdown_path.write_text(
        """```items
---
title: Shared Palette
color_palette_source: shared-palettes.json
---
Roadmap:
  - one :: First | status: Todo
root -> one | relation: depends_on
```""",
        encoding="utf-8",
    )

    model = parse_tasks_text(markdown_path.read_text(encoding="utf-8"), current_path=markdown_path)

    assert model["color_by"] == "status"
    assert model["node_color_palettes"]["status"] == {"Todo": "#fa7115", "Done": "#2cd013"}
    assert model["color_palette"] == {"Todo": "#fa7115", "Done": "#2cd013"}
    assert model["edge_color_by"] == "relation"
    assert model["edge_color_palettes"]["relation"] == {"depends_on": "#2563eb", "validates": "#84cc16"}
    assert model["color_palette_source"] == "shared-palettes.json"


def test_items_parser_ignores_legacy_color_palettes_json_key(tmp_path):
    palette_path = tmp_path / "shared-palettes.json"
    palette_path.write_text(json.dumps({
        "color_palettes": {
            "status": {"Todo": "#fa7115"}
        }
    }), encoding="utf-8")
    markdown_path = tmp_path / "graph.md"
    markdown_path.write_text(
        """```items
---
color_palette_source: shared-palettes.json
---
Roadmap:
  - one :: First | status: Todo
```""",
        encoding="utf-8",
    )

    model = parse_tasks_text(markdown_path.read_text(encoding="utf-8"), current_path=markdown_path)

    assert "status" not in model["node_color_palettes"]
    assert model["color_by"] == ""


def test_items_parser_reads_filter_attributes():
    model = parse_tasks_text(
        """```items
---
filter_attributes:
  - owner
  - status
---
Roadmap:
  - one :: First | owner: Alice | status: Active | priority: High
```"""
    )

    assert model["filter_attributes"] == ["owner", "status"]


def test_collapsed_graph_projects_nested_task_edges_to_root_groups():
    model = parse_tasks_text(
        """```items
Alpha:
  Inner:
    - a1 :: A1
Beta:
  - b1 :: B1
a1 -> b1
```"""
    )

    collapsed = build_collapsed_graph(model)

    assert {"source": "alpha", "target": "beta", "kind": "collapsed-proxy"} in collapsed["edges"]
