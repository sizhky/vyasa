import json
import re
from pathlib import Path
from types import SimpleNamespace

from vyasa.extensions_builtin.mdx.render import render_mdx_body, split_mdx
from vyasa.extensions_builtin.mdx.file_routes import _atomic_write_bytes, _resolve_ref
from vyasa.extensions_builtin.mdx.catalog import register_mdx_catalog_routes
from vyasa.extensions_builtin.mdx.excalidraw_routes import (
    apply_compact_create,
    apply_compact_patch,
    browser_autosave_conflicts,
    compact_scene,
    register_excalidraw_routes,
    _bump_revision,
)
from vyasa.api_catalog import build_vyasa_api_catalog, namespace_catalog
from vyasa.extensions_builtin.filesystem_routes import _register_filesystem_routes
from vyasa.extensions import build_extension_runtime, set_extension_runtime
from vyasa.helpers import document_icon_for_path, document_kind_for_path
from vyasa.runtime_services import set_runtime_services


MDX_STATIC = Path(__file__).parents[1] / "vyasa" / "extensions_builtin" / "mdx" / "static"


def test_split_mdx_extracts_default_jsx_import_and_island():
    imports, markdown, islands = split_mdx(
        "import FancyChart from './FancyChart.jsx'\n\n# Report\n\n<FancyChart value={42} />\n"
    )

    assert imports == {"FancyChart": "./FancyChart.jsx"}
    assert "# Report" in markdown
    assert 'data-vyasa-mdx-island="0"' in markdown
    assert islands == ["<FancyChart value={42} />"]


def test_markdown_with_mdx_uses_mdx_kind_and_icon(tmp_path):
    page = tmp_path / "dashboard.md"
    page.write_text("# Dashboard\n\n<Widget />\n", encoding="utf-8")
    runtime = build_extension_runtime({})
    set_extension_runtime(runtime)
    try:
        assert document_kind_for_path(page) == "mdx"
        assert document_icon_for_path(page) == "file-code"
    finally:
        set_extension_runtime(None)


def test_plain_markdown_keeps_markdown_kind_and_icon(tmp_path):
    page = tmp_path / "notes.md"
    page.write_text("# Notes\n\nPlain Markdown.\n", encoding="utf-8")
    runtime = build_extension_runtime({})
    set_extension_runtime(runtime)
    try:
        assert document_kind_for_path(page) == "markdown"
        assert document_icon_for_path(page) == "file-text"
    finally:
        set_extension_runtime(None)


def test_export_only_markdown_uses_mdx_kind(tmp_path):
    page = tmp_path / "data.md"
    page.write_text("export const answer = 42\n\n# Data\n", encoding="utf-8")
    runtime = build_extension_runtime({})
    set_extension_runtime(runtime)
    try:
        assert document_kind_for_path(page) == "mdx"
    finally:
        set_extension_runtime(None)


def test_render_mdx_body_emits_payload(tmp_path):
    doc = tmp_path / "report.md"
    doc.write_text(
        "---\ntitle: Internet MDX\n---\nimport FancyChart from './FancyChart.jsx'\n\n# Report\n\n<FancyChart />\n",
        encoding="utf-8",
    )

    title, html, toc_source = render_mdx_body(doc, "demo/report")
    payload_text = re.search(
        r'<script type="application/json" class="vyasa-mdx-payload">(.*?)</script>',
        html,
    ).group(1)
    payload = json.loads(payload_text)

    assert title == "Internet MDX"
    assert payload["base"] == "demo"
    assert payload["imports"] == {"FancyChart": "./FancyChart.jsx"}
    assert payload["islands"] == ["<FancyChart />"]
    assert "# Report" in toc_source


def test_split_mdx_ignores_jsx_inside_code_fence():
    imports, markdown, islands = split_mdx(
        "import FancyChart from './FancyChart.jsx'\n\n```mdx\n<FancyChart />\n```\n\n<FancyChart />\n"
    )

    assert imports == {"FancyChart": "./FancyChart.jsx"}
    assert "```mdx\n<FancyChart />\n```" in markdown
    assert islands == ["<FancyChart />"]


