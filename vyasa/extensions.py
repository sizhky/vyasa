from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
import importlib
import sys
from pathlib import Path
from typing import Callable, Literal, Protocol
from .runtime_context import traced

ExtensionCategory = Literal[
    "layout",
    "theme",
    "render",
    "route",
    "content_source",
    "search",
    "home",
    "errors",
]

PresetName = Literal["default", "minimal"]

CORE_CAPABILITIES = frozenset({
    "cap:markdown_pipeline",
})

SINGULAR_CATEGORIES: dict[ExtensionCategory, str] = {
    "layout": "layout",
    "theme": "theme",
    "search": "search",
    "home": "home",
    "errors": "errors",
}

PLURAL_CATEGORIES: dict[ExtensionCategory, str] = {
    "render": "render",
    "route": "routes",
    "content_source": "content_sources",
}


@dataclass(frozen=True)
class ExtensionMeta:
    id: str
    category: ExtensionCategory
    provides: tuple[str, ...]
    requires: tuple[str, ...] = ()
    route_prefixes: tuple[str, ...] = ()
    scope_disable: bool = False
    version: str = "0.1.0"
    description: str = ""
    config_model: object | None = None
    asset_bundles: tuple[str, ...] = ()
    storage_namespaces: tuple[str, ...] = ()
    scoped_config: bool = False
    order_constraints: tuple[str, ...] = ()


@dataclass(frozen=True)
class ExtensionPlan:
    preset: str
    selected_by_category: dict[ExtensionCategory, tuple[str, ...]]
    enabled_ids: tuple[str, ...]


class ExtensionConfigError(ValueError):
    pass


@dataclass(frozen=True)
class AssetBundle:
    name: str
    css: tuple[str, ...] = ()
    js: tuple[str, ...] = ()
    static_dir: Path | None = None


@dataclass
class AssetCollector:
    bundles: dict[str, AssetBundle]
    requested: list[str] = field(default_factory=list)

    def request(self, bundle_name: str) -> None:
        if bundle_name in self.bundles and bundle_name not in self.requested:
            self.requested.append(bundle_name)


@dataclass(frozen=True)
class NavigationAction:
    id: str
    label: str
    attrs: dict[str, object] = field(default_factory=dict)
    icon_text: str | None = None
    row_attrs: dict[str, object] = field(default_factory=dict)
    state_text: str | None = None
    state_attrs: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class DocumentType:
    suffix: str
    kind: str
    icon: str


@dataclass
class ActionRegistry:
    providers: list[Callable] = field(default_factory=list)

    def actions_for(self, *, slug=None, title: str = "", context: str = "tree") -> list[NavigationAction]:
        return [
            action
            for provider in self.providers
            if (action := provider(slug=slug, title=title, context=context))
        ]


@dataclass(frozen=True)
class ContentRootRequest:
    root_id: str
    ref: str
    relative_path: Path = field(default_factory=Path)


