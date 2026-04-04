import re, os
import json
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
    _effective_ignore_list,
    _effective_include_list,
    _should_include_folder,
    find_folder_note_file,
    iter_visible_files,
    should_exclude_dir,
)
from .layout_helpers import (
    _resolve_layout_config,
    _width_class_and_style,
    _style_attr,
)
from .layout_page import render_layout
from .nav_views import navbar_view
from loguru import logger
from .assets import asset_url
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
from .collab_runtime import CollabRuntime
from .content_routes import (
    find_index_file as find_index_file_helper,
    render_drawing_detail,
    render_index,
    render_post_detail,
    render_slide_deck,
)
from .drawing_auth import (
    drawing_password_for,
    drawing_unlocked_in_session,
    unlock_drawing,
)
from .auth.oauth_bootstrap import build_google_oauth
from .page_views import not_found_content
from .rbac_config import normalize_rbac_cfg, render_rbac_toml, write_rbac_to_vyasa
from .rbac_store import load_rbac_cfg, write_rbac_cfg
from .search_service import (
    find_search_matches,
    normalize_search_text,
    parse_search_query,
)
from .search_pages import gather_search_content
from .search_http import gather_search_page
from .search_views import posts_search_block as build_posts_search_block, render_posts_search_results
from .sidebar_helpers import (
    build_toc_items as build_sidebar_toc_items,
    collapsible_sidebar as build_collapsible_sidebar,
    extract_toc as extract_sidebar_toc,
    get_custom_css_links as get_sidebar_custom_css_links,
)
from .markdown_rendering import from_md
from .tree_service import get_tree_entries
from .tree_rendering import (
    build_post_tree_render,
    folder_has_visible_descendant as tree_folder_has_visible_descendant,
)
from .favicon import favicon_href, favicon_svg
_asset_url = asset_url


# App configuration
def get_root_folder():
    return get_config().get_root_folder()


def get_blog_title():
    return get_config().get_blog_title()


