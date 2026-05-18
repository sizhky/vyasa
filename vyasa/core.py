import re
import json
import base64
import time
from datetime import datetime
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
from .nav_views import navbar_view
from loguru import logger
from .assets import asset_url, bundle_asset_nodes, route_bundle_names
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
    for _, root in roots or get_content_mounts():
        for path in iter_visible_files(root, (".md",), include_hidden=False):
            if path.name.startswith("."):
                continue
            if _blog_home_is_ignored(path, root):
                continue
            if path.parent == root and path.stem.lower() in {"index", "readme"}:
                continue
            slug = content_slug_for_path(path)
            if not slug:
                continue
            if roles is not None and not is_allowed(f"/posts/{slug}", roles, _rbac_rules):
                continue
            yield path, slug


def _default_render_blog_home(htmx, request: Request):
    roots = get_content_mounts()
    root = roots[0][1] if roots else get_root_folder()
    roles = get_roles_from_auth(request.scope.get("auth"), _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    entries = _sort_blog_home_entries(iter_blog_home_files(roots, roles), root)
    feed = render_blog_home_feed(entries, root, 0)
    shell = Div(H1(f"Welcome to {get_blog_title()}!", cls="vyasa-page-title text-4xl font-bold"), P("Latest posts", cls="mt-2 text-slate-500"), feed, cls="space-y-6")
    return layout(shell, htmx=htmx, title=f"Home - {get_blog_title()}", show_sidebar=True, current_path="__home__", auth=request.scope.get("auth"))


def render_blog_home(htmx, request: Request):
    runtime = get_extension_runtime()
    provider = runtime.home_renderer if runtime else None
    if provider and provider is not _default_render_blog_home:
        return provider(htmx, request)
    return _default_render_blog_home(htmx, request)


def _render_blog_preview_card(path, slug, root):
    title, render_content = resolve_markdown_title(path, abbreviations=_effective_abbreviations(root))
    read_source = expand_markdown_includes_for_reading(render_content, current_path=slug, root_folder=root)
    read_time = estimate_read_time_minutes(read_source)
    preview = from_md(preview_markdown(render_content), current_path=slug)
    href = content_url_for_slug(slug)
    return Div(
        A(
            Span(title, cls="block line-clamp-3 overflow-hidden"),
            Span(f"{read_time}-min read", cls="block mt-1 text-xs font-normal text-slate-500 dark:text-slate-400"),
            href=href,
            cls="vyasa-blog-card-title absolute top-6 block text-right text-xl font-bold leading-tight hover:underline",
        ),
        Div(
            Div(preview, cls="prose prose-slate dark:prose-invert max-w-none"),
            A("continue reading...", href=href, cls="inline-flex mt-4 text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200 hover:underline"),
            cls="vyasa-task-card rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/45 p-5 shadow-sm min-w-0 w-full",
        ),
        cls="relative flex w-full items-start",
    )


def render_blog_home_feed(entries, root, offset=0, batch_size=4, wrap=True):
    cards = []
    chunk = entries[offset:offset + batch_size]
    for path, slug in chunk:
        cards.append(_render_blog_preview_card(path, slug, root))
    sentinel = Div(
        id="blog-feed-sentinel",
        cls="h-8",
        hx_get=f"/_home/feed?offset={offset + batch_size}",
        hx_trigger="revealed once",
        hx_target="this",
        hx_swap="outerHTML",
    ) if offset + batch_size < len(entries) else ""
    if wrap:
        return Div(*cards, sentinel, id="blog-feed", cls="space-y-4")
    return tuple([*cards, sentinel] if sentinel else cards)


def render_search_preview_feed(entries, root):
    cards = []
    for path in entries:
        slug = content_slug_for_path(path)
        if not slug:
            continue
        cards.append(_render_blog_preview_card(path, slug, root))
    return Div(*cards, cls="space-y-4", id="search-preview-feed")


def render_search_preview_page(htmx, request: Request, q: str = ""):
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
    sort = get_config().get_home_sort()
    items = list(entries)
    if sort == "name_asc":
        return sorted(items, key=lambda item: item[1].lower())
    if sort == "name_desc":
        return sorted(items, key=lambda item: item[1].lower(), reverse=True)
    return sorted(items, key=lambda item: get_file_created_ts(item[0]), reverse=True)

def _blog_home_is_ignored(path, root):
    relative = path.relative_to(root)
    ignore_names = set()
    ancestor = root
    ignore_names.update(str(item).strip() for item in (get_vyasa_config(root).get("ignore") or []) if str(item).strip())
    for part in relative.parts[:-1]:
        ancestor = ancestor / part
        ignore_names.update(str(item).strip() for item in (get_vyasa_config(ancestor).get("ignore") or []) if str(item).strip())
    candidates = set(relative.parts) | set(relative.with_suffix("").parts) | {path.name, path.stem}
    return bool(ignore_names.intersection(candidates))


def get_favicon_href():
    runtime = get_extension_runtime()
    provider = runtime.favicon_href_provider if runtime else None
    if provider:
        return provider(get_root_folder())
    return favicon_href(get_root_folder())


def _hljs_theme_href(theme_name: str) -> str:
    return f"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/{theme_name}.min.css"


hdrs = (
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
                    <svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 7h10"/>
                        <path d="M11 4l3 3-3 3"/>
                        <path d="M20 17H10"/>
                        <path d="M13 14l-3 3 3 3"/>
                        <path d="M17 7c1.8 0 3 1.2 3 3"/>
                        <path d="M7 17c-1.8 0-3-1.2-3-3"/>
                    </svg>
                </button>
            </div>
            """
        ),
        button,
        cls="relative z-[1200] flex items-center gap-2",
    )


def navbar(
    show_mobile_menus=False, htmx_nav=True, posts_menu_items=None, compact_mode=False, updated_label=None
):
    return navbar_view(get_blog_title(), theme_toggle(), show_mobile_menus, htmx_nav, posts_menu_items, compact_mode, updated_label)


def _posts_sidebar_fingerprint():
    try:
        return ContentTree.from_runtime().fingerprint()
    except Exception:
        return 0


def _find_search_matches(query, limit=40):
    return _find_search_matches_uncached(query, limit)


def _find_search_preview_matches(query, limit=200):
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


def _sidebar_row_decorators():
    runtime = get_extension_runtime()
    if not runtime:
        return ()
    return (*runtime.sidebar_row_decorators, _row_action_decorator(runtime.sidebar_action_registry()))


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
        row_base = "flex items-center gap-1 min-w-0" if context == "search" else "inline-flex items-center gap-1 w-max"
        row_cls = f"vyasa-action-row {'vyasa-bookmark-row ' if bookmark_row else ''}{row_base}"
        row_attrs = {}
        for action in actions:
            row_attrs.update(action.row_attrs)
        state_nodes = [
            Span(
                action.state_text or "",
                cls="vyasa-row-action-state ml-1 text-[0.68rem] opacity-70",
                **action.state_attrs,
            )
            for action in actions
            if action.state_text is not None or action.state_attrs
        ]
        buttons = [
            Button(
                Span(action.icon_text or "", cls=("vyasa-bookmark-glyph " if action.attrs.get("data_bookmark_toggle") == "true" else "") + "flex h-4 w-4 items-center justify-center text-sm", aria_hidden="true"),
                type="button",
                title=action.label,
                aria_label=action.label,
                data_action_id=action.id,
                cls=("vyasa-bookmark-toggle " if action.attrs.get("data_bookmark_toggle") == "true" else "") + "vyasa-row-action shrink-0 rounded p-1.5 text-slate-400 hover:text-amber-500 transition-colors",
                **action.attrs,
            )
            for action in actions
        ]
        return Span(node, *state_nodes, *buttons, cls=row_cls, **row_attrs)

    return decorate


def _render_posts_search_results(query, roles=None):
    trimmed = (query or "").strip()
    matches, regex_error = _find_search_matches(trimmed)
    matches = _filter_search_matches_by_roles(matches, roles)
    rendered_matches = [
        (slug, content_slug_for_path(item, strip_suffix=False) if item.suffix == ".pdf" else slug)
        for item in matches
        if (slug := content_slug_for_path(item))
    ]
    return render_posts_search_results(trimmed, rendered_matches, regex_error, row_decorators=_search_result_row_decorators())


@traced("sidebar")
@lru_cache(maxsize=16)
def _cached_posts_sidebar_html(fingerprint, roles_key, show_hidden, current_path=""):
    sidebars_open = get_config().get_sidebars_open()
    posts_items = get_posts(list(roles_key) if roles_key else [], current_path=current_path)
    extra_sections = _sidebar_section_nodes()
    sidebar = build_collapsible_sidebar(
        "menu",
        "Library",
        [],
        is_open=sidebars_open,
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
):
    extra_head_nodes = bundle_asset_nodes(
        route_bundle_names(
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
        extra_head_nodes=extra_head_nodes,
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
    )


_nav_entries_cache: dict[tuple[str, bool], tuple[float, list[Path]]] = {}


def _get_nav_entries(
    folder: Path, root: Path, show_hidden: bool, excluded_dirs: set[str]
):
    key = (str(folder.resolve()), show_hidden)
    try:
        mtime = folder.stat().st_mtime
    except OSError:
        return []
    cached = _nav_entries_cache.get(key)
    if cached and cached[0] == mtime:
        return cached[1]
    ordered = get_tree_entries(folder, root, show_hidden, excluded_dirs, (".md", ".pdf", ".tree"))
    _nav_entries_cache[key] = (mtime, ordered)
    return ordered


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
        excluded_dirs=set(get_config().get_reload_excludes()), get_nav_entries=_get_nav_entries,
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


def get_posts(roles=None, current_path=""):
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