@dataclass
class ExtensionRuntime:
    plan: ExtensionPlan
    catalog: dict[str, ExtensionMeta]
    markdown_preprocessors: list[Callable] = field(default_factory=list)
    markdown_postprocessors: list[Callable] = field(default_factory=list)
    markdown_fences: dict[str, Callable] = field(default_factory=dict)
    bundles: dict[str, AssetBundle] = field(default_factory=dict)
    page_asset_providers: list[Callable] = field(default_factory=list)
    extension_static_dirs: dict[str, Path] = field(default_factory=dict)
    layout_renderer: Callable | None = None
    home_renderer: Callable | None = None
    home_feed_renderer: Callable | None = None
    error_renderer: Callable | None = None
    slide_renderer: Callable | None = None
    context: object | None = None
    route_handlers: list[dict] = field(default_factory=list)
    static_build_providers: list[Callable] = field(default_factory=list)
    config_defaults: dict[str, object] = field(default_factory=dict)
    startup_hooks: list[Callable] = field(default_factory=list)
    shutdown_hooks: list[Callable] = field(default_factory=list)
    storage_namespaces: dict[str, Path | None] = field(default_factory=dict)
    sidebar_section_providers: list[Callable] = field(default_factory=list)
    sidebar_row_decorators: list[Callable] = field(default_factory=list)
    search_result_row_decorators: list[Callable] = field(default_factory=list)
    sidebar_row_actions: list[Callable] = field(default_factory=list)
    search_result_row_actions: list[Callable] = field(default_factory=list)
    document_action_providers: list[Callable] = field(default_factory=list)
    content_mount_providers: list[Callable] = field(default_factory=list)
    content_root_resolvers: list[Callable] = field(default_factory=list)
    trace_handlers: list[Callable] = field(default_factory=list)
    toc_panel_providers: list[Callable] = field(default_factory=list)
    scoped_css_providers: list[Callable] = field(default_factory=list)
    shell_main_attr_providers: list[Callable] = field(default_factory=list)
    shell_body_fragment_providers: list[Callable] = field(default_factory=list)
    shell_footer_link_providers: list[Callable] = field(default_factory=list)
    navbar_mobile_action_providers: list[Callable] = field(default_factory=list)
    favicon_href_provider: Callable | None = None
    search_match_finder: Callable | None = None
    search_preview_match_finder: Callable | None = None
    search_preview_page_renderer: Callable | None = None
    document_types: dict[str, DocumentType] = field(default_factory=dict)
    document_renderers: dict[str, Callable] = field(default_factory=dict)
    static_document_renderers: dict[str, Callable] = field(default_factory=dict)

    def new_asset_collector(self) -> AssetCollector:
        return AssetCollector(self.bundles)

    def sidebar_action_registry(self) -> ActionRegistry:
        return ActionRegistry(self.sidebar_row_actions)

    def search_result_action_registry(self) -> ActionRegistry:
        return ActionRegistry(self.search_result_row_actions)

    def register_bundle(self, extension_id: str, bundle: AssetBundle) -> None:
        self.bundles[bundle.name] = bundle
        if bundle.static_dir is not None:
            self.extension_static_dirs[extension_id] = bundle.static_dir

    def enabled(self, extension_id: str) -> bool:
        return extension_id in self.plan.enabled_ids


class VyasaExtension(Protocol):
    meta: ExtensionMeta

    def register(self, app: "VyasaExtensionApp") -> None: ...


@dataclass(frozen=True)
class RouteRegistration:
    prefix: str
    handler: Callable | None = None
    methods: tuple[str, ...] = ("GET",)


class VyasaExtensionBase:
    def __init__(self, meta: ExtensionMeta):
        self.meta = meta

    def register(self, app: "VyasaExtensionApp") -> None:
        return None


class _RegistrationGuard:
    def __init__(self, runtime: ExtensionRuntime, meta: ExtensionMeta):
        self.runtime = runtime
        self.meta = meta

    def require_capability(self, capability: str) -> None:
        if capability not in self.meta.provides:
            raise ExtensionConfigError(
                f"Extension {self.meta.id} attempted to register undeclared capability {capability}"
            )

    def require_route_prefix(self, prefix: str) -> None:
        if prefix not in self.meta.route_prefixes:
            raise ExtensionConfigError(
                f"Extension {self.meta.id} attempted to register undeclared route prefix {prefix}"
            )

    def require_bundle(self, bundle_name: str) -> None:
        capability = f"bundle:{bundle_name}"
        if capability not in self.meta.provides:
            raise ExtensionConfigError(
                f"Extension {self.meta.id} attempted to register undeclared asset bundle {bundle_name}"
            )

    def require_storage(self, namespace: str) -> None:
        if self.meta.storage_namespaces and namespace not in self.meta.storage_namespaces:
            raise ExtensionConfigError(
                f"Extension {self.meta.id} attempted to register undeclared storage namespace {namespace}"
            )


class _MarkdownRegistrar:
    def __init__(self, runtime: ExtensionRuntime, meta: ExtensionMeta, guard: _RegistrationGuard):
        self.runtime = runtime
        self.meta = meta
        self.guard = guard

    def fence(self, name: str, handler: Callable) -> None:
        self.guard.require_capability(f"cap:markdown:fence:{name}")
        self.runtime.markdown_fences[name] = handler

    def preprocessor(self, handler: Callable) -> None:
        self.runtime.markdown_preprocessors.append(handler)

    def postprocessor(self, handler: Callable) -> None:
        self.runtime.markdown_postprocessors.append(handler)