def get_favicon_href():
    return favicon_href(get_root_folder())


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
        """
    ),
    *Theme.slate.headers(highlightjs=True),
    Link(rel="icon", href=get_favicon_href()),
    Script(src="https://unpkg.com/hyperscript.org@0.9.12"),
    Script(src=_asset_url("/static/scripts.js"), type="module"),
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


def _drawing_password_for(path: str):
    return drawing_password_for(get_root_folder(), path)


def _drawing_unlocked_in_session(session, path: str) -> bool:
    return drawing_unlocked_in_session(session, path)


def _drawing_unlocked(request: Request, path: str) -> bool:
    return _drawing_unlocked_in_session(request.session, path)


def _unlock_drawing(request: Request, path: str):
    unlock_drawing(request.session, path)


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


def _mount_package_static(app_instance):
    mount_package_static(app_instance, Path(__file__).parent)

rt = app.route


from starlette.requests import Request
from starlette.responses import RedirectResponse, FileResponse, Response
from starlette.websockets import WebSocket

_collab = CollabRuntime()


async def _collab_broadcast(room, payload, exclude=None):
    await _collab.broadcast(room, payload, exclude=exclude)


async def _collab_conn(ws: WebSocket):
    await _collab.connect(ws)


async def _collab_disconn(ws: WebSocket):
    await _collab.disconnect(ws)


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


@rt("/login", methods=["GET", "POST"])
async def login(request: Request):
    return await handle_login(
        request,
        get_config=get_config,
        logger=logger,
        local_auth_enabled=_local_auth_enabled,
        resolve_roles=resolve_roles,
        rbac_cfg=_rbac_cfg,
        google_oauth_cfg=_google_oauth_cfg,
        coerce_list=_config._coerce_list,
        login_content=login_content,
        google_oauth_enabled=_google_oauth_enabled,
    )


@rt("/login/google")
async def login_google(request: Request):
    if not _google_oauth_enabled:
        return Response(status_code=404)
    return await start_google_login(request, _google_oauth)


@rt("/auth/google/callback")
async def google_auth_callback(request: Request):
    if not _google_oauth_enabled:
        return Response(status_code=404)
    try:
        userinfo = await fetch_google_userinfo(request, _google_oauth, logger)
    except Exception as exc:
        logger.warning(f"Google OAuth failed: {exc}")
        return RedirectResponse(
            "/login?error=Google+authentication+failed", status_code=303
        )
    email = userinfo.get("email") if isinstance(userinfo, dict) else None
    if not google_account_allowed(email, _google_oauth_cfg):
        return RedirectResponse("/login?error=Google+account+not+allowed", status_code=303)
    auth = build_google_auth_payload(userinfo)
    auth["roles"] = resolve_roles(auth, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    request.session["auth"] = auth
    next_url = request.session.pop("next", "/")
    return RedirectResponse(next_url, status_code=303)


@rt("/logout")
async def logout(request: Request):
    request.session.pop("auth", None)
    request.session.pop("next", None)
    return RedirectResponse("/login", status_code=303)


@rt("/admin/impersonate", methods=["GET", "POST"])
async def admin_impersonate(htmx, request: Request):
    return await handle_admin_impersonate(
        htmx,
        request,
        get_auth_from_request=get_auth_from_request,
        rbac_rules=_rbac_rules,
        rbac_cfg=_rbac_cfg,
        google_oauth_cfg=_google_oauth_cfg,
        coerce_list=_config._coerce_list,
        apply_impersonation_action=apply_impersonation_action,
        resolve_roles=resolve_roles,
        layout=layout,
        impersonate_content=impersonate_content,
    )


@rt("/admin/rbac", methods=["GET", "POST"])
async def admin_rbac(htmx, request: Request):
    return await handle_admin_rbac(
        htmx,
        request,
        get_auth_from_request=get_auth_from_request,
        rbac_rules=_rbac_rules,
        rbac_cfg=_rbac_cfg,
        google_oauth_cfg=_google_oauth_cfg,
        coerce_list=_config._coerce_list,
        parse_rbac_form=parse_rbac_form,
        parse_roles_text=parse_roles_text,
        rbac_db_write=_rbac_db_write,
        write_rbac_to_vyasa=_write_rbac_to_vyasa,
        set_rbac_cfg=_set_rbac_cfg,
        cached_build_post_tree=_cached_build_post_tree,
        cached_posts_sidebar_html=_cached_posts_sidebar_html,
        render_rbac_toml=_render_rbac_toml,
        rbac_admin_content=rbac_admin_content,
        layout=layout,
    )


# Progressive sidebar loading: lazy posts sidebar endpoint
@rt("/_sidebar/posts")
def posts_sidebar_lazy(request: Request = None, current_path: str = ""):
    roles = get_roles_from_request(request, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    html = _cached_posts_sidebar_html(
        _posts_sidebar_fingerprint(),
        tuple(roles or []),
        get_config().get_show_hidden(),
        current_path or "",
    )
    return Aside(
        NotStr(html),
        cls="hidden xl:block w-72 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-x-auto overflow-y-hidden z-[1000]",
        id="posts-sidebar",
    )


@rt("/_sidebar/posts/branch")
def posts_sidebar_branch(path: str = "", request: Request = None):
    roles = get_roles_from_request(request, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    folder = (get_root_folder() / path).resolve()
    root = get_root_folder().resolve()
    if not folder.is_dir() or not str(folder).startswith(str(root)):
        logger.debug("Sidebar branch invalid path={}", path)
        return Response(status_code=404)
    items = build_post_tree(folder, roles=roles, max_depth=0)
    logger.debug(
        "Sidebar branch path={} resolved={} items={}", path, folder, len(items)
    )
    return "".join(to_xml(item) for item in items)


# Route to serve raw markdown for LLM-friendly access
@rt("/posts/{path:path}.md")
def serve_post_markdown(path: str):
    from starlette.responses import FileResponse

    file_path = get_root_folder() / f"{path}.md"
    if file_path.exists():
        return FileResponse(file_path, media_type="text/markdown; charset=utf-8")
    return Response(status_code=404)


@rt("/search/gather")
def gather_search_results(htmx, q: str = "", request: Request = None):
    return gather_search_page(
        htmx,
        q=q,
        request=request,
        find_search_matches=_find_search_matches,
        get_roles_from_request=get_roles_from_request,
        rbac_rules=_rbac_rules,
        rbac_cfg=_rbac_cfg,
        google_oauth_cfg=_google_oauth_cfg,
        coerce_list=_config._coerce_list,
        get_root_folder=get_root_folder,
        is_allowed=is_allowed,
        gather_search_content=gather_search_content,
        layout=layout,
    )


# Route to serve static files (images, SVGs, etc.) from blog posts
@rt("/posts/{path:path}.{ext:static}")
def serve_post_static(path: str, ext: str):
    from starlette.responses import FileResponse

    file_path = get_root_folder() / f"{path}.{ext}"
    if file_path.exists():
        return FileResponse(file_path)
    return Response(status_code=404)


# Serve JSON attachments from blog posts (not included in fasthtml static exts)
@rt("/posts/{path:path}.json")
def serve_post_json(path: str):
    from starlette.responses import FileResponse

    file_path = get_root_folder() / f"{path}.json"
    if file_path.exists():
        return FileResponse(
            file_path,
            headers={"Content-Disposition": f'attachment; filename="{file_path.name}"'},
        )
    return Response(status_code=404)


@rt("/posts/{path:path}.excalidraw")
def serve_post_excalidraw(path: str):
    from starlette.responses import FileResponse

    file_path = get_root_folder() / f"{path}.excalidraw"
    if file_path.exists():
        return FileResponse(file_path, media_type="application/json; charset=utf-8")
    return Response(status_code=404)


@rt("/api/excalidraw/unlock/{path:path}", methods=["POST"])
async def unlock_excalidraw(path: str, request: Request):
    expected = _drawing_password_for(path)
    if not expected:
        return Response('{"ok":true,"unlocked":true}', media_type="application/json")
    try:
        body = await request.body()
        payload = json.loads(body.decode("utf-8")) if body else {}
    except Exception:
        return Response("Invalid JSON", status_code=400)
    if (payload.get("password") or "") != expected:
        return Response("Forbidden", status_code=403)
    _unlock_drawing(request, path)
    return Response('{"ok":true,"unlocked":true}', media_type="application/json")


@rt("/api/excalidraw/{path:path}", methods=["PUT"])
async def save_excalidraw(path: str, request: Request):
    root = get_root_folder().resolve()
    file_path = (root / f"{path}.excalidraw").resolve()
    if not str(file_path).startswith(str(root) + os.sep):
        return Response(status_code=403)
    if _drawing_password_for(path) and not _drawing_unlocked(request, path):
        return Response("Forbidden", status_code=403)
    roles = get_roles_from_request(request, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    if roles is not None and not is_allowed(f"/posts/{path}", roles or [], _rbac_rules):
        return Response("Forbidden", status_code=403)
    try:
        payload = await request.body()
        parsed = json.loads(payload.decode("utf-8"))
        if not isinstance(parsed, dict):
            return Response("Expected a JSON object", status_code=400)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(
            json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except json.JSONDecodeError:
        return Response("Invalid JSON", status_code=400)
    except Exception as exc:
        logger.warning(f"Failed to save excalidraw file '{path}': {exc}")
        return Response("Save failed", status_code=500)
    return Response('{"ok":true}', media_type="application/json")


@app.ws("/ws/excalidraw/{path:path}", conn=_collab_conn, disconn=_collab_disconn)
async def excalidraw_collab(ws: WebSocket, data: dict):
    room = ws.path_params.get("path", "")
    kind = data.get("type")
    if kind == "scene":
        if _drawing_password_for(room) and not _drawing_unlocked_in_session(
            ws.scope.get("session"), room
        ):
            return
        scene = data.get("scene")
        async with _collab.lock:
            _collab.scenes[room] = scene
        await _collab_broadcast(
            room,
            {"type": "scene", "room": room, "scene": scene},
            exclude=ws,
        )
    elif kind == "presence":
        pid = (data.get("presence") or {}).get("id")
        if pid:
            ws.scope["collab_id"] = pid
        await _collab_broadcast(
            room,
            {"type": "presence", "room": room, "presence": data.get("presence")},
            exclude=ws,
        )


# Generic download route for any file under the blog root
@rt("/download/{path:path}")
def download_file(path: str):
    from starlette.responses import FileResponse

    root = get_root_folder().resolve()
    file_path = (root / path).resolve()
    if not str(file_path).startswith(str(root) + os.sep):
        return Response(status_code=403)
    if file_path.exists() and file_path.is_file():
        return FileResponse(
            file_path,
            headers={"Content-Disposition": f'attachment; filename="{file_path.name}"'},
        )
    return Response(status_code=404)


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
        cls="p-1 hover:scale-110 shadow-none",
        type="button",
    )
    cfg = get_config()
    if not cfg.get_theme_debug():
        return button
    active = cfg.get_theme_preset() or ""
    presets = {name: cfg.load_theme_preset(name) for name in cfg.list_theme_presets()}
    menu_items = "".join(
        f'<button type="button" data-theme-name="{name}" '
        f'onclick="window.vyasaApplyThemePreset && window.vyasaApplyThemePreset(this.dataset.themeName, this)" '
        f'class="theme-preset-option block w-full rounded px-3 py-2 text-left hover:bg-white/10">{name}</button>'
        for name in presets
    )
    return Div(
        Script(f"window.__VYASA_THEME_PRESETS__ = {json.dumps(presets)};"),
        NotStr(
            f"""
            <div class="flex items-center gap-2" data-theme-switcher>
                <div id="theme-preset-dropdown" class="relative min-w-44" style="position:relative;min-width:11rem;">
                    <button type="button" id="theme-preset-toggle"
                        onclick="window.vyasaToggleThemePresetMenu && window.vyasaToggleThemePresetMenu(this)"
                        class="flex w-full items-center justify-between rounded-md bg-slate-950/70 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10">
                        <span id="theme-preset-active-label" class="truncate">{active or "Theme"}</span>
                        <span class="ml-3 text-slate-300">⌄</span>
                    </button>
                    <div id="theme-preset-menu" style="display:none;position:absolute;left:0;top:calc(100% + 0.5rem);z-index:1400;max-height:18rem;width:16rem;overflow-y:auto;border-radius:0.375rem;background:rgba(2,6,23,0.95);padding:0.25rem;box-shadow:0 10px 30px rgba(15,23,42,0.35);border:1px solid rgba(255,255,255,0.1);">
                        {menu_items}
                    </div>
                </div>
                <button type="button" title="Random theme font"
                    onclick="window.vyasaApplyRandomThemePreset && window.vyasaApplyRandomThemePreset(this)"
                    class="rounded-md bg-slate-950/70 px-3 py-2 text-slate-100 ring-1 ring-white/10 hover:bg-slate-900/80">
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
    show_mobile_menus=False, htmx_nav=True, posts_menu_items=None, compact_mode=False
):
    return navbar_view(get_blog_title(), theme_toggle(), show_mobile_menus, htmx_nav, posts_menu_items, compact_mode)