def test_excalidraw_is_available_without_an_import():
    imports, _, islands = split_mdx('<Excalidraw id="roadmap" />')
    component_source = (MDX_STATIC / "excalidraw.js").read_text(encoding="utf-8")
    runtime_source = (MDX_STATIC / "mdx.js").read_text(encoding="utf-8")

    assert imports == {}
    assert islands == ['<Excalidraw id="roadmap" />']
    assert "window.VyasaMdxComponents" in component_source
    assert "window.VyasaMdxComponents" in runtime_source
    assert "canvasApi.current.updateScene(next)" in component_source
    assert "Excalidraw requires a stable id" in component_source
    assert "latest !== revision.current" in component_source
    assert "suppressSave.current" in component_source

    bundle = build_extension_runtime({}).bundles["mdx.runtime"]
    assert bundle.js == (
        "/static/extensions/mdx/excalidraw.js",
        "/static/extensions/mdx/mdx.js",
    )


def test_compact_excalidraw_graph_exposes_nodes_and_connections():
    scene = {"elements": [
        {"id": "a", "type": "rectangle", "backgroundColor": "#ffc9c9", "groupIds": ["ga"]},
        {"id": "at", "type": "text", "text": "Todo", "groupIds": ["ga"]},
        {"id": "b", "type": "rectangle", "backgroundColor": "#b2f2bb", "groupIds": ["gb"]},
        {"id": "bt", "type": "text", "text": "Done", "groupIds": ["gb"]},
        {"id": "edge", "type": "arrow", "strokeColor": "#1e1e1e", "groupIds": [],
         "startBinding": {"elementId": "a"}, "endBinding": {"elementId": "b"}},
        {"id": "deleted", "type": "rectangle", "isDeleted": True, "backgroundColor": "#fff"},
    ]}

    assert compact_scene(scene) == {
        "nodes": [
            {"id": "a", "text": "Todo", "color": "#ffc9c9"},
            {"id": "b", "text": "Done", "color": "#b2f2bb"},
        ],
        "connections": [
            {"id": "edge", "from": "a", "to": "b", "text": "", "color": "#1e1e1e"},
        ],
    }


def test_compact_excalidraw_patch_preserves_layout_and_updates_text_color():
    scene = {"elements": [
        {"id": "a", "type": "rectangle", "x": 12, "version": 2,
         "backgroundColor": "#ffc9c9", "groupIds": ["ga"]},
        {"id": "at", "type": "text", "text": "Todo", "originalText": "Todo",
         "version": 3, "backgroundColor": "#ffc9c9", "groupIds": ["ga"]},
    ]}

    apply_compact_patch(scene, {"nodes": [{"id": "a", "text": "Done", "color": "#b2f2bb"}]})

    shape, label = scene["elements"]
    assert shape["x"] == 12
    assert shape["backgroundColor"] == label["backgroundColor"] == "#b2f2bb"
    assert label["text"] == label["originalText"] == "Done"
    assert shape["version"] == 3
    assert label["version"] == 4


def test_compact_excalidraw_create_adds_card_and_bound_connection():
    scene = {"elements": [
        {"id": "a", "type": "rectangle", "x": 0, "y": 0, "width": 200, "height": 100,
         "backgroundColor": "#ffc9c9", "boundElements": []},
    ]}

    apply_compact_create(scene, {
        "nodes": [{"id": "b", "text": "Done", "color": "#b2f2bb", "x": 320, "y": 0}],
        "connections": [{"id": "edge", "from": "a", "to": "b", "text": "next"}],
    })

    graph = compact_scene(scene)
    assert {node["id"] for node in graph["nodes"]} == {"a", "b"}
    assert graph["connections"] == [
        {"id": "edge", "from": "a", "to": "b", "text": "next", "color": "#1e1e1e"},
    ]
    assert {item["id"] for item in scene["elements"][0]["boundElements"]} == {"edge"}