class _AssetRegistrar:
    def __init__(self, runtime: ExtensionRuntime, meta: ExtensionMeta, guard: _RegistrationGuard):
        self.runtime = runtime
        self.meta = meta
        self.guard = guard

    def bundle(self, bundle: AssetBundle) -> None:
        self.guard.require_bundle(bundle.name)
        self.runtime.register_bundle(self.meta.id, bundle)

    def page(self, provider: Callable) -> None:
        self.runtime.page_asset_providers.append(provider)


class _LayoutRegistrar:
    _SLOT_TO_ATTR = {
        "layout": "layout_renderer",
        "home": "home_renderer",
        "home_feed": "home_feed_renderer",
        "error_pages": "error_renderer",
    }
    _MODE_TO_ATTR = {
        "slide": "slide_renderer",
    }

    def __init__(self, runtime: ExtensionRuntime, guard: _RegistrationGuard):
        self.runtime = runtime
        self.guard = guard

    def slot(self, name: str, provider: Callable) -> None:
        self.guard.require_capability(f"slot:{name}")
        attr = self._SLOT_TO_ATTR.get(name)
        if not attr:
            raise ExtensionConfigError(f"Unknown layout slot: {name}")
        setattr(self.runtime, attr, provider)

    def mode(self, name: str, provider: Callable) -> None:
        self.guard.require_capability(f"cap:layout:mode:{name}")
        attr = self._MODE_TO_ATTR.get(name)
        if not attr:
            raise ExtensionConfigError(f"Unknown layout mode: {name}")
        setattr(self.runtime, attr, provider)

    def toc(self, provider: Callable) -> None:
        self.guard.require_capability("cap:layout:toc")
        self.runtime.toc_panel_providers.append(provider)

    def scoped_css(self, provider: Callable) -> None:
        self.guard.require_capability("cap:layout:scoped_css")
        self.runtime.scoped_css_providers.append(provider)

    def favicon(self, provider: Callable) -> None:
        self.guard.require_capability("cap:asset:favicon")
        self.runtime.favicon_href_provider = provider

    def main_attrs(self, provider: Callable) -> None:
        self.guard.require_capability("cap:layout:main_attrs")
        self.runtime.shell_main_attr_providers.append(provider)

    def body_fragment(self, provider: Callable) -> None:
        self.guard.require_capability("cap:layout:body_fragment")
        self.runtime.shell_body_fragment_providers.append(provider)

    def footer_link(self, provider: Callable) -> None:
        self.guard.require_capability("cap:layout:footer_link")
        self.runtime.shell_footer_link_providers.append(provider)

    def navbar_mobile_action(self, provider: Callable) -> None:
        self.guard.require_capability("cap:layout:navbar_mobile_action")
        self.runtime.navbar_mobile_action_providers.append(provider)


class _RouteRegistrar:
    def __init__(self, runtime: ExtensionRuntime, guard: _RegistrationGuard):
        self.runtime = runtime
        self.guard = guard

    def add(self, prefix: str, handler: Callable | None = None, methods: tuple[str, ...] = ("GET",)) -> None:
        self.guard.require_route_prefix(prefix)
        self.runtime.route_handlers.append(
            {
                "prefix": prefix,
                "handler": handler,
                "methods": tuple(methods),
            }
        )

    def static_build(self, capability: str, provider: Callable) -> None:
        self.guard.require_capability(capability)
        self.runtime.static_build_providers.append(provider)


class _ConfigRegistrar:
    def __init__(self, runtime: ExtensionRuntime):
        self.runtime = runtime

    def defaults(self, **values: object) -> None:
        self.runtime.config_defaults.update(values)


class _LifecycleRegistrar:
    def __init__(self, runtime: ExtensionRuntime):
        self.runtime = runtime

    def startup(self, handler: Callable) -> None:
        self.runtime.startup_hooks.append(handler)

    def shutdown(self, handler: Callable) -> None:
        self.runtime.shutdown_hooks.append(handler)


class _StorageRegistrar:
    def __init__(self, runtime: ExtensionRuntime, guard: _RegistrationGuard):
        self.runtime = runtime
        self.guard = guard

    def namespace(self, name: str, root: Path | None = None) -> None:
        self.guard.require_storage(name)
        self.runtime.storage_namespaces[name] = root