def _posts_sidebar_fingerprint():
    root = get_root_folder()
    try:
        md_mtime = max(
            (
                p.stat().st_mtime
                for p in iter_visible_files(
                    root, (".md",), get_config().get_show_hidden()
                )
            ),
            default=0,
        )
        pdf_mtime = max(
            (
                p.stat().st_mtime
                for p in iter_visible_files(
                    root, (".pdf",), get_config().get_show_hidden()
                )
            ),
            default=0,
        )
        excalidraw_mtime = max(
            (p.stat().st_mtime for p in root.rglob("*.excalidraw")), default=0
        )
        return max(md_mtime, pdf_mtime, excalidraw_mtime)
    except Exception:
        return 0


def _find_search_matches(query, limit=40):
    return find_search_matches(
        query,
        limit,
        _posts_sidebar_fingerprint(),
        get_config().get_show_hidden(),
        _find_search_matches_uncached,
    )


def _find_search_matches_uncached(query, limit=40):
    trimmed = (query or "").strip()
    if not trimmed:
        return [], ""
    regex, regex_error = parse_search_query(trimmed)
    query_norm = normalize_search_text(trimmed) if not regex else ""
    root = get_root_folder()
    show_hidden = get_config().get_show_hidden()
    index_file = find_index_file()
    ignore_list = _effective_ignore_list(root)
    include_list = _effective_include_list(root)
    results = []
    for item in iter_visible_files(root, (".md", ".pdf"), show_hidden):
        if not show_hidden and any(
            part.startswith(".") for part in item.relative_to(root).parts
        ):
            continue
        if ".vyasa" in item.parts:
            continue
        # Check if any folder in path should be excluded based on include/ignore lists
        path_parts = item.relative_to(root).parts[:-1]  # Exclude filename
        should_skip = False
        for part in path_parts:
            if not _should_include_folder(part, include_list, ignore_list):
                should_skip = True
                break
        if should_skip:
            continue
        if index_file and item.resolve() == index_file.resolve():
            continue
        rel = item.relative_to(root).with_suffix("")
        if regex:
            haystack = f"{item.name} {rel.as_posix()}"
            is_match = regex.search(haystack)
        else:
            haystack = normalize_search_text(f"{item.name} {rel.as_posix()}")
            is_match = query_norm in haystack
        if is_match:
            results.append(item)
            if len(results) >= limit:
                break
    return tuple(results), regex_error


