from pathlib import Path

from vyasa.config import reload_config
from vyasa.extensions import (
    CORE_CAPABILITIES,
    ActionRegistry,
    ExtensionConfigError,
    ExtensionMeta,
    ContentRootRequest,
    NavigationAction,
    build_extension_runtime,
    builtin_extension_catalog,
    get_extension_runtime,
    resolve_extension_plan,
    set_extension_runtime,
    set_runtime_context,
)
from vyasa.helpers import content_root_and_relative
from vyasa.extensions_builtin.debug_perf import finish_trace, start_trace
from vyasa.runtime_context import trace_span
from vyasa.assets import bundle_asset_nodes_for_collector, extension_asset_path
from vyasa.extensions_builtin.markdown.pipeline import RenderPipeline


def test_extensions_default_preset_when_section_omitted(tmp_path, monkeypatch):
    root = tmp_path / "site"
    root.mkdir()
    monkeypatch.chdir(root)
    reload_config()

    plan = resolve_extension_plan({})

    assert plan.preset == "default"
    assert plan.selected_by_category["layout"] == ("default_layout",)
    assert plan.selected_by_category["render"] == ("wikilinks", "tabs", "mermaid", "d2", "cytograph", "cryptograph", "tasks")
    assert plan.selected_by_category["route"] == ("slides", "auth_routes", "sidebar_routes", "annotations", "bookmarks", "rbac_admin", "filesystem_routes")
    assert plan.enabled_ids[-1] == "filesystem"


def test_extensions_minimal_preset_keeps_only_minimal_surface():
    plan = resolve_extension_plan({"preset": "minimal"})

    assert plan.selected_by_category["layout"] == ("default_layout",)
    assert plan.selected_by_category["theme"] == ("default_theme",)
    assert plan.selected_by_category["errors"] == ("default_errors",)
    assert plan.selected_by_category["content_source"] == ("filesystem",)
    assert plan.selected_by_category["search"] == ()
    assert plan.selected_by_category["home"] == ()
    assert plan.selected_by_category["render"] == ()
    assert plan.selected_by_category["route"] == ()


def test_extensions_minimal_preset_boots_cleanly():
    runtime = build_extension_runtime({"preset": "minimal"})

    assert runtime.enabled("default_layout")
    assert runtime.enabled("filesystem")
    assert not runtime.enabled("default_search")
    assert runtime.route_handlers == []


def test_extension_cannot_register_undeclared_route_prefix(tmp_path):
    package = tmp_path / "bad_ext"
    package.mkdir()
    (package / "__init__.py").write_text(
        "from vyasa.extensions import ExtensionMeta, VyasaExtensionBase\n"
        "class Bad(VyasaExtensionBase):\n"
        "    def register(self, app): app.routes.add('/undeclared', lambda rt, runtime: None)\n"
        "EXTENSION = Bad(ExtensionMeta('bad_route', 'route', ('cap:route:bad',), route_prefixes=('/bad',)))\n"
    )

    try:
        build_extension_runtime({
            "external": [{"path": str(tmp_path), "module": "bad_ext"}],
            "routes_add": ["bad_route"],
        })
    except ExtensionConfigError as exc:
        assert "undeclared route prefix" in str(exc)
    else:
        raise AssertionError("expected route guard validation failure")


def test_extensions_duplicate_slot_provider_is_rejected():
    catalog = builtin_extension_catalog()
    catalog["alt_errors"] = ExtensionMeta("alt_errors", "errors", ("slot:layout",))

    try:
        resolve_extension_plan({"errors": "alt_errors", "preset": "default"}, catalog=catalog)
    except ExtensionConfigError as exc:
        assert "Duplicate slot provider" in str(exc)
    else:
        raise AssertionError("expected duplicate slot validation failure")


def test_extensions_duplicate_capability_is_rejected():
    catalog = builtin_extension_catalog()
    catalog["alt_tasks"] = ExtensionMeta(
        "alt_tasks",
        "render",
        ("cap:markdown:fence:tasks",),
        requires=("cap:markdown_pipeline",),
    )

    try:
        resolve_extension_plan({"render": ["tasks", "alt_tasks"]}, catalog=catalog)
    except ExtensionConfigError as exc:
        assert "Duplicate capability provider" in str(exc)
    else:
        raise AssertionError("expected duplicate capability validation failure")


