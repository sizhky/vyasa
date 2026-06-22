from vyasa.assets import bundle_asset_nodes, requested_page_bundles, route_bundle_names
from vyasa.build import build_static_site
from vyasa.extensions import AssetBundle, ExtensionPlan, ExtensionRuntime, build_extension_runtime, get_extension_runtime, set_extension_runtime


def test_route_bundle_names_select_route_bundles():
    assert route_bundle_names(show_sidebar=True) == (
        "default_search.runtime",
        "bookmarks.runtime",
    )
    assert route_bundle_names(
        show_sidebar=True,
        current_path="docs/page",
        annotations_enabled=True,
    ) == (
        "default_search.runtime",
        "bookmarks.runtime",
        "annotations.runtime",
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
    assert (output / "static" / "extensions" / "blog_home" / "blog_home.css").exists()
    assert (output / "static" / "extensions" / "mermaid" / "mermaid.js").exists()
    assert (output / "static" / "extensions" / "tasks" / "tasks.js").exists()