def _render_posts_search_results(query, roles=None):
    trimmed = (query or "").strip()
    matches, regex_error = _find_search_matches(trimmed)
    if roles is not None:
        root = get_root_folder()
        filtered = []
        for item in matches:
            slug = item.relative_to(root).with_suffix("")
            if is_allowed(f"/posts/{slug}", roles or [], _rbac_rules):
                filtered.append(item)
        matches = filtered
    root = get_root_folder()
    rendered_matches = [(str(item.relative_to(root).with_suffix("")), item.relative_to(root).as_posix() if item.suffix == ".pdf" else item.relative_to(root).with_suffix("").as_posix()) for item in matches]
    return render_posts_search_results(trimmed, rendered_matches, regex_error)


def _posts_search_block():
    return build_posts_search_block(_render_posts_search_results(""))


@lru_cache(maxsize=16)
def _cached_posts_sidebar_html(fingerprint, roles_key, show_hidden, current_path=""):
    sidebars_open = get_config().get_sidebars_open()
    sidebar = build_collapsible_sidebar(
        "menu",
        "Library",
        get_posts(list(roles_key) if roles_key else [], current_path=current_path),
        is_open=sidebars_open,
        data_sidebar="posts",
        shortcut_key="Z",
        extra_content=[
            _posts_search_block(),
            Div(cls="h-px w-full bg-slate-200/80 dark:bg-slate-700/70 my-2"),
            Div(
                "Posts",
                cls="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1",
            ),
        ],
        scroll_target="list",
    )
    return to_xml(sidebar)