def test_extensions_missing_requirement_is_rejected():
    catalog = builtin_extension_catalog()

    try:
        resolve_extension_plan(
            {"preset": "minimal", "render": ["tasks"]},
            catalog=catalog,
            available_core_capabilities=set(),
        )
    except ExtensionConfigError as exc:
        assert "missing required capabilities" in str(exc)
        assert "cap:markdown_pipeline" in str(exc)
    else:
        raise AssertionError("expected missing requirement validation failure")


def test_extensions_route_prefix_conflict_is_rejected():
    catalog = builtin_extension_catalog()
    catalog["alt_slides"] = ExtensionMeta(
        "alt_slides",
        "route",
        ("cap:route:slides_alt",),
        requires=("slot:layout",),
        route_prefixes=("/slides",),
    )

    try:
        resolve_extension_plan({"routes": ["slides", "alt_slides"]}, catalog=catalog)
    except ExtensionConfigError as exc:
        assert "Route prefix conflict" in str(exc)
    else:
        raise AssertionError("expected route prefix validation failure")


def test_config_resolve_extensions_reads_extensions_section(tmp_path, monkeypatch):
    root = tmp_path / "site"
    root.mkdir()
    (root / ".vyasa").write_text("[extensions]\npreset = \"minimal\"\n", encoding="utf-8")
    monkeypatch.chdir(root)
    config = reload_config(root / ".vyasa")

    plan = config.resolve_extensions()

    assert plan.preset == "minimal"
    assert set(CORE_CAPABILITIES) == {"cap:markdown_pipeline"}


def test_route_extensions_register_declared_routes_and_storage():
    runtime = build_extension_runtime({})

    prefixes = {entry["prefix"] for entry in runtime.route_handlers}
    assert "/slides" in prefixes
    assert "/api/annotations" in prefixes
    assert "/api/bookmarks" in prefixes
    assert "annotations" in runtime.storage_namespaces
    assert "bookmarks" in runtime.storage_namespaces


def test_bookmarks_register_row_action_intent_not_html_decorator():
    runtime = build_extension_runtime({})

    assert len(runtime.sidebar_row_actions) == 1
    action = runtime.sidebar_row_actions[0](slug="guide", title="Guide", context="tree")

    assert action.id == "bookmarks.toggle"
    assert action.attrs["data_bookmark_path"] == "guide"
    assert runtime.sidebar_row_decorators == []


def test_action_registry_collects_visible_actions():
    registry = ActionRegistry([
        lambda **kwargs: None,
        lambda **kwargs: NavigationAction("open", "Open", icon_text="O"),
    ])

    actions = registry.actions_for(slug="guide", title="Guide", context="tree")

    assert [action.id for action in actions] == ["open"]


def test_debug_perf_extension_records_trace_spans():
    runtime = build_extension_runtime({"routes_add": ["debug_perf"]})
    previous = get_extension_runtime()
    set_extension_runtime(runtime)
    token = start_trace()
    try:
        with trace_span("markdown"):
            pass
        events = finish_trace(token)
    finally:
        set_extension_runtime(previous)

    assert [event.name for event in events] == ["markdown"]


def test_runtime_context_is_attached_to_extension_runtime():
    runtime = build_extension_runtime({})
    previous = get_extension_runtime()
    set_extension_runtime(runtime)
    context = object()
    try:
        set_runtime_context(context)
        assert runtime.context is context
    finally:
        set_extension_runtime(previous)


def test_collector_asset_nodes_emit_each_bundle_once():
    runtime = build_extension_runtime({})
    collector = runtime.new_asset_collector()
    collector.request("tasks.runtime")
    collector.request("tasks.runtime")

    html = "".join(str(node) for node in bundle_asset_nodes_for_collector(collector, runtime=runtime))

    assert html.count("tasks.js") == 1
    assert html.count("tasks.css") == 1


