import re
import json
import base64
import time
from datetime import datetime
from contextvars import ContextVar
from functools import lru_cache
from pathlib import Path
from fasthtml.common import *
from fasthtml.jupyter import *
from monsterui.all import *
from .config import get_config
from .helpers import (
    slug_to_title,
    _strip_inline_markdown,
    text_to_anchor,
    _unique_anchor,
    parse_frontmatter,
    resolve_markdown_title,
    _effective_abbreviations,
    get_vyasa_config,
    find_folder_note_file,
    content_path_for_slug,
    content_slug_for_path,
    content_url_for_slug,
    estimate_read_time_minutes,
    expand_markdown_includes_for_reading,
    get_content_mounts,
    document_kind_for_suffix,
    enabled_document_suffixes,
    iter_visible_files,
    preview_markdown,
    should_exclude_dir,
)
from .layout_helpers import (
    _resolve_layout_config,
    _width_class_and_style,
    _style_attr,
)
from .layout_page import render_page_frame
from .page_frame import PageFrame, PageFrameDeps
from .nav_views import TREE_ACTION_BUTTON_CLASSES, TREE_ACTION_ROW_BASE_CLASSES, navbar_view
from loguru import logger
from .assets import asset_url, bundle_asset_nodes, requested_page_bundles, route_bundle_names
from .admin_views import rbac_admin_content
from .auth.context import get_auth_from_request, get_roles_from_auth, get_roles_from_request
from .auth.admin_helpers import apply_impersonation_action, parse_rbac_form
from .auth.flow_helpers import (
    build_google_auth_payload,
    fetch_google_userinfo,
    google_account_allowed,
    parse_roles_text,
    start_google_login,
)
from .auth.runtime import make_user_auth_before
from .auth.views import impersonate_content, login_content
from .auth.http import handle_admin_impersonate, handle_admin_rbac, handle_login
from .auth.policy import is_allowed, resolve_roles
from .bootstrap import build_app, build_beforeware, mount_package_static
from .content_routes import (
    find_index_file as find_index_file_helper,
    render_index,
    render_post_detail,
)
from .content_tree import ContentTree
from .extensions import get_extension_runtime, refresh_extension_runtime, set_runtime_context
from .auth.oauth_bootstrap import build_google_oauth
from .page_views import not_found_content
from .rbac_config import normalize_rbac_cfg, render_rbac_toml, write_rbac_to_vyasa
from .rbac_store import load_rbac_cfg, write_rbac_cfg
from .runtime_context import RuntimeContext, traced
from .runtime_services import set_runtime_services
from .search_pages import gather_search_content
from .search_http import gather_search_page
from .search_views import (
    render_posts_search_results,
)
from .sidebar_helpers import (
    build_toc_items as build_sidebar_toc_items,
    collapsible_sidebar as build_collapsible_sidebar,
    extract_toc as extract_sidebar_toc,
    get_custom_css_links as get_sidebar_custom_css_links,
    sidebar_section,
)
from .extensions_builtin.markdown.renderer import from_md
from .tree_service import get_tree_entries
from .tree_rendering import (
    build_post_tree_render,
    folder_has_visible_descendant as tree_folder_has_visible_descendant,
)
from .favicon import favicon_href, favicon_svg
from .file_search import search_file_records
_asset_url = asset_url


# App configuration
def get_root_folder():
    return get_config().get_root_folder()


def get_blog_title():
    return get_config().get_blog_title()


def get_file_created_ts(path: Path) -> float:
    try:
        return path.stat().st_ctime
    except OSError:
        return 0.0


def iter_blog_home_files(roots=None, roles=None):
    from .extensions_builtin.blog_home import iter_home_files

    yield from iter_home_files(
        roots,
        roles,
        is_allowed_fn=is_allowed,
        rbac_rules=_rbac_rules,
        iter_files=iter_visible_files,
        slug_for_path=content_slug_for_path,
    )


def _default_render_blog_home(htmx, request: Request):
    from .extensions_builtin.blog_home import _home_provider

    return _home_provider(htmx, request)


def render_blog_home(htmx, request: Request):
    runtime = get_extension_runtime()
    provider = runtime.home_renderer if runtime else None
    if provider and provider is not _default_render_blog_home:
        return provider(htmx, request)
    return _default_render_blog_home(htmx, request)


def _render_blog_preview_card(path, slug, root):
    from .extensions_builtin.blog_home import render_card

    return render_card(path, slug, root, resolve_title=resolve_markdown_title, abbreviations=_effective_abbreviations)


def render_blog_home_feed(entries, root, offset=0, batch_size=4, wrap=True):
    from .extensions_builtin.blog_home import render_feed

    return render_feed(entries, root, offset, batch_size, wrap)


def render_search_preview_feed(entries, root):
    cards = []
    for path in entries:
        slug = content_slug_for_path(path)
        if not slug:
            continue
        cards.append(_render_blog_preview_card(path, slug, root))
    return Div(*cards, cls="space-y-4", id="search-preview-feed")