def test_stale_browser_autosave_cannot_overwrite_api_update():
    path = "demo/roadmap"
    revision = _bump_revision(path, "main")
    stale = SimpleNamespace(headers={"sec-fetch-mode": "cors"}, query_params={})
    current = SimpleNamespace(
        headers={"sec-fetch-mode": "cors"},
        query_params={"canvas": "main", "revision": str(revision)},
    )
    tool = SimpleNamespace(headers={}, query_params={})

    assert browser_autosave_conflicts(path, stale)
    assert not browser_autosave_conflicts(path, current)
    assert not browser_autosave_conflicts(path, tool)


def test_mdx_extension_registers_excalidraw_graph_api():
    runtime = build_extension_runtime({})
    routes = {(route["prefix"], route["methods"]) for route in runtime.route_handlers}

    assert ("/api/mdx/excalidraw", ("GET", "POST", "PATCH")) in routes


def test_excalidraw_api_paths_include_document_and_canvas_id():
    routes = []

    def rt(pattern, **kwargs):
        routes.append((pattern, tuple(kwargs.get("methods", ("GET",)))))
        return lambda fn: fn

    register_excalidraw_routes(rt, None)
    register_mdx_catalog_routes(rt, None)

    assert ("/api/mdx/excalidraw/{path:path}/canvas/{canvas_id}", ("GET",)) in routes
    assert ("/api/mdx/excalidraw/{path:path}/canvas/{canvas_id}", ("POST",)) in routes
    assert ("/api/mdx/excalidraw/{path:path}/canvas/{canvas_id}", ("PATCH",)) in routes
    assert ("/api/mdx/excalidraw/{path:path}/canvas/{canvas_id}/refresh", ("POST",)) in routes

    operations = {item["id"]: item for item in namespace_catalog("mdx")["operations"]}
    create = operations["mdx.excalidraw.graph.create"]
    assert create["signature"] == "create_graph_elements(path: str, canvas_id: str, request)"
    assert create["description"] == "Add cards and bound connections while preserving the Excalidraw scene."
    assert create["methods"] == ["POST"]
    aggregate = build_vyasa_api_catalog(build_extension_runtime({}))
    mdx_catalog = next(catalog for catalog in aggregate["catalogs"] if catalog["namespace"] == "mdx")
    assert mdx_catalog["href"] == "/api/mdx/catalog"


def test_filesystem_routes_expose_jsx_for_mdx_components():
    routes = []

    def rt(pattern, **kwargs):
        routes.append((pattern, tuple(kwargs.get("methods", ("GET",)))))
        return lambda fn: fn

    _register_filesystem_routes(rt, None)

    assert ("/posts/{path:path}.jsx", ("GET",)) in routes


def test_mdx_file_ref_resolves_relative_to_document(tmp_path):
    doc = tmp_path / "demo" / "page.md"
    doc.parent.mkdir()
    doc.write_text("# Demo", encoding="utf-8")
    target = doc.parent / "page.state.json"
    request = SimpleNamespace(query_params={"ref": "./page.state.json"})
    set_runtime_services({
        "content_path_for_slug": lambda slug, suffix="": doc if slug == "demo/page" and suffix == ".md" else tmp_path / slug,
        "get_content_mounts": lambda: (("", tmp_path),),
    })
    try:
        path = _resolve_ref("demo/page", request, SimpleNamespace(can_read_post=lambda slug, request: True))
        assert path == target.resolve()
        _atomic_write_bytes(path, b'{"ok": true}\n')
        assert json.loads(target.read_text(encoding="utf-8"))["ok"] is True
    finally:
        set_runtime_services(None)


def test_mdx_file_ref_rejects_escape(tmp_path):
    doc = tmp_path / "demo" / "page.md"
    doc.parent.mkdir()
    doc.write_text("# Demo", encoding="utf-8")
    request = SimpleNamespace(query_params={"ref": "../../outside.json"})
    set_runtime_services({
        "content_path_for_slug": lambda slug, suffix="": doc if slug == "demo/page" and suffix == ".md" else tmp_path / slug,
        "get_content_mounts": lambda: (("", tmp_path / "demo"),),
    })
    try:
        assert _resolve_ref("demo/page", request, SimpleNamespace(can_read_post=lambda slug, request: True)) is None
    finally:
        set_runtime_services(None)
