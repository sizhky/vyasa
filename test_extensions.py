from vyasa.config import reload_config
from vyasa.extensions import (
    CORE_CAPABILITIES,
    ExtensionConfigError,
    ExtensionMeta,
    build_extension_runtime,
    builtin_extension_catalog,
    resolve_extension_plan,
)


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