def test_render_pipeline_owns_processor_ordering():
    calls = []
    pipeline = RenderPipeline(
        [lambda content, context, state: calls.append("pre") or content + " pre"],
        [lambda html, context, state, render: calls.append("post") or html + " post"],
    )

    content = pipeline.preprocess("body", None, {})
    html = pipeline.postprocess(content, None, {}, lambda body: body)

    assert html == "body pre post"
    assert calls == ["pre", "post"]


def test_content_root_resolver_receives_snapshot_request(tmp_path, monkeypatch):
    root = tmp_path / "site"
    extra = tmp_path / "docsroot"
    snapshot = tmp_path / "snapshot"
    root.mkdir()
    extra.mkdir()
    snapshot.mkdir()
    (root / ".vyasa").write_text('vyasa_roots = ["../docsroot"]\n', encoding="utf-8")
    monkeypatch.chdir(root)
    reload_config(root / ".vyasa")
    runtime = build_extension_runtime({})
    seen = []
    previous = get_extension_runtime()
    runtime.content_root_resolvers.append(lambda request: seen.append(request) or snapshot)
    set_extension_runtime(runtime)
    try:
        resolved, relative = content_root_and_relative("docsroot@b64:bWFpbg==/guide/page")
    finally:
        set_extension_runtime(previous)
        reload_config()

    assert resolved == snapshot
    assert relative.as_posix() == "guide/page"
    assert seen == [ContentRootRequest("docsroot", "b64:bWFpbg==", Path("guide/page"))]


def test_external_extension_can_be_added_without_replacing_default_routes(tmp_path):
    package = tmp_path / "sample_ext"
    package.mkdir()
    (package / "__init__.py").write_text(
        "from vyasa.extensions import ExtensionMeta, VyasaExtensionBase\n"
        "class Sample(VyasaExtensionBase):\n"
        "    def register(self, app): app.routes.add('/sample', lambda rt, runtime: None)\n"
        "EXTENSION = Sample(ExtensionMeta('sample_route', 'route', "
        "('cap:route:sample_route',), route_prefixes=('/sample',)))\n"
    )

    runtime = build_extension_runtime({
        "external": [{"path": str(tmp_path), "module": "sample_ext"}],
        "routes_add": ["sample_route"],
    })

    prefixes = {entry["prefix"] for entry in runtime.route_handlers}
    assert "sample_route" in runtime.plan.enabled_ids
    assert "filesystem_routes" in runtime.plan.enabled_ids
    assert "/sample" in prefixes


def test_external_extension_assets_are_served_by_manifest(tmp_path):
    package = tmp_path / "asset_ext"
    static = package / "static"
    static.mkdir(parents=True)
    (static / "asset.js").write_text("export {};\n", encoding="utf-8")
    (package / "__init__.py").write_text(
        "from pathlib import Path\n"
        "from vyasa.extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase\n"
        "ROOT = Path(__file__).resolve().parent\n"
        "class AssetExt(VyasaExtensionBase):\n"
        "    def register(self, app): app.assets.bundle(AssetBundle('asset_ext.runtime', js=('/static/extensions/asset_ext/asset.js',), static_dir=ROOT / 'static'))\n"
        "EXTENSION = AssetExt(ExtensionMeta('asset_ext', 'route', "
        "('cap:route:asset_ext', 'bundle:asset_ext.runtime'), asset_bundles=('asset_ext.runtime',)))\n"
    )

    runtime = build_extension_runtime({
        "external": [{"path": str(tmp_path), "module": "asset_ext"}],
        "routes_add": ["asset_ext"],
    })
    previous = get_extension_runtime()
    set_extension_runtime(runtime)
    try:
        path = extension_asset_path("asset_ext", "asset.js")
    finally:
        set_extension_runtime(previous)

    assert path == static / "asset.js"
    assert runtime.bundles["asset_ext.runtime"].js == ("/static/extensions/asset_ext/asset.js",)


def test_external_extension_rejects_missing_module_name():
    try:
        build_extension_runtime({"external": {"path": "/tmp"}})
    except ExtensionConfigError as exc:
        assert "requires a module name" in str(exc)
    else:
        raise AssertionError("expected missing module validation failure")
