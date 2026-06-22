from pathlib import Path

from fasthtml.common import to_xml

from vyasa.config import reload_config
from vyasa.extensions import (
    CORE_CAPABILITIES,
    ActionRegistry,
    DocumentType,
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
from vyasa.extensions_builtin.markdown.renderer import from_md
from vyasa.extensions_builtin.filesystem import filesystem_mounts
from vyasa.extensions_builtin.default_search import (
    find_default_search_matches,
    find_default_search_preview_matches,
)
from vyasa.extensions_builtin.link_preview.routes import _current_path_from_request, render_link_preview_html
from vyasa.helpers import get_content_mounts
from vyasa import core
from vyasa.api_catalog import namespace_catalog, publish_api


def test_publish_api_derives_signature_route_and_docstring_contract():
    routes = []

    def rt(path, **kwargs):
        routes.append((path, tuple(kwargs.get("methods", ()))))
        return lambda fn: fn

    @publish_api(
        rt,
        namespace="contract_test",
        operation_id="contract_test.read",
        path="/api/things/{thing_id}",
        methods=("GET",),
    )
    def read_thing(thing_id: str, request):
        """Read one thing using its current contract."""

    operation = namespace_catalog("contract_test")["operations"][0]
    assert operation["signature"] == "read_thing(thing_id: str, request)"
    assert operation["description"] == "Read one thing using its current contract."
    assert routes == [("/api/things/{thing_id}", ("GET",))]


def test_extensions_default_preset_when_section_omitted(tmp_path, monkeypatch):
    root = tmp_path / "site"
    root.mkdir()
    monkeypatch.chdir(root)
    reload_config()

    plan = resolve_extension_plan({})

    assert plan.preset == "default"
    assert plan.selected_by_category["layout"] == ("default_layout",)
    assert plan.selected_by_category["render"] == ("wikilinks", "link_preview", "tabs", "mermaid", "d2", "cytograph", "cryptograph", "tasks", "mdx", "html_viewer", "pdf_viewer", "tree_table", "document_actions", "table_of_contents", "scoped_custom_css", "code_tools", "default_favicon")
    assert plan.selected_by_category["route"] == ("slides", "auth_rbac", "sidebar_routes", "annotations", "bookmarks", "api_catalog", "filesystem_routes")
    assert "annotations" in plan.enabled_ids
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


def test_extension_cannot_register_undeclared_document_type(tmp_path):
    package = tmp_path / "bad_doc_ext"
    package.mkdir()
    (package / "__init__.py").write_text(
        "from vyasa.extensions import DocumentType, ExtensionMeta, VyasaExtensionBase\n"
        "class Bad(VyasaExtensionBase):\n"
        "    def register(self, app): app.documents.document_type(DocumentType('.bad', 'bad', 'file'))\n"
        "EXTENSION = Bad(ExtensionMeta('bad_doc', 'render', ('cap:other',)))\n"
    )

    try:
        build_extension_runtime({
            "external": [{"path": str(tmp_path), "module": "bad_doc_ext"}],
            "render_add": ["bad_doc"],
        })
    except ExtensionConfigError as exc:
        assert "undeclared capability cap:document_type:bad" in str(exc)
    else:
        raise AssertionError("expected document type guard validation failure")


def test_document_extensions_register_document_type_renderers():
    runtime = build_extension_runtime({})

    assert runtime.document_types[".kg"] == DocumentType(".kg", "kg", "network")
    assert ".mdx" not in runtime.document_types
    assert runtime.document_types[".pdf"] == DocumentType(".pdf", "pdf", "file")
    assert runtime.document_types[".tree"] == DocumentType(".tree", "tree", "table")
    assert "kg" in runtime.document_renderers
    assert "mdx" in runtime.document_renderers
    assert "pdf" in runtime.document_renderers
    assert "tree" in runtime.document_renderers
    assert "kg" in runtime.static_document_renderers
    assert "mdx" in runtime.static_document_renderers
    assert "pdf" in runtime.static_document_renderers
    assert "tree" in runtime.static_document_renderers


def test_filesystem_routes_register_static_build_provider():
    runtime = build_extension_runtime({})

    assert len(runtime.static_build_providers) == 1


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


def test_default_route_extensions_include_annotations():
    runtime = build_extension_runtime({})

    prefixes = {entry["prefix"] for entry in runtime.route_handlers}
    assert "/slides" in prefixes
    assert "/api/tasks" in prefixes
    assert "/api/bookmarks" in prefixes
    assert "/api/catalog" in prefixes
    assert "/api/annotations" in prefixes
    assert "annotations" in runtime.storage_namespaces
    assert "bookmarks" in runtime.storage_namespaces


def test_annotations_are_enabled_by_default_and_can_be_disabled(tmp_path):
    try:
        config = reload_config(tmp_path / ".vyasa")
        assert config.get_annotations_enabled() is True

        (tmp_path / ".vyasa").write_text("[annotations]\nenabled = false\n", encoding="utf-8")
        config = reload_config(tmp_path / ".vyasa")
        assert config.get_annotations_enabled() is False
    finally:
        reload_config()


def test_bookmarks_register_row_action_intent_not_html_decorator():
    runtime = build_extension_runtime({})

    assert len(runtime.sidebar_row_actions) == 1
    action = runtime.sidebar_row_actions[0](slug="guide", title="Guide", context="tree")

    assert action.id == "bookmarks.toggle"
    assert action.attrs["data_bookmark_path"] == "guide"
    assert runtime.sidebar_row_decorators == []


def test_default_builtin_extensions_register_document_layout_providers():
    runtime = build_extension_runtime({})

    assert len(runtime.document_action_providers) >= 4
    assert len(runtime.toc_panel_providers) == 1
    assert len(runtime.scoped_css_providers) == 1
    assert runtime.favicon_href_provider is not None


def test_code_tools_bundle_is_requested_only_when_code_renders():
    runtime = build_extension_runtime({})
    previous = get_extension_runtime()
    set_extension_runtime(runtime)
    collector = runtime.new_asset_collector()
    try:
        from_md("```python\nprint('hi')\n```", current_path="guide", asset_collector=collector, emit_bundle_nodes=False)
    finally:
        set_extension_runtime(previous)

    assert "code_tools.runtime" in collector.requested


def test_internal_links_request_preview_bundle_and_keep_current_path():
    runtime = build_extension_runtime({})
    previous = get_extension_runtime()
    set_extension_runtime(runtime)
    collector = runtime.new_asset_collector()
    try:
        html = from_md("[Keep me](#keep-me)", current_path="docs/page", asset_collector=collector, emit_bundle_nodes=False)
    finally:
        set_extension_runtime(previous)

    rendered = to_xml(html)
    assert 'data-vyasa-link-preview="true"' in rendered
    assert 'data-vyasa-link-preview-current-path="docs/page"' in rendered
    assert "link_preview.runtime" in collector.requested


def test_link_preview_renders_one_section(tmp_path, monkeypatch):
    root = tmp_path / "site"
    root.mkdir()
    (root / "doc.md").write_text("# Top\n\n## Keep Me\n\nalpha\n\n## Skip Me\n\nbeta\n", encoding="utf-8")
    monkeypatch.setenv("VYASA_ROOT", str(root))
    reload_config()

    try:
        html = render_link_preview_html(href="#keep-me", current_path="doc")
        assert html is not None
        assert "Keep Me" in html
        assert "alpha" in html
        assert "Skip Me" not in html
        assert "beta" not in html
    finally:
        reload_config()


def test_link_preview_resolves_folder_note_routes(tmp_path, monkeypatch):
    root = tmp_path / "site"
    docs = root / "docs"
    docs.mkdir(parents=True)
    (docs / "index.md").write_text("# Docs\n\n## Entry Point\n\ninside\n", encoding="utf-8")
    monkeypatch.setenv("VYASA_ROOT", str(root))
    reload_config()

    try:
        html = render_link_preview_html(href="/posts/docs#entry-point", current_path="page")
        assert html is not None
        assert "Entry Point" in html
        assert "inside" in html
    finally:
        reload_config()


def test_link_preview_can_derive_current_path_from_referer():
    class Request:
        headers = {"referer": "http://localhost:8000/posts/demo/wikilinks-lab#entry-point"}

    assert _current_path_from_request(Request()) == "demo/wikilinks-lab"


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


def test_disabled_pdf_viewer_removes_pdf_from_default_search(monkeypatch):
    seen = {}
    runtime = build_extension_runtime(
        {
            "preset": "default",
            "render": [
                "wikilinks",
                "link_preview",
                "tabs",
                "mermaid",
                "d2",
                "cytograph",
                "cryptograph",
                "tasks",
                "tree_table",
                "document_actions",
                "table_of_contents",
                "scoped_custom_css",
                "code_tools",
                "default_favicon",
            ],
        }
    )
    previous = get_extension_runtime()
    set_extension_runtime(runtime)
    monkeypatch.setattr(
        "vyasa.extensions_builtin.default_search.search_file_records",
        lambda query, mounts, suffixes, show_hidden, limit: seen.setdefault("suffixes", suffixes),
    )
    try:
        assert find_default_search_matches("guide", limit=10) == (".md",)
    finally:
        set_extension_runtime(previous)
    assert seen["suffixes"] == (".md",)


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


def test_filesystem_extension_resolves_plain_content_roots(tmp_path, monkeypatch):
    root = tmp_path / "site"
    extra = tmp_path / "docsroot"
    root.mkdir()
    extra.mkdir()
    (root / ".vyasa").write_text('vyasa_roots = ["../docsroot"]\n', encoding="utf-8")
    monkeypatch.chdir(root)
    reload_config(root / ".vyasa")
    runtime = build_extension_runtime({})
    previous = get_extension_runtime()
    set_extension_runtime(runtime)
    try:
        primary_root, primary_rel = content_root_and_relative("guide/page")
        extra_root, extra_rel = content_root_and_relative("docsroot/guide/page")
    finally:
        set_extension_runtime(previous)
        reload_config()

    assert primary_root == root
    assert primary_rel == Path("guide/page")
    assert extra_root == extra
    assert extra_rel == Path("guide/page")


def test_filesystem_extension_owns_mount_discovery(tmp_path, monkeypatch):
    root = tmp_path / "site"
    extra = tmp_path / "docsroot"
    root.mkdir()
    extra.mkdir()
    (root / ".vyasa").write_text('vyasa_roots = ["../docsroot"]\n', encoding="utf-8")
    monkeypatch.chdir(root)
    reload_config(root / ".vyasa")
    runtime = build_extension_runtime({})
    previous = get_extension_runtime()
    set_extension_runtime(runtime)
    try:
        assert runtime.content_mount_providers == [filesystem_mounts]
        mounts = get_content_mounts()
    finally:
        set_extension_runtime(previous)
        reload_config()

    assert mounts == [("", root.resolve()), ("docsroot", extra.resolve())]


def test_default_search_extension_registers_search_providers():
    runtime = build_extension_runtime({})

    assert runtime.search_match_finder is find_default_search_matches
    assert runtime.search_preview_match_finder is find_default_search_preview_matches


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


def test_builtin_extensions_do_not_import_core_module():
    root = Path(core.__file__).resolve().parent / "extensions_builtin"
    offenders = []
    for path in sorted(root.rglob("*.py")):
        text = path.read_text(encoding="utf-8")
        if " import core" in text:
            offenders.append(str(path.relative_to(root)))
    assert offenders == []