def _log_startup_content_stats():
    root = get_root_folder()
    show_hidden = get_config().get_show_hidden()
    excludes = get_config().get_reload_excludes()
    md_count = sum(1 for _ in iter_visible_files(root, (".md",), show_hidden))
    pdf_count = sum(1 for _ in iter_visible_files(root, (".pdf",), show_hidden))
    excalidraw_count = sum(
        1 for _ in iter_visible_files(root, (".excalidraw",), show_hidden)
    )
    vyasa_count = sum(1 for _ in iter_visible_files(root, (".vyasa",), True))
    logger.info(
        "Startup scan root={} show_hidden={} md={} pdf={} excalidraw={} vyasa={} excludes={}",
        root,
        show_hidden,
        md_count,
        pdf_count,
        excalidraw_count,
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


@rt("/_sidebar/posts/search")
def posts_sidebar_search(q: str = "", request: Request = None):
    roles = get_roles_from_request(request, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    return _render_posts_search_results(q, roles=roles)


def is_active_toc_item(anchor):
    """Check if a TOC item is currently active based on URL hash"""
    # This will be enhanced client-side with JavaScript
    return False


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
):
    return render_layout(
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
    ordered = get_tree_entries(
        folder, root, show_hidden, excluded_dirs, (".md", ".pdf", ".excalidraw")
    )
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
        rbac_rules=_rbac_rules, logger=logger,
    )


def _posts_tree_fingerprint():
    root = get_root_folder()
    try:
        md_mtime = max(
            (
                p.stat().st_mtime
                for p in iter_visible_files(
                    root, (".md",), get_config().get_show_hidden()
                )
            ),
            default=0,
        )
        pdf_mtime = max(
            (
                p.stat().st_mtime
                for p in iter_visible_files(
                    root, (".pdf",), get_config().get_show_hidden()
                )
            ),
            default=0,
        )
        excalidraw_mtime = max(
            (p.stat().st_mtime for p in root.rglob("*.excalidraw")), default=0
        )
        vyasa_mtime = max((p.stat().st_mtime for p in root.rglob(".vyasa")), default=0)
        return max(md_mtime, pdf_mtime, excalidraw_mtime, vyasa_mtime)
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


def not_found(htmx=None, auth=None):
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


@rt("/drawings/{path:path}")
def drawing_detail(path: str, htmx, request: Request):
    return render_drawing_detail(
        path,
        htmx,
        request,
        get_root_folder=get_root_folder,
        not_found=not_found,
        get_roles_from_request=get_roles_from_request,
        rbac_rules=_rbac_rules,
        rbac_cfg=_rbac_cfg,
        google_oauth_cfg=_google_oauth_cfg,
        coerce_list=_config._coerce_list,
        is_allowed=is_allowed,
        slug_to_title=slug_to_title,
        effective_abbreviations=_effective_abbreviations,
        drawing_password_for=_drawing_password_for,
        get_blog_title=get_blog_title,
        layout=layout,
    )


@rt("/slides/{path:path}")
def slide_deck(path: str, htmx, request: Request):
    return render_slide_deck(
        path,
        htmx,
        request,
        get_root_folder=get_root_folder,
        not_found=not_found,
        get_roles_from_auth=get_roles_from_auth,
        rbac_rules=_rbac_rules,
        rbac_cfg=_rbac_cfg,
        google_oauth_cfg=_google_oauth_cfg,
        coerce_list=_config._coerce_list,
        is_allowed=is_allowed,
        parse_frontmatter=parse_frontmatter,
        slug_to_title=slug_to_title,
        effective_abbreviations=_effective_abbreviations,
        from_md=from_md,
        layout=layout,
    )


def find_index_file():
    return find_index_file_helper(get_root_folder)


@rt
def index(htmx, request: Request):
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


# Catch-all route for 404 pages (must be last)
@rt("/{path:path}")
def catch_all(path: str, htmx, request: Request):
    """Catch-all route for undefined URLs"""
    return not_found(htmx, auth=request.scope.get("auth"))