def render_search_preview_page(htmx, request: Request, q: str = ""):
    runtime = get_extension_runtime()
    provider = runtime.search_preview_page_renderer if runtime else None
    if provider and provider is not render_search_preview_page:
        return provider(htmx, request, q=q)
    roots = get_content_mounts()
    root = roots[0][1] if roots else get_root_folder()
    auth = request.scope.get("auth") if request else None
    roles = get_roles_from_auth(auth, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    previewable, regex_error = _find_search_preview_matches(q, limit=200)
    previewable = _filter_search_matches_by_roles(previewable, roles)
    query = (q or "").strip()
    if not query:
        shell = Div(H1("Search previews", cls="vyasa-page-title text-4xl font-bold"), P("Type a search term in the sidebar to preview matching pages.", cls="mt-2 text-slate-500"))
        return layout(shell, htmx=htmx, title=f"Search previews - {get_blog_title()}", show_sidebar=True, current_path="search-previews", auth=auth)
    if not previewable:
        shell = Div(
            H1(f"Search previews: {query}", cls="vyasa-page-title text-4xl font-bold"),
            (P(regex_error, cls="text-amber-600 dark:text-amber-400 text-sm") if regex_error else None),
            P("No previewable pages matched this search.", cls="mt-2 text-slate-500"),
        )
        return layout(shell, htmx=htmx, title=f"Search previews - {query} - {get_blog_title()}", show_sidebar=True, current_path="search-previews", auth=auth)
    feed = render_search_preview_feed(previewable, root)
    shell = Div(
        H1(f"Search previews: {query}", cls="vyasa-page-title text-4xl font-bold"),
        (P(regex_error, cls="text-amber-600 dark:text-amber-400 text-sm") if regex_error else None),
        P(f"{len(previewable)} page preview{'s' if len(previewable) != 1 else ''}", cls="mt-2 text-slate-500"),
        feed,
        cls="space-y-6",
    )
    return layout(shell, htmx=htmx, title=f"Search previews - {query} - {get_blog_title()}", show_sidebar=True, current_path="search-previews", auth=auth)


def search_preview_results_path(query_token: str = "", htmx=None, request: Request = None):
    token = (query_token or "").strip()
    if not token:
        return render_search_preview_page(htmx, request, q="")
    padding = "=" * (-len(token) % 4)
    try:
        query = base64.urlsafe_b64decode(f"{token}{padding}".encode("ascii")).decode("utf-8")
    except Exception:
        return Response(status_code=404)
    return render_search_preview_page(htmx, request, q=query)

def _sort_blog_home_entries(entries, root):
    from .extensions_builtin.blog_home import sort_entries

    return sort_entries(entries, root, get_sort=get_config().get_home_sort, created_ts=get_file_created_ts)

def _blog_home_is_ignored(path, root):
    from .extensions_builtin.blog_home import is_ignored

    return is_ignored(path, root)


def get_favicon_href():
    runtime = get_extension_runtime()
    provider = runtime.favicon_href_provider if runtime else None
    if provider:
        return provider(get_root_folder())
    return favicon_href(get_root_folder())


def _hljs_theme_href(theme_name: str) -> str:
    return f"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/{theme_name}.min.css"


hdrs = (
    Script(f"window.__VYASA_THEME_PRESETS__ = {json.dumps(get_config().get_theme_extension_payloads())};"),
    Script(f"window.__VYASA_THEME_EXTENSION_META__ = {json.dumps(get_config().get_theme_extension_meta())};"),
    Script(src=_asset_url("/static/head-init.js")),
    Style(
        """
        :root { --vyasa-paper: #f9f9f9; --vyasa-ink: #2d3434; --vyasa-paper-low: #f2f4f3; }
        html, body { background: var(--vyasa-paper) !important; color: var(--vyasa-ink) !important; }
        body.bg-background, body.text-foreground { background: var(--vyasa-paper) !important; color: var(--vyasa-ink) !important; }
        #page-container, #main-content, #posts-sidebar, #toc-sidebar, .vyasa-sidebar-toggle, .vyasa-sidebar-body {
            color: var(--vyasa-ink) !important;
        }
        .dark, .dark #page-container {
            --vyasa-paper: color-mix(in srgb, #0b0e0d 82%, #45655b 18%) !important;
            --vyasa-ink: #edf2f1 !important;
            --vyasa-paper-low: color-mix(in srgb, #121716 76%, #45655b 24%) !important;
        }
        @keyframes vyasaAnnotationBloom {
            0% { background: rgba(245, 158, 11, 0); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
            18% { background: rgba(245, 158, 11, 0.34); box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.38); }
            100% { background: rgba(245, 158, 11, 0); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        """
    ),
    *Theme.slate.headers(highlightjs=False),
    Script(src="https://cdn.jsdelivr.net/npm/uikit@3.16.14/dist/js/uikit.min.js"),
    Script(src="https://cdn.jsdelivr.net/npm/uikit@3.16.14/dist/js/uikit-icons.min.js"),
    Meta(name="vyasa-code-theme-light", content=get_config().get_code_theme_light()),
    Meta(name="vyasa-code-theme-dark", content=get_config().get_code_theme_dark()),
    Link(rel="icon", href=get_favicon_href()),
    Script(src="https://unpkg.com/hyperscript.org@0.9.12"),
    Script(src=_asset_url("/static/scripts.js"), type="module"),
    *([Script(
        """
        (() => {
            if (!("EventSource" in window) || window.__vyasaLiveReload) return;
            window.__vyasaLiveReload = true;
            const reload = () => window.location.reload();
            const source = new EventSource("/_vyasa/reload");
            source.addEventListener("reload", reload);
            source.onerror = () => setTimeout(() => fetch("/", { cache: "no-store" }).then(reload).catch(() => {}), 1000);
        })();
        """
    )] if get_config().get_browser_reload_enabled() else []),
    Link(rel="stylesheet", href=_asset_url("/static/header.css")),
    Link(rel="stylesheet", href=_asset_url("/static/kbd.css")),
    Style(
        """
        .vyasa-table-scroll { width: 100%; max-width: 100%; position: static; left: auto; transform: none; margin: 1.5rem 0; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-gutter: stable both-edges; box-shadow: none; transition: box-shadow 160ms ease; }
        .vyasa-table-scroll.vyasa-table-breakout { width: min(var(--vyasa-breakout-width, 80vw), 80vw); max-width: 80vw; position: relative; left: 50%; transform: translateX(-50%); }
        .vyasa-table-scroll.has-right-overflow { box-shadow: inset -18px 0 16px -14px rgba(15, 23, 42, 0.32); }
        .vyasa-table-scroll.has-left-overflow { box-shadow: inset 18px 0 16px -14px rgba(15, 23, 42, 0.32); }
        .vyasa-table-scroll.has-left-overflow.has-right-overflow { box-shadow: inset 18px 0 16px -14px rgba(15, 23, 42, 0.32), inset -18px 0 16px -14px rgba(15, 23, 42, 0.32); }
        .dark .vyasa-table-scroll.has-right-overflow { box-shadow: inset -18px 0 16px -14px rgba(2, 6, 23, 0.62); }
        .dark .vyasa-table-scroll.has-left-overflow { box-shadow: inset 18px 0 16px -14px rgba(2, 6, 23, 0.62); }
        .dark .vyasa-table-scroll.has-left-overflow.has-right-overflow { box-shadow: inset 18px 0 16px -14px rgba(2, 6, 23, 0.62), inset -18px 0 16px -14px rgba(2, 6, 23, 0.62); }
        .vyasa-table-scroll > table, .vyasa-table-scroll > .uk-table { width: max-content !important; min-width: 0; table-layout: auto; margin: 0 auto; }
        .vyasa-table-scroll th, .vyasa-table-scroll td { max-width: var(--vyasa-table-col-max, 45vw); white-space: normal; overflow-wrap: anywhere; word-break: normal; }
        .vyasa-mobile-scroll-progress { position: fixed; top: 0; left: 0; z-index: 1600; width: 5px; height: 0; pointer-events: none; background: var(--vyasa-primary, #2563eb); opacity: 0; transition: opacity 120ms ease; }
        @media (max-width: 1279px) { .vyasa-mobile-scroll-progress { opacity: 1; } }
        """
    ),
    Link(
        rel="stylesheet",
        href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css",
    ),
    Script(src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"),
    Script(
        src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
    ),
    Link(rel="preconnect", href="https://fonts.googleapis.com"),
    Link(rel="preconnect", href="https://fonts.gstatic.com", crossorigin=""),
    Link(
        rel="stylesheet",
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono&display=swap",
    ),
)


# Session/cookie-based authentication using Beforeware (conditionally enabled)
_config = get_config()
_extension_runtime = refresh_extension_runtime(_config.get_extensions_config())
_auth_creds = _config.get_auth()
_google_oauth_cfg = _config.get_google_oauth()
_auth_required = _config.get_auth_required()


_rbac_store_cache = {"db": None, "tbl": None}
def _normalize_rbac_cfg(cfg):
    return normalize_rbac_cfg(cfg, _config._coerce_list)


def _rbac_db_load():
    try:
        return load_rbac_cfg(get_config().get_root_folder(), _rbac_store_cache, _normalize_rbac_cfg)
    except Exception as exc:
        logger.warning(f"RBAC DB unavailable: {exc}")
        return None


def _rbac_db_write(cfg):
    try:
        write_rbac_cfg(get_config().get_root_folder(), _rbac_store_cache, cfg, _normalize_rbac_cfg)
    except Exception as exc:
        logger.warning(f"RBAC DB unavailable: {exc}")


def _load_rbac_cfg_from_store():
    cfg = _rbac_db_load()
    if cfg:
        return cfg
    cfg = _normalize_rbac_cfg(_config.get_rbac())
    return cfg


def _set_rbac_cfg(cfg):
    global _rbac_cfg, _rbac_rules
    _rbac_cfg = _normalize_rbac_cfg(cfg)
    if _rbac_cfg.get("enabled") and not _auth_enabled:
        logger.warning("RBAC configured without any auth provider; RBAC disabled.")
        _rbac_cfg["enabled"] = False
    _rbac_rules = []
    if _rbac_cfg.get("enabled"):
        for rule in _rbac_cfg.get("rules", []):
            pattern = rule.get("pattern")
            roles = rule.get("roles")
            if not pattern or not roles:
                continue
            try:
                compiled = re.compile(pattern)
            except re.error as exc:
                logger.warning(f"Invalid RBAC pattern {pattern!r}: {exc}")
                continue
            roles_list = _config._coerce_list(roles)
            if not roles_list:
                continue
            _rbac_rules.append((compiled, set(roles_list)))


def _render_rbac_toml(cfg):
    return render_rbac_toml(cfg, _config._coerce_list)


def _write_rbac_to_vyasa(cfg):
    write_rbac_to_vyasa(cfg, _config._coerce_list, get_config().get_root_folder())


_google_oauth, _google_oauth_enabled = build_google_oauth(_google_oauth_cfg, logger)

_local_auth_enabled = bool(_auth_creds and _auth_creds[0] and _auth_creds[1])
_auth_enabled = _local_auth_enabled or _google_oauth_enabled
if _auth_required is None:
    _auth_required = _auth_enabled

_rbac_cfg = _load_rbac_cfg_from_store()
_set_rbac_cfg(_rbac_cfg)
def _build_beforeware():
    auth_before = make_user_auth_before(_auth_required, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    return build_beforeware(auth_before, _auth_enabled or (_rbac_cfg.get("enabled") and _rbac_rules))


def _build_app():
    return build_app(FastHTML, hdrs, _build_beforeware())


app = _build_app()


def _favicon_icon_path():
    path = get_root_folder() / "static" / "icon.png"
    return path if path.exists() else None


@app.route("/static/icon.png")
async def favicon_icon():
    path = _favicon_icon_path()
    if path and path.exists():
        return FileResponse(path)
    return Response(status_code=404)


@app.route("/static/icon.svg")
async def favicon_svg_icon():
    return Response(favicon_svg(get_root_folder()), media_type="image/svg+xml")


@app.route("/static/extensions/{extension_id}/{asset_path:path}")
async def extension_static_asset(extension_id: str, asset_path: str):
    from .assets import extension_asset_path

    path = extension_asset_path(extension_id, asset_path)
    if path.exists() and path.is_file():
        return FileResponse(path)
    return Response(status_code=404)


def _mount_package_static(app_instance):
    mount_package_static(app_instance, Path(__file__).parent)

rt = app.route

_runtime = RuntimeContext(
    config=_config,
    rbac_rules=lambda: _rbac_rules,
    rbac_cfg=lambda: _rbac_cfg,
    google_oauth_cfg=lambda: _google_oauth_cfg,
    logger=logger,
)
set_runtime_context(_runtime)


def _register_extension_routes():
    runtime = get_extension_runtime()
    if not runtime:
        return
    for entry in runtime.route_handlers:
        handler = entry.get("handler")
        if callable(handler):
            handler(rt, _runtime)


_register_extension_routes()


def _register_extension_lifecycle_hooks():
    runtime = get_extension_runtime()
    if not runtime:
        return
    if hasattr(app, "add_event_handler"):
        for hook in runtime.startup_hooks:
            app.add_event_handler("startup", hook)
        for hook in runtime.shutdown_hooks:
            app.add_event_handler("shutdown", hook)
    elif hasattr(app, "on_event"):
        for hook in runtime.startup_hooks:
            app.on_event("startup")(hook)
        for hook in runtime.shutdown_hooks:
            app.on_event("shutdown")(hook)


_register_extension_lifecycle_hooks()


from starlette.requests import Request
from starlette.responses import RedirectResponse, FileResponse, Response, StreamingResponse


def _live_reload_roots():
    roots = []
    for _, root in get_content_mounts():
        if root.exists() and root not in roots:
            roots.append(root)
    return roots or [get_root_folder()]


def _is_live_reload_path(path: Path):
    if any(part in set(get_config().get_reload_excludes()) for part in path.parts):
        return False
    return path.name == ".vyasa" or path.suffix in {".md", ".pdf", ".tree", ".css", ".js"}


async def _live_reload_events():
    yield "event: ready\ndata: ok\n\n"
    try:
        from watchfiles import awatch
    except ImportError:
        while True:
            await asyncio.sleep(30)
            yield ": keepalive\n\n"
    async for changes in awatch(*_live_reload_roots(), debounce=400):
        if any(_is_live_reload_path(Path(path)) for _, path in changes):
            yield f"event: reload\ndata: {int(time.time())}\n\n"


@rt("/_vyasa/reload")
async def live_reload():
    if not get_config().get_browser_reload_enabled():
        return Response(status_code=404)
    return StreamingResponse(_live_reload_events(), media_type="text/event-stream")


@rt("/_vyasa/refresh-refs")
def refresh_refs():
    """Bust the ref-discovery cache and fetch mirrors so newly-created
    branches/tags appear immediately. Sync def → runs in a threadpool."""
    _git_roots_with_refs.cache_clear()
    try:
        from .git_fetcher import fetch_all, specs_from_config

        specs, mirror_root = specs_from_config()
        if specs:
            fetch_all(specs, mirror_root)
    except Exception:
        pass
    _git_roots_with_refs.cache_clear()
    return Response(status_code=204)
def _initialize_app(app_instance):
    _mount_package_static(app_instance)


_app_initialized = False


def ensure_app_initialized():
    global _app_initialized
    if _app_initialized:
        return
    _initialize_app(app)
    _app_initialized = True


ensure_app_initialized()


def theme_toggle():
    theme_script = """on load set franken to (localStorage's __FRANKEN__ or '{}') as Object
                if franken's mode is 'dark' then add .dark to <html/> end
                on click toggle .dark on <html/>
                set franken to (localStorage's __FRANKEN__ or '{}') as Object
                if the first <html/> matches .dark set franken's mode to 'dark' else set franken's mode to 'light' end
                set localStorage's __FRANKEN__ to franken as JSON"""
    button = Button(
        UkIcon("moon", cls="dark:hidden"),
        UkIcon("sun", cls="hidden dark:block"),
        _=theme_script,
        id="theme-mode-toggle",
        cls="vyasa-emphasis-control vyasa-emphasis-control-icon p-1 hover:scale-110 shadow-none",
        type="button",
    )
    cfg = get_config()
    if not cfg.get_theme_debug():
        return button
    active = cfg.get_theme_preset() or ""
    presets = cfg.get_theme_extension_payloads()
    preset_meta = cfg.get_theme_extension_meta()
    random_icon = to_xml(UkIcon("shuffle"))
    menu_items = "".join(
        f'<button type="button" data-theme-name="{name}" '
        f'onclick="window.vyasaApplyThemePreset && window.vyasaApplyThemePreset(this.dataset.themeName, this)" '
        f'class="theme-preset-option vyasa-emphasis-control-option block w-full rounded px-3 py-2 text-left">{name}</button>'
        for name in presets
    )
    return Div(
        Script(f"window.__VYASA_THEME_PRESETS__ = {json.dumps(presets)};"),
        Script(f"window.__VYASA_THEME_EXTENSION_META__ = {json.dumps(preset_meta)};"),
        NotStr(
            f"""
            <div class="flex items-center gap-2" data-theme-switcher>
                <div id="theme-preset-dropdown" class="relative min-w-44" style="position:relative;min-width:11rem;">
                    <button type="button" id="theme-preset-toggle"
                        onclick="window.vyasaToggleThemePresetMenu && window.vyasaToggleThemePresetMenu(this)"
                        class="vyasa-emphasis-control vyasa-emphasis-control-field flex w-full items-center justify-between rounded-md px-3 py-2 text-sm">
                        <span id="theme-preset-active-label" class="truncate">{active or "Theme"}</span>
                        <span class="ml-3">⌄</span>
                    </button>
                    <div id="theme-preset-menu" class="vyasa-emphasis-control-menu" style="display:none;position:absolute;left:0;top:calc(100% + 0.5rem);z-index:1400;max-height:18rem;width:16rem;overflow-y:auto;">
                        {menu_items}
                    </div>
                </div>
                <button type="button" title="Random theme font"
                    onclick="window.vyasaApplyRandomThemePreset && window.vyasaApplyRandomThemePreset(this)"
                    class="vyasa-emphasis-control vyasa-emphasis-control-icon rounded-md px-3 py-2">
                    {random_icon}
                </button>
            </div>
            """
        ),
        button,
        cls="relative z-[1200] flex items-center gap-2",
    )


@lru_cache(maxsize=2)
def _git_roots_with_refs(time_bucket):
    """Discover every git-backed content root and its refs, as
    (alias, default_ref, current_branch, ((name, kind, is_default), ...)).

    Cached per coarse time bucket so the per-root dulwich opens happen at
    most once every few seconds, not on every page render."""
    from .content_backend import GitBackend, classify_root
    from .helpers import get_content_mounts

    out = []
    for alias, root in get_content_mounts():
        rc = classify_root(root)
        if rc.kind == "plain" or rc.git_dir is None:
            continue
        try:
            refs = GitBackend(rc.git_dir).list_refs()
        except Exception:
            continue
        if not refs:
            continue
        # branches before tags; then strictly case-insensitive alpha by name.
        refs.sort(key=lambda r: (0 if r.kind == "branch" else 1, r.name.lower()))
        default = next((r.name for r in refs if r.is_default), "")
        current_branch = rc.current_branch if rc.kind == "clone" else ""
        out.append((alias, default, current_branch or "", tuple((r.name, r.kind, r.is_default) for r in refs)))
    return tuple(out)


def _ref_target_url(alias, name, current_path):
    """Where switching `alias` to `name` should land: the SAME document you're
    viewing, but pinned to `name`. Falls back to the root when not on a doc."""
    from .helpers import content_location

    rel = ""
    if current_path:
        _, _, _, relp = content_location(current_path)
        rp = relp.as_posix()
        rel = rp if rp and rp != "." else ""
    if alias:
        # pack ref slashes as ':' (git refnames forbid ':') to keep one segment
        slug = f"{alias}@{name.replace('/', ':')}"
        return content_url_for_slug(f"{slug}/{rel}" if rel else slug)
    # primary root: carry the ref as a query param on the current page (or home)
    base = content_url_for_slug(rel) if rel else "/"
    sep = "&" if "?" in base else "?"
    return f"{base}{sep}ref={quote(name, safe='')}"


def _build_ref_tree(refs):
    """Nest refs by their `/` segments. `feat/git-refs` → tree["feat"] leaf.
    Each node is a dict; "_leaves" holds (name, kind, is_default) at that level."""
    root = {"_leaves": []}
    for item in refs:
        node = root
        for seg in item[0].split("/")[:-1]:
            node = node.setdefault(seg, {"_leaves": []})
        node["_leaves"].append(item)
    return root


_REF_ROW_STYLE = (
    "display:flex;align-items:center;justify-content:flex-start;text-align:left;"
    "box-sizing:border-box;width:100%;min-height:1.9rem;gap:0.4rem;"
    "padding:0.25rem 0.5rem;line-height:1.25;font-size:0.8125rem;font-weight:400;"
)


def _ref_row_style(depth):
    """Shared row style; depth is rendered as left padding so every level keeps
    the same height/font and a full-width highlight (only the text shifts in)."""
    return f"{_REF_ROW_STYLE}padding-left:{0.5 + depth * 0.9:.3f}rem;"


def _render_ref_nodes(node, alias, current, current_path, active, storage_key, open_parts, depth=1):
    """Recursive list items: folders (sorted, collapsed) first, then leaf refs.
    `open_parts` = remaining segments of the current ref, so its chain auto-opens."""
    out = []
    for seg in sorted(k for k in node if k != "_leaves"):
        is_open = bool(open_parts) and open_parts[0] == seg
        out.append(Li(Details(
            Summary(
                UkIcon("folder", cls="w-3.5 h-3.5 opacity-60 shrink-0"),
                Span(f"{seg}/", cls="truncate"),
                cls="vyasa-emphasis-control-option list-none cursor-pointer [&::-webkit-details-marker]:hidden",
                style=_ref_row_style(depth),
            ),
            Ul(*_render_ref_nodes(node[seg], alias, current, current_path, active, storage_key, open_parts[1:] if is_open else [], depth + 1),
               cls="list-none", style="margin:0;padding:0"),
            open=is_open,
        )))
    for name, kind, is_default in node["_leaves"]:
        url = _ref_target_url(alias, name, current_path if active else "")
        out.append(Li(Button(
            Span("✓" if name == current else "", cls="shrink-0", style="width:0.75rem;display:inline-block"),
            Span(name.split("/")[-1], cls="truncate"), Span(" (default)" if is_default else "", cls="opacity-60 text-xs"),
            UkIcon("tag", cls="w-3 h-3 opacity-50 ml-auto") if kind == "tag" else "",
            type="button",
            onclick=f"try{{localStorage.setItem('{storage_key}','{name}');}}catch(e){{}};window.location='{url}';",
            cls="vyasa-emphasis-control-option",
            style=_ref_row_style(depth),
        )))
    return out


def _navbar_ref_switcher(current_path=None):
    """Always-visible navbar dropdown of every git-backed root, each
    expanding to a `/`-nested tree of its branches and tags. Picking a ref
    navigates to that root on the ref and remembers it per root in localStorage."""
    roots = _git_roots_with_refs(int(time.time() // 10))
    if not roots:
        return None
    from .helpers import content_location

    cur_root_id, cur_ref = "", ""
    if current_path:
        cur_root_id, _, cur_ref, _ = content_location(current_path)

    root_blocks = []
    for alias, default, current_branch, refs in roots:
        active = alias == cur_root_id
        current = (cur_ref if active else "") or current_branch or default
        storage_key = f"vyasa-ref:{alias}"
        open_parts = current.split("/")[:-1] if active else []
        tree = _build_ref_tree(refs)
        ref_items = _render_ref_nodes(tree, alias, current, current_path, active, storage_key, open_parts)
        refresh_btn = Button(
            UkIcon("refresh-cw", cls="w-3.5 h-3.5"),
            type="button", title="Fetch & refresh branches",
            onclick="event.stopPropagation();event.preventDefault();var i=this.querySelector('svg');if(i)i.classList.add('animate-spin');fetch('/_vyasa/refresh-refs',{method:'GET'}).finally(function(){window.location.reload();});",
            cls="vyasa-emphasis-control-option ml-1 shrink-0 rounded p-1",
        )
        root_blocks.append(Li(Details(
            Summary(
                UkIcon("folder-git-2", cls="w-3.5 h-3.5 opacity-60 shrink-0"),
                Span(alias or "(primary)", cls="truncate"),
                refresh_btn,
                Span(current, cls="opacity-60 ml-auto truncate max-w-[7rem]"),
                cls="vyasa-emphasis-control-option list-none cursor-pointer [&::-webkit-details-marker]:hidden",
                style=_ref_row_style(0),
            ),
            Ul(*ref_items, cls="list-none", style="margin:0;padding:0"),
            open=active,
            cls="vyasa-ref-root",
        ), cls="my-0.5"))

    return Details(
        Summary(
            UkIcon("git-branch", cls="w-4 h-4"), Span("Branches", cls="hidden sm:inline"), Span("⌄", cls="opacity-70"),
            cls="list-none flex items-center gap-2 cursor-pointer select-none rounded-md px-3 py-2 text-slate-100 hover:bg-slate-800/80 transition-colors [&::-webkit-details-marker]:hidden",
        ),
        Div(Ul(*root_blocks, cls="list-none", style="margin:0;padding:0"), cls="vyasa-emphasis-control-menu absolute right-0 mt-2 w-72 z-[1100] max-h-[70vh] overflow-y-auto"),
        cls="vyasa-ref-switcher relative",
    )


def navbar(
    show_mobile_menus=False, htmx_nav=True, posts_menu_items=None, compact_mode=False, updated_label=None, mobile_extra_controls=(), current_path=None
):
    return navbar_view(get_blog_title(), theme_toggle(), show_mobile_menus, htmx_nav, posts_menu_items, compact_mode, updated_label, mobile_extra_controls, ref_switcher=_navbar_ref_switcher(current_path))


def _posts_sidebar_fingerprint():
    try:
        return ContentTree.from_runtime().fingerprint()
    except Exception:
        return 0


def _find_search_matches(query, limit=40):
    runtime = get_extension_runtime()
    provider = runtime.search_match_finder if runtime else None
    if provider and provider is not _find_search_matches:
        return provider(query, limit)
    return _find_search_matches_uncached(query, limit)


def _find_search_preview_matches(query, limit=200):
    runtime = get_extension_runtime()
    provider = runtime.search_preview_match_finder if runtime else None
    if provider and provider is not _find_search_preview_matches:
        return provider(query, limit)
    return _find_search_preview_matches_uncached(query, limit)


def _find_search_candidates(query, limit=40, *, suffixes=(".md", ".pdf")):
    return search_file_records(
        query,
        get_content_mounts(),
        suffixes,
        get_config().get_show_hidden(),
        limit,
    )


def _find_search_matches_uncached(query, limit=40):
    return _find_search_candidates(query, limit, suffixes=(".md", ".pdf"))


def _find_search_preview_matches_uncached(query, limit=200):
    return _find_search_candidates(query, limit, suffixes=(".md",))


def _filter_search_matches_by_roles(matches, roles):
    if roles is None:
        return list(matches)
    filtered = []
    for item in matches:
        slug = content_slug_for_path(item)
        if slug and is_allowed(f"/posts/{slug}", roles or [], _rbac_rules):
            filtered.append(item)
    return filtered


def _sidebar_section_nodes():
    runtime = get_extension_runtime()
    providers = runtime.sidebar_section_providers if runtime else []
    context = {
        "sidebar_section": sidebar_section,
        "render_search_results": _render_posts_search_results,
        "kbd": Kbd,
    }
    return [provider(context) for provider in providers]


@lru_cache(maxsize=2)
def _uncommitted_slugs(time_bucket):
    """Slugs whose backing file differs from HEAD in the primary working
    clone. Scoped to the primary root only (git status across every mounted
    repo is too slow when several are large, and drafts live in the author's
    own root). Cached per coarse time bucket so it is computed at most once
    every few seconds, never per sidebar row."""
    from .content_backend import classify_root, uncommitted_paths

    rc = classify_root(get_root_folder())
    if rc.kind != "clone":
        return frozenset()
    slugs = set()
    for rel in uncommitted_paths(rc):
        stripped = rel.rsplit(".", 1)[0] if "." in rel.rsplit("/", 1)[-1] else rel
        slugs.update((rel, stripped))
    return frozenset(slugs)


def _current_uncommitted_slugs():
    return _uncommitted_slugs(int(time.time() // 5))


def _uncommitted_row_decorator(node, *, slug=None, title="", context="tree"):
    if not slug or slug not in _current_uncommitted_slugs():
        return node
    dot = Span("●", cls="vyasa-uncommitted-dot text-amber-500 text-[0.6rem] ml-1 shrink-0", title="Uncommitted changes")
    return Span(node, dot, cls="inline-flex items-center min-w-0")


def _sidebar_row_decorators():
    runtime = get_extension_runtime()
    if not runtime:
        return ()
    return (*runtime.sidebar_row_decorators, _uncommitted_row_decorator, _row_action_decorator(runtime.sidebar_action_registry()))


def _search_result_row_decorators():
    runtime = get_extension_runtime()
    if not runtime:
        return ()
    return (*runtime.search_result_row_decorators, _row_action_decorator(runtime.search_result_action_registry()))


def _row_action_decorator(registry):
    def decorate(node, *, slug=None, title="", context="tree"):
        actions = registry.actions_for(slug=slug, title=title, context=context)
        if not actions:
            return node
        bookmark_row = any(action.attrs.get("data_bookmark_toggle") == "true" for action in actions)
        row_base = TREE_ACTION_ROW_BASE_CLASSES.get(context, TREE_ACTION_ROW_BASE_CLASSES["tree"])
        row_cls = f"vyasa-action-row {'vyasa-bookmark-row ' if bookmark_row else ''}{row_base}"
        row_attrs = {}
        for action in actions:
            row_attrs.update(action.row_attrs)
        if context in {"tree", "tree-inline"} and getattr(node, "attrs", None):
            cls = node.attrs.get("class", "")
            cls = " ".join(part for part in cls.split() if part not in {"vyasa-tree-row", "vyasa-tree-row-shell"})
            node.attrs["class"] = cls
        state_nodes = [
            Span(
                action.state_text or "",
                cls="vyasa-row-action-state ml-1 text-[0.68rem] opacity-70",
                **action.state_attrs,
            )
            for action in actions
            if (action.state_text is not None or action.state_attrs) and action.attrs.get("data_inline_state_button") != "true"
        ]
        buttons = [
            Button(
                Span(action.icon_text or "", cls=("vyasa-bookmark-glyph " if action.attrs.get("data_bookmark_toggle") == "true" else "") + "flex h-4 w-4 items-center justify-center text-sm", aria_hidden="true"),
                *((
                    Span(
                        action.state_text or "",
                        cls="vyasa-row-action-state text-[0.68rem] opacity-70",
                        **action.state_attrs,
                    ),
                ) if action.attrs.get("data_inline_state_button") == "true" else ()),
                type="button",
                title=action.label,
                aria_label=action.label,
                data_action_id=action.id,
                cls=("vyasa-bookmark-toggle " if action.attrs.get("data_bookmark_toggle") == "true" else "") + TREE_ACTION_BUTTON_CLASSES,
                **action.attrs,
            )
            for action in actions
        ]
        return Span(node, *buttons, *state_nodes, cls=row_cls, **row_attrs)

    return decorate


def _render_posts_search_results(query, roles=None):
    trimmed = (query or "").strip()
    matches, regex_error = _find_search_matches(trimmed)
    matches = _filter_search_matches_by_roles(matches, roles)
    rendered_matches = [
        (slug, content_slug_for_path(item, strip_suffix=False) if document_kind_for_suffix(item.suffix) != "markdown" else slug)
        for item in matches
        if (slug := content_slug_for_path(item))
    ]
    return render_posts_search_results(trimmed, rendered_matches, regex_error, row_decorators=_search_result_row_decorators())


@traced("sidebar")
@lru_cache(maxsize=16)
def _cached_posts_sidebar_html(fingerprint, roles_key, show_hidden, current_path=""):
    posts_items = get_posts(list(roles_key) if roles_key else [], current_path=current_path)
    extra_sections = _sidebar_section_nodes()
    sidebar = build_collapsible_sidebar(
        "menu",
        "Library",
        [],
        is_open=True,
        data_sidebar="posts",
        shortcut_key="Z",
        extra_content=[
            *extra_sections,
            sidebar_section(
                "Posts",
                Div(
                    Ul(*posts_items, cls="list-none pt-1 sidebar-scroll-container", id="sidebar-scroll-container"),
                    cls="min-w-0 flex-1 min-h-0 overflow-x-auto overflow-y-auto",
                    id="vyasa-posts-section-list",
                ),
                is_open=True,
                data_section="posts-tree",
                body_cls="pt-1",
            ),
        ],
        scroll_target="container",
    )
    return to_xml(sidebar)


def _log_startup_content_stats():
    show_hidden = get_config().get_show_hidden()
    excludes = get_config().get_reload_excludes()
    roots = get_content_mounts()
    md_count = sum(1 for _, root in roots for _ in iter_visible_files(root, (".md",), show_hidden))
    pdf_count = sum(1 for _, root in roots for _ in iter_visible_files(root, (".pdf",), show_hidden))
    vyasa_count = sum(1 for _, root in roots for _ in iter_visible_files(root, (".vyasa",), True))
    logger.info(
        "Startup scan root={} show_hidden={} md={} pdf={} vyasa={} excludes={}",
        [str(root) for _, root in roots],
        show_hidden,
        md_count,
        pdf_count,
        vyasa_count,
        excludes,
    )


def _preload_posts_cache():
    try:
        show_hidden = get_config().get_show_hidden()
        import time

        t0 = time.perf_counter()
        _log_startup_content_stats()
        t1 = time.perf_counter()
        _cached_build_post_tree(_posts_tree_fingerprint(), (), show_hidden, "")
        t2 = time.perf_counter()
        _cached_posts_sidebar_html(_posts_sidebar_fingerprint(), (), show_hidden)
        t3 = time.perf_counter()
        logger.info(
            "Startup preload timings stats={:.3f}s tree={:.3f}s sidebar={:.3f}s total={:.3f}s",
            t1 - t0,
            t2 - t1,
            t3 - t2,
            t3 - t0,
        )
        logger.info("Preloaded posts sidebar cache.")
    except Exception as exc:
        logger.warning(f"Failed to preload posts sidebar cache: {exc}")


# Warm cache on server startup to avoid first-request latency.
if hasattr(app, "add_event_handler"):
    app.add_event_handler("startup", _preload_posts_cache)
elif hasattr(app, "on_event"):
    app.on_event("startup")(_preload_posts_cache)


def is_active_toc_item(anchor):
    """Check if a TOC item is currently active based on URL hash"""
    # This will be enhanced client-side with JavaScript
    return False


def _default_page_frame_deps():
    return PageFrameDeps(
        logger=logger,
        resolve_layout_config=_resolve_layout_config,
        width_class_and_style=_width_class_and_style,
        style_attr=_style_attr,
        get_sidebar_custom_css_links=get_sidebar_custom_css_links,
        get_root_folder=get_root_folder,
        build_sidebar_toc_items=build_sidebar_toc_items,
        extract_sidebar_toc=extract_sidebar_toc,
        strip_inline_markdown=_strip_inline_markdown,
        text_to_anchor=text_to_anchor,
        unique_anchor=_unique_anchor,
        get_config=get_config,
        build_collapsible_sidebar=build_collapsible_sidebar,
        get_roles_from_auth=get_roles_from_auth,
        rbac_rules=_rbac_rules,
        rbac_cfg=_rbac_cfg,
        google_oauth_cfg=_google_oauth_cfg,
        coerce_list=_config._coerce_list,
        cached_posts_sidebar_html=_cached_posts_sidebar_html,
        posts_sidebar_fingerprint=_posts_sidebar_fingerprint,
        get_posts=get_posts,
        navbar=navbar,
    )


def default_page_frame(
    *content,
    title=None,
    show_sidebar=False,
    toc_content=None,
    current_path=None,
    show_toc=True,
    auth=None,
    htmx_nav=True,
    nav_posts_menu=False,
    full_width=False,
    show_footer=True,
    no_scroll=False,
    slide_mode=False,
    current_updated_label=None,
    extra_head_nodes=(),
):
    page_head_nodes = bundle_asset_nodes(
        requested_page_bundles(
            show_sidebar=show_sidebar,
            current_path=current_path,
            slide_mode=slide_mode,
            annotations_enabled=get_config().get_annotations_enabled(),
        )
    )
    return PageFrame(
        tuple(content),
        title=title,
        show_sidebar=show_sidebar,
        toc_content=toc_content,
        current_path=current_path,
        show_toc=show_toc,
        auth=auth,
        htmx_nav=htmx_nav,
        nav_posts_menu=nav_posts_menu,
        full_width=full_width,
        show_footer=show_footer,
        no_scroll=no_scroll,
        slide_mode=slide_mode,
        current_updated_label=current_updated_label,
        extra_head_nodes=(*page_head_nodes, *tuple(extra_head_nodes or ())),
    )


def _default_layout(*content, htmx, **kwargs):
    return render_page_frame(
        default_page_frame(*content, **kwargs),
        htmx=htmx,
        deps=_default_page_frame_deps(),
    )


def layout(
    *content,
    htmx,
    title=None,
    show_sidebar=False,
    toc_content=None,
    current_path=None,
    show_toc=True,
    auth=None,
    htmx_nav=True,
    nav_posts_menu=False,
    full_width=False,
    show_footer=True,
    no_scroll=False,
    slide_mode=False,
    current_updated_label=None,
    extra_head_nodes=(),
):
    runtime = get_extension_runtime()
    provider = runtime.layout_renderer if runtime else None
    if provider:
        return provider(
            *content,
            htmx=htmx,
            title=title,
            show_sidebar=show_sidebar,
            toc_content=toc_content,
            current_path=current_path,
            show_toc=show_toc,
            auth=auth,
            htmx_nav=htmx_nav,
            nav_posts_menu=nav_posts_menu,
            full_width=full_width,
            show_footer=show_footer,
            no_scroll=no_scroll,
            slide_mode=slide_mode,
            current_updated_label=current_updated_label,
            extra_head_nodes=extra_head_nodes,
        )
    return _default_layout(
        *content,
        htmx=htmx,
        title=title,
        show_sidebar=show_sidebar,
        toc_content=toc_content,
        current_path=current_path,
        show_toc=show_toc,
        auth=auth,
        htmx_nav=htmx_nav,
        nav_posts_menu=nav_posts_menu,
        full_width=full_width,
        show_footer=show_footer,
        no_scroll=no_scroll,
        slide_mode=slide_mode,
        current_updated_label=current_updated_label,
        extra_head_nodes=extra_head_nodes,
    )


_nav_entries_cache: dict[tuple[str, bool], tuple[float, list[Path]]] = {}


# The git ref a specific root is currently being viewed on, as (root_id, ref),
# so the sidebar can render that one mount from objects while the rest of the
# tree stays on disk. Per-request, set by get_posts.
_active_ref_root: "ContextVar[tuple[str, str] | None]" = ContextVar("vyasa_active_ref_root", default=None)


def _get_nav_entries(
    folder: Path, root: Path, show_hidden: bool, excluded_dirs: set[str]
):
    active = _active_ref_root.get()
    key = (str(folder.resolve()), show_hidden, active)
    try:
        mtime = folder.stat().st_mtime
    except OSError:
        return []
    cached = _nav_entries_cache.get(key)
    if cached and cached[0] == mtime:
        return cached[1]
    ordered = get_tree_entries(folder, root, show_hidden, excluded_dirs, enabled_document_suffixes())
    if folder.resolve() == root.resolve():
        ordered = _swap_ref_roots(ordered, active)
    _nav_entries_cache[key] = (mtime, ordered)
    return ordered


def _swap_ref_roots(entries, active):
    """Swap top-level mount entries for git-ref VirtualPaths:

    - a bare mirror has no working tree, so it always renders from its default
      ref (walking it as disk would expose git internals);
    - the `active` (root_id, ref) mount renders from that ref, so switching a
      branch shows that root's branch content while every other root stays put.
    """
    from .content_backend import classify_root
    from .content_tree import ref_root_vpath
    from .helpers import get_content_mounts

    git_mounts = get_config().get_git_mounts()
    active_id, active_ref = active or ("", "")
    bare = {Path(p).resolve(): a for a, p in git_mounts if a and classify_root(p).kind == "bare"}
    alias_by_path = {Path(p).resolve(): a for a, p in get_content_mounts() if a}
    if not bare and not (active_id and active_id in alias_by_path.values()):
        return entries

    swapped = []
    for entry in entries:
        if not (hasattr(entry, "resolve") and not hasattr(entry, "slug")):
            swapped.append(entry)
            continue
        resolved = entry.resolve()
        alias = alias_by_path.get(resolved)
        vpath = None
        if alias and alias == active_id:
            vpath = ref_root_vpath(alias, active_ref)  # None if ref == current branch (disk)
        elif resolved in bare:
            vpath = ref_root_vpath(bare[resolved], "")
        swapped.append(vpath if vpath is not None else entry)
    return swapped


def _nav_entries_for(folder, root, show_hidden, excluded_dirs):
    """Dispatch nav-entry listing: VirtualPath (git ref) folders read from the
    object store, disk folders from the filesystem."""
    from .content_backend import VirtualPath
    from .content_tree import ref_nav_entries

    if isinstance(folder, VirtualPath):
        return ref_nav_entries(folder, root, show_hidden, excluded_dirs)
    return _get_nav_entries(folder, root, show_hidden, excluded_dirs)


def _folder_has_visible_descendant(folder: Path, roles, depth: int = 3):
    return tree_folder_has_visible_descendant(
        folder, roles, depth, root=get_root_folder(), show_hidden=get_config().get_show_hidden(),
        excluded_dirs=set(get_config().get_reload_excludes()), get_nav_entries=_get_nav_entries,
        is_allowed_fn=is_allowed, rbac_rules=_rbac_rules,
    )


def build_post_tree(folder, roles=None, max_depth=None, active_parts=()):
    return build_post_tree_render(
        folder, roles=roles, max_depth=max_depth, active_parts=active_parts,
        root=get_root_folder(), show_hidden=get_config().get_show_hidden(),
        excluded_dirs=set(get_config().get_reload_excludes()), get_nav_entries=_nav_entries_for,
        effective_abbreviations=_effective_abbreviations, should_exclude_dir_fn=should_exclude_dir,
        slug_to_title_fn=slug_to_title, find_folder_note_file_fn=find_folder_note_file,
        is_allowed_fn=is_allowed, parse_frontmatter_fn=parse_frontmatter,
        rbac_rules=_rbac_rules, logger=logger, row_decorators=_sidebar_row_decorators(),
    )


def _posts_tree_fingerprint():
    try:
        return ContentTree.from_runtime().fingerprint()
    except Exception:
        return 0


@lru_cache(maxsize=8)
def _cached_build_post_tree(fingerprint, roles_key, show_hidden, current_path):
    roles = list(roles_key) if roles_key else []
    active_parts = tuple(Path(current_path).parts[:-1]) if current_path else ()
    return build_post_tree(
        get_root_folder(), roles=roles, max_depth=1, active_parts=active_parts
    )


def build_ref_post_tree(root_id, ref, roles=None, active_parts=()):
    """Build the sidebar tree for a git-ref root, walking the object store
    via VirtualPaths through the same renderer as the disk tree."""
    from .content_tree import ref_nav_entries, ref_root_vpath

    root_vpath = ref_root_vpath(root_id, ref)
    if root_vpath is None:
        return None
    return build_post_tree_render(
        root_vpath, roles=roles, max_depth=None, active_parts=active_parts,
        root=root_vpath, show_hidden=get_config().get_show_hidden(),
        excluded_dirs=set(get_config().get_reload_excludes()), get_nav_entries=ref_nav_entries,
        effective_abbreviations=lambda root, folder=None: {}, should_exclude_dir_fn=should_exclude_dir,
        slug_to_title_fn=slug_to_title, find_folder_note_file_fn=find_folder_note_file,
        is_allowed_fn=is_allowed, parse_frontmatter_fn=parse_frontmatter,
        rbac_rules=_rbac_rules, logger=logger, row_decorators=_sidebar_row_decorators(),
    )


@lru_cache(maxsize=16)
def _cached_build_ref_post_tree(root_id, ref, sha, roles_key, active_parts):
    return build_ref_post_tree(root_id, ref, roles=list(roles_key) if roles_key else [], active_parts=active_parts)


def _ref_from_current_path(current_path):
    """(root_id, ref, active_parts) when current_path carries alias@ref, else None."""
    parts = Path(str(current_path).strip("/")).parts if current_path else ()
    if not parts or "@" not in parts[0]:
        return None
    root_id, ref = parts[0].split("@", 1)
    ref = ref.replace(":", "/")  # ref slashes are packed as ':' in the slug
    if not ref:
        return None
    return root_id, ref, tuple(parts[1:-1])


def get_posts(roles=None, current_path=""):
    parsed = _ref_from_current_path(current_path)
    if parsed:
        root_id, ref, active_parts = parsed
        if root_id:
            # A named mount viewed on a ref: keep the whole multi-root tree, but
            # render that one mount from the ref. active_parts use the bare alias
            # (the swapped VirtualPath mount is named by the alias, not alias@ref).
            token = _active_ref_root.set((root_id, ref))
            try:
                return build_post_tree(get_root_folder(), roles=roles, max_depth=1, active_parts=(root_id, *active_parts))
            finally:
                _active_ref_root.reset(token)
        # The primary root itself on a ref (?ref=): serve its ref tree.
        from .content_tree import ref_root_vpath

        root_vpath = ref_root_vpath(root_id, ref)
        if root_vpath is not None:
            sha = root_vpath._backend.resolve_ref(ref)
            items = _cached_build_ref_post_tree(root_id, ref, sha, tuple(roles or []), active_parts)
            if items is not None:
                return items
    fingerprint = _posts_tree_fingerprint()
    roles_key = tuple(roles or [])
    show_hidden = get_config().get_show_hidden()
    return _cached_build_post_tree(
        fingerprint, roles_key, show_hidden, current_path or ""
    )


def _default_not_found(htmx=None, auth=None):
    """Custom 404 error page"""
    blog_title = get_blog_title()
    content = not_found_content()

    # Return with layout, including sidebar for easy navigation
    # Store the result tuple to potentially wrap with status code
    result = layout(
        content,
        htmx=htmx,
        title=f"404 - Page Not Found | {blog_title}",
        show_sidebar=True,
        auth=auth,
    )
    return result


def not_found(htmx=None, auth=None):
    runtime = get_extension_runtime()
    provider = runtime.error_renderer if runtime else None
    if provider and provider is not _default_not_found:
        return provider(htmx=htmx, auth=auth)
    return _default_not_found(htmx=htmx, auth=auth)


set_runtime_services({
    "config": _config,
    "logger": logger,
    "get_config": lambda: get_config(),
    "get_root_folder": lambda: get_root_folder(),
    "get_blog_title": lambda: get_blog_title(),
    "get_content_mounts": lambda: get_content_mounts(),
    "get_file_created_ts": lambda path: get_file_created_ts(path),
    "layout": lambda *args, **kwargs: layout(*args, **kwargs),
    "default_page_frame": lambda *args, **kwargs: default_page_frame(*args, **kwargs),
    "default_page_frame_deps": lambda: _default_page_frame_deps(),
    "not_found": lambda *args, **kwargs: not_found(*args, **kwargs),
    "default_not_found": lambda *args, **kwargs: _default_not_found(*args, **kwargs),
    "get_roles_from_auth": lambda *args, **kwargs: get_roles_from_auth(*args, **kwargs),
    "get_roles_from_request": lambda *args, **kwargs: get_roles_from_request(*args, **kwargs),
    "get_auth_from_request": lambda *args, **kwargs: get_auth_from_request(*args, **kwargs),
    "resolve_roles": resolve_roles,
    "is_allowed": lambda *args, **kwargs: is_allowed(*args, **kwargs),
    "parse_frontmatter": lambda *args, **kwargs: parse_frontmatter(*args, **kwargs),
    "resolve_markdown_title": lambda *args, **kwargs: resolve_markdown_title(*args, **kwargs),
    "slug_to_title": lambda *args, **kwargs: slug_to_title(*args, **kwargs),
    "effective_abbreviations": _effective_abbreviations,
    "from_md": lambda *args, **kwargs: from_md(*args, **kwargs),
    "render_blog_home_feed": lambda *args, **kwargs: render_blog_home_feed(*args, **kwargs),
    "render_search_preview_page": lambda *args, **kwargs: render_search_preview_page(*args, **kwargs),
    "render_posts_search_results": lambda *args, **kwargs: _render_posts_search_results(*args, **kwargs),
    "find_search_matches": lambda *args, **kwargs: _find_search_matches(*args, **kwargs),
    "gather_search_page": gather_search_page,
    "gather_search_content": gather_search_content,
    "content_path_for_slug": lambda *args, **kwargs: content_path_for_slug(*args, **kwargs),
    "content_slug_for_path": lambda *args, **kwargs: content_slug_for_path(*args, **kwargs),
    "content_url_for_slug": lambda *args, **kwargs: content_url_for_slug(*args, **kwargs),
    "iter_visible_files": lambda *args, **kwargs: iter_visible_files(*args, **kwargs),
    "cached_posts_sidebar_html": _cached_posts_sidebar_html,
    "posts_sidebar_fingerprint": lambda: _posts_sidebar_fingerprint(),
    "cached_build_post_tree": _cached_build_post_tree,
    "build_post_tree": lambda *args, **kwargs: build_post_tree(*args, **kwargs),
    "sidebar_row_decorators": lambda: _sidebar_row_decorators(),
    "local_auth_enabled": _local_auth_enabled,
    "google_oauth_enabled": _google_oauth_enabled,
    "google_oauth": _google_oauth,
    "google_oauth_cfg": lambda: _google_oauth_cfg,
    "rbac_cfg": lambda: _rbac_cfg,
    "rbac_rules": lambda: _rbac_rules,
    "coerce_list": _config._coerce_list,
    "login_content": login_content,
    "impersonate_content": impersonate_content,
    "handle_login": handle_login,
    "start_google_login": start_google_login,
    "fetch_google_userinfo": fetch_google_userinfo,
    "google_account_allowed": google_account_allowed,
    "build_google_auth_payload": build_google_auth_payload,
    "handle_admin_impersonate": handle_admin_impersonate,
    "handle_admin_rbac": handle_admin_rbac,
    "apply_impersonation_action": apply_impersonation_action,
    "parse_rbac_form": parse_rbac_form,
    "parse_roles_text": parse_roles_text,
    "rbac_db_write": _rbac_db_write,
    "write_rbac_to_vyasa": _write_rbac_to_vyasa,
    "set_rbac_cfg": _set_rbac_cfg,
    "render_rbac_toml": _render_rbac_toml,
    "rbac_admin_content": rbac_admin_content,
})


@rt("/posts/{path:path}")
def post_detail(path: str, htmx, request: Request):
    return render_post_detail(
        path,
        htmx,
        request,
        get_root_folder=get_root_folder,
        effective_abbreviations=_effective_abbreviations,
        find_folder_note_file=find_folder_note_file,
        slug_to_title=slug_to_title,
        layout=layout,
        get_blog_title=get_blog_title,
        not_found=not_found,
        parse_frontmatter=parse_frontmatter,
        resolve_markdown_title=resolve_markdown_title,
        from_md=from_md,
        logger=logger,
    )


def find_index_file():
    if get_config().get_ignore_cwd_as_root():
        return None
    return find_index_file_helper(get_root_folder)


@rt
def index(htmx, request: Request):
    if not find_index_file():
        return render_blog_home(htmx, request)
    return render_index(
        htmx,
        request,
        get_blog_title=get_blog_title,
        find_index_file_fn=find_index_file,
        parse_frontmatter=parse_frontmatter,
        resolve_markdown_title=resolve_markdown_title,
        get_root_folder=get_root_folder,
        from_md=from_md,
        layout=layout,
        logger=logger,
    )


@rt("/_home/feed")
def home_feed(offset: int = 0, htmx=None, request: Request = None):
    runtime = get_extension_runtime()
    provider = runtime.home_feed_renderer if runtime else None
    if provider and provider is not home_feed:
        return provider(offset=offset, htmx=htmx, request=request)
    roots = get_content_mounts()
    root = roots[0][1] if roots else get_root_folder()
    roles = get_roles_from_auth(request.scope.get("auth"), _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list) if request else None
    entries = _sort_blog_home_entries(iter_blog_home_files(roots, roles), root)
    return render_blog_home_feed(entries, root, max(0, offset), wrap=False)


# Catch-all route for 404 pages (must be last)
@rt("/{path:path}")
def catch_all(path: str, htmx, request: Request):
    """Catch-all route for undefined URLs"""
    return not_found(htmx, auth=request.scope.get("auth"))