class _NavigationRegistrar:
    def __init__(self, runtime: ExtensionRuntime):
        self.runtime = runtime

    def sidebar_section(self, provider: Callable) -> None:
        self.runtime.sidebar_section_providers.append(provider)

    def sidebar_row_decorator(self, provider: Callable) -> None:
        self.runtime.sidebar_row_decorators.append(provider)

    def search_result_row_decorator(self, provider: Callable) -> None:
        self.runtime.search_result_row_decorators.append(provider)

    def sidebar_row_action(self, provider: Callable) -> None:
        self.runtime.sidebar_row_actions.append(provider)

    def search_result_row_action(self, provider: Callable) -> None:
        self.runtime.search_result_row_actions.append(provider)


class _DocumentRegistrar:
    def __init__(self, runtime: ExtensionRuntime, meta: ExtensionMeta, guard: _RegistrationGuard):
        self.runtime = runtime
        self.meta = meta
        self.guard = guard

    def action(self, provider: Callable) -> None:
        self.runtime.document_action_providers.append(provider)

    def document_type(self, document_type: DocumentType) -> None:
        self.guard.require_capability(f"cap:document_type:{document_type.kind}")
        self.runtime.document_types[document_type.suffix] = document_type

    def renderer(self, kind: str, provider: Callable) -> None:
        self.guard.require_capability(f"cap:document_type:{kind}")
        self.runtime.document_renderers[kind] = provider

    def static_renderer(self, kind: str, provider: Callable) -> None:
        self.guard.require_capability(f"cap:document_type:{kind}")
        self.runtime.static_document_renderers[kind] = provider


class _ContentSourceRegistrar:
    def __init__(self, runtime: ExtensionRuntime):
        self.runtime = runtime

    def mount_provider(self, provider: Callable) -> None:
        self.runtime.content_mount_providers.append(provider)

    def root_resolver(self, provider: Callable) -> None:
        self.runtime.content_root_resolvers.append(provider)


class _SearchRegistrar:
    def __init__(self, runtime: ExtensionRuntime):
        self.runtime = runtime

    def match_finder(self, provider: Callable) -> None:
        self.runtime.search_match_finder = provider

    def preview_match_finder(self, provider: Callable) -> None:
        self.runtime.search_preview_match_finder = provider

    def preview_page(self, provider: Callable) -> None:
        self.runtime.search_preview_page_renderer = provider


class _TraceRegistrar:
    def __init__(self, runtime: ExtensionRuntime):
        self.runtime = runtime

    def handler(self, provider: Callable) -> None:
        self.runtime.trace_handlers.append(provider)


class VyasaExtensionApp:
    def __init__(self, runtime: ExtensionRuntime, extension: VyasaExtension):
        self.runtime = runtime
        self.context = runtime.context
        self.extension = extension
        self.meta = extension.meta
        guard = _RegistrationGuard(runtime, self.meta)
        self.markdown = _MarkdownRegistrar(runtime, self.meta, guard)
        self.assets = _AssetRegistrar(runtime, self.meta, guard)
        self.layout = _LayoutRegistrar(runtime, guard)
        self.routes = _RouteRegistrar(runtime, guard)
        self.config = _ConfigRegistrar(runtime)
        self.lifecycle = _LifecycleRegistrar(runtime)
        self.storage = _StorageRegistrar(runtime, guard)
        self.navigation = _NavigationRegistrar(runtime)
        self.documents = _DocumentRegistrar(runtime, self.meta, guard)
        self.content_source = _ContentSourceRegistrar(runtime)
        self.search = _SearchRegistrar(runtime)
        self.trace = _TraceRegistrar(runtime)


_ACTIVE_RUNTIME: ExtensionRuntime | None = None
_CURRENT_ASSET_COLLECTOR: ContextVar[AssetCollector | None] = ContextVar(
    "vyasa_extension_asset_collector",
    default=None,
)


def get_extension_runtime() -> ExtensionRuntime | None:
    return _ACTIVE_RUNTIME


def set_extension_runtime(runtime: ExtensionRuntime | None) -> ExtensionRuntime | None:
    global _ACTIVE_RUNTIME
    _ACTIVE_RUNTIME = runtime
    return runtime


def set_runtime_context(context: object | None) -> None:
    runtime = get_extension_runtime()
    if runtime is not None:
        runtime.context = context


def refresh_extension_runtime(config: dict | None) -> ExtensionRuntime:
    from .runtime_context import trace_span

    with trace_span("extension_plan"):
        runtime = build_extension_runtime(config)
    set_extension_runtime(runtime)
    return runtime


