import asyncio

from vyasa.assets import bundle_asset_nodes, requested_page_bundles, route_bundle_names
from vyasa.build import build_static_site
from vyasa.core import extension_static_asset
from vyasa.extensions import AssetBundle, ExtensionPlan, ExtensionRuntime, build_extension_runtime, get_extension_runtime, set_extension_runtime


def test_route_bundle_names_select_route_bundles():
    assert route_bundle_names(show_sidebar=True) == (
        "default_search.runtime",
        "bookmarks.runtime",
        "git_refs.runtime",
    )
    assert route_bundle_names(
        show_sidebar=True,
        current_path="docs/page",
        annotations_enabled=True,
    ) == (
        "default_search.runtime",
        "bookmarks.runtime",
        "annotations.runtime",
        "git_refs.runtime",
    )
    assert route_bundle_names(slide_mode=True) == ("slides.runtime",)


def test_bundle_asset_nodes_emit_css_and_js_once():
    runtime = ExtensionRuntime(
        plan=ExtensionPlan("default", {}, ()),
        catalog={},
        bundles={
            "a": AssetBundle("a", css=("/static/a.css",), js=("/static/a.js",)),
            "b": AssetBundle("b", css=("/static/a.css",), js=("/static/b.js",)),
        },
    )

    nodes = bundle_asset_nodes(("a", "b"), runtime=runtime)
    rendered = [getattr(node, "attrs", {}) for node in nodes]

    assert len(nodes) == 3
    assert rendered[0]["href"].startswith("/static/a.css")
    assert rendered[0]["data-vyasa-bundle-asset"] == "true"
    assert rendered[0]["data-vyasa-bundle-kind"] == "css"
    assert rendered[1]["src"].startswith("/static/a.js")
    assert rendered[1]["data-vyasa-bundle-asset"] == "true"
    assert rendered[1]["data-vyasa-bundle-kind"] == "js"
    assert rendered[2]["src"].startswith("/static/b.js")


def test_bundle_asset_nodes_emit_dependencies_first():
    runtime = ExtensionRuntime(
        plan=ExtensionPlan("default", {}, ()),
        catalog={},
        bundles={
            "code": AssetBundle("code", js=("/static/code.js",)),
            "preview": AssetBundle("preview", js=("/static/preview.js",), depends_on=("code",)),
        },
    )

    nodes = bundle_asset_nodes(("preview",), runtime=runtime)

    assert [getattr(node, "attrs", {})["src"].split("?", 1)[0] for node in nodes] == [
        "/static/code.js",
        "/static/preview.js",
    ]


def test_bundle_asset_nodes_keep_classic_scripts_out_of_module_scope():
    runtime = ExtensionRuntime(
        plan=ExtensionPlan("default", {}, ()),
        catalog={},
        bundles={"code": AssetBundle("code", classic_js=("/static/highlight.js",), js=("/static/code.js",))},
    )

    nodes = bundle_asset_nodes(("code",), runtime=runtime)

    assert "type" not in getattr(nodes[0], "attrs", {})
    assert getattr(nodes[1], "attrs", {})["type"] == "module"


def test_extension_assets_require_browser_revalidation():
    response = asyncio.run(extension_static_asset("tasks", "tasks_graph_core.js"))

    assert response.headers["cache-control"] == "no-cache, max-age=0, must-revalidate"


def test_runtime_and_static_request_annotations_when_enabled():
    default_runtime = build_extension_runtime({})
    previous = get_extension_runtime()
    try:
        set_extension_runtime(default_runtime)
        disabled_bundles = requested_page_bundles(
            current_path="docs/page",
            annotations_enabled=False,
        )
        runtime_bundles = requested_page_bundles(
            show_sidebar=True,
            current_path="docs/page",
            annotations_enabled=True,
            mode="runtime",
        )
        static_bundles = requested_page_bundles(
            show_sidebar=True,
            current_path="docs/page",
            annotations_enabled=True,
            mode="static",
        )
    finally:
        set_extension_runtime(previous)

    assert "annotations.runtime" not in disabled_bundles
    assert "annotations.runtime" in runtime_bundles
    assert "annotations.runtime" in static_bundles
    assert "git_refs.runtime" in runtime_bundles
    assert "git_refs.runtime" not in static_bundles


def test_static_build_copies_extension_assets_and_references_requested_bundles(tmp_path):
    root = tmp_path / "site"
    root.mkdir()
    (root / "index.md").write_text(
        "# Home\n\n```mermaid\ngraph TD\nA-->B\n```\n\n```tasks\n- item\n```\n",
        encoding="utf-8",
    )
    output = tmp_path / "dist"

    build_static_site(input_dir=root, output_dir=output)

    html = (output / "index.html").read_text(encoding="utf-8")
    assert "/static/extensions/default_search/search.js" in html
    assert "/static/extensions/bookmarks/bookmarks.js" in html
    assert "/static/extensions/mermaid/mermaid.js" in html
    assert "/static/extensions/tasks/tasks.js" in html
    assert "/static/extensions/annotations/annotations.css" in html
    assert "/static/extensions/annotations/annotations.js" in html
    assert "/static/extensions/git_refs/git_refs.js" not in html
    assert (output / "static" / "extensions" / "blog_home" / "blog_home.css").exists()
    assert (output / "static" / "extensions" / "mermaid" / "mermaid.js").exists()
    assert (output / "static" / "extensions" / "tasks" / "tasks.js").exists()
    assert (output / "static" / "extensions" / "git_refs" / "git_refs.js").exists()
    assert (output / "static" / "extensions" / "link_preview" / "link_preview_stack.js").exists()
    assert (output / "static" / "extensions" / "link_preview" / "link_preview_geometry.js").exists()