def current_asset_collector() -> AssetCollector | None:
    return _CURRENT_ASSET_COLLECTOR.get()


@contextmanager
def bind_asset_collector(collector: AssetCollector | None):
    token = _CURRENT_ASSET_COLLECTOR.set(collector)
    try:
        yield collector
    finally:
        _CURRENT_ASSET_COLLECTOR.reset(token)


def request_asset_bundle(bundle_name: str) -> None:
    collector = current_asset_collector()
    if collector is not None:
        collector.request(bundle_name)


def builtin_extension_catalog() -> dict[str, ExtensionMeta]:
    from .extensions_builtin import load_builtin_extensions

    return {extension.meta.id: extension.meta for extension in load_builtin_extensions()}


def load_configured_extensions(config: dict | None = None) -> tuple[VyasaExtension, ...]:
    from .extensions_builtin import load_builtin_extensions

    section = config if isinstance(config, dict) else {}
    return (*load_builtin_extensions(), *_load_external_extensions(section))


def _load_external_extensions(section: dict) -> tuple[VyasaExtension, ...]:
    loaded: list[VyasaExtension] = []
    for spec in _coerce_external_specs(section.get("external")):
        module_name = str(spec.get("module") or "").strip()
        path_text = str(spec.get("path") or "").strip()
        if path_text:
            path = Path(path_text).expanduser().resolve()
            if path.is_dir():
                if str(path) not in sys.path:
                    sys.path.insert(0, str(path))
            elif path.is_file():
                if str(path.parent) not in sys.path:
                    sys.path.insert(0, str(path.parent))
        if not module_name:
            raise ExtensionConfigError("External extension requires a module name")
        module = importlib.import_module(module_name)
        if hasattr(module, "load_extensions"):
            loaded.extend(module.load_extensions())
        elif hasattr(module, "EXTENSION"):
            loaded.append(module.EXTENSION)
        else:
            raise ExtensionConfigError(f"External extension module {module_name} has no EXTENSION")
    return tuple(loaded)


def _coerce_external_specs(value: object) -> list[dict]:
    if value is None:
        return []
    if isinstance(value, dict):
        return [value]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    raise ExtensionConfigError("extensions.external must be a table or array of tables")


def default_preset_selection() -> dict[ExtensionCategory, tuple[str, ...]]:
    return {
        "layout": ("default_layout",),
        "theme": ("default_theme",),
        "search": ("default_search",),
        "home": ("blog_home",),
        "errors": ("default_errors",),
        "render": ("wikilinks", "link_preview", "tabs", "mermaid", "d2", "cytograph", "cryptograph", "tasks", "pdf_viewer", "tree_table", "document_actions", "table_of_contents", "scoped_custom_css", "code_tools", "default_favicon"),
        "route": ("slides", "auth_rbac", "sidebar_routes", "annotations", "bookmarks", "filesystem_routes"),
        "content_source": ("filesystem",),
    }


def minimal_preset_selection() -> dict[ExtensionCategory, tuple[str, ...]]:
    return {
        "layout": ("default_layout",),
        "theme": ("default_theme",),
        "search": (),
        "home": (),
        "errors": ("default_errors",),
        "render": (),
        "route": (),
        "content_source": ("filesystem",),
    }


def resolve_extension_plan(
    config: dict | None,
    *,
    catalog: dict[str, ExtensionMeta] | None = None,
    available_core_capabilities: set[str] | frozenset[str] | None = None,
) -> ExtensionPlan:
    catalog = catalog or builtin_extension_catalog()
    core_capabilities = set(
        CORE_CAPABILITIES if available_core_capabilities is None else available_core_capabilities
    )
    section = config if isinstance(config, dict) else {}
    preset = str(section.get("preset") or "default").strip() or "default"
    selected = _preset_selection(preset)
    _apply_overrides(selected, section)
    enabled_ids = _ordered_enabled_ids(selected)
    _validate_extension_ids(enabled_ids, catalog, selected)
    _validate_contract(enabled_ids, catalog, core_capabilities)
    return ExtensionPlan(
        preset=preset,
        selected_by_category={category: tuple(ids) for category, ids in selected.items()},
        enabled_ids=enabled_ids,
    )


@traced("extension_plan")
def build_extension_runtime(
    config: dict | None,
    *,
    catalog: dict[str, ExtensionMeta] | None = None,
) -> ExtensionRuntime:
    configured_extensions = load_configured_extensions(config)
    catalog = catalog or {extension.meta.id: extension.meta for extension in configured_extensions}
    plan = resolve_extension_plan(config, catalog=catalog)
    runtime = ExtensionRuntime(plan=plan, catalog=catalog)
    _configure_extensions(runtime, configured_extensions)
    return runtime


def _configure_extensions(runtime: ExtensionRuntime, extensions: tuple[VyasaExtension, ...]) -> None:
    for extension in extensions:
        if runtime.enabled(extension.meta.id):
            extension.register(VyasaExtensionApp(runtime, extension))


def _preset_selection(preset: str) -> dict[ExtensionCategory, list[str]]:
    if preset == "default":
        base = default_preset_selection()
    elif preset == "minimal":
        base = minimal_preset_selection()
    else:
        raise ExtensionConfigError(f"Unknown extensions preset: {preset}")
    return {category: list(ids) for category, ids in base.items()}


def _apply_overrides(selected: dict[ExtensionCategory, list[str]], section: dict) -> None:
    for category, key in SINGULAR_CATEGORIES.items():
        if key not in section:
            continue
        raw = section.get(key)
        selected[category] = [str(raw).strip()] if str(raw).strip() else []
    for category, key in PLURAL_CATEGORIES.items():
        if key not in section:
            continue
        selected[category] = _coerce_list(section.get(key))
    for category, key in PLURAL_CATEGORIES.items():
        add_key = f"{key}_add"
        if add_key in section:
            selected[category].extend(_coerce_list(section.get(add_key)))


def _coerce_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, tuple):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value).strip()
    return [text] if text else []


def _ordered_enabled_ids(selected: dict[ExtensionCategory, list[str]]) -> tuple[str, ...]:
    ordered: list[str] = []
    for category in ("layout", "theme", "search", "home", "errors", "render", "route", "content_source"):
        ordered.extend(selected.get(category, []))
    return tuple(ordered)


def _validate_extension_ids(
    enabled_ids: tuple[str, ...],
    catalog: dict[str, ExtensionMeta],
    selected: dict[ExtensionCategory, list[str]],
) -> None:
    seen: set[str] = set()
    for extension_id in enabled_ids:
        if extension_id not in catalog:
            raise ExtensionConfigError(f"Unknown extension id: {extension_id}")
        if extension_id in seen:
            raise ExtensionConfigError(f"Extension selected more than once: {extension_id}")
        seen.add(extension_id)
    for category, ids in selected.items():
        for extension_id in ids:
            meta = catalog[extension_id]
            if meta.category != category:
                raise ExtensionConfigError(
                    f"Extension {extension_id} belongs to category {meta.category}, not {category}"
                )


def _validate_contract(
    enabled_ids: tuple[str, ...],
    catalog: dict[str, ExtensionMeta],
    core_capabilities: set[str],
) -> None:
    provided = set(core_capabilities)
    slot_owners: dict[str, str] = {}
    cap_owners: dict[str, str] = {}
    route_owners: dict[str, str] = {}
    for extension_id in enabled_ids:
        meta = catalog[extension_id]
        for capability in meta.provides:
            if capability.startswith("slot:"):
                owner = slot_owners.get(capability)
                if owner:
                    raise ExtensionConfigError(
                        f"Duplicate slot provider for {capability}: {owner} and {extension_id}"
                    )
                slot_owners[capability] = extension_id
            elif capability.startswith("cap:"):
                owner = cap_owners.get(capability)
                if owner:
                    raise ExtensionConfigError(
                        f"Duplicate capability provider for {capability}: {owner} and {extension_id}"
                    )
                cap_owners[capability] = extension_id
            provided.add(capability)
        for prefix in meta.route_prefixes:
            owner = route_owners.get(prefix)
            if owner:
                raise ExtensionConfigError(
                    f"Route prefix conflict for {prefix}: {owner} and {extension_id}"
                )
            route_owners[prefix] = extension_id
    for extension_id in enabled_ids:
        meta = catalog[extension_id]
        missing = [required for required in meta.requires if required not in provided]
        if missing:
            raise ExtensionConfigError(
                f"Extension {extension_id} is missing required capabilities: {', '.join(missing)}"
            )
