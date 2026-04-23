import re, os
import json
import base64
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
    _effective_ignore_list,
    _effective_include_list,
    get_vyasa_config,
    _should_include_folder,
    find_folder_note_file,
    content_path_for_slug,
    content_root_and_relative,
    content_slug_for_path,
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
from .annotations_store import AnnotationRow, delete_annotation, get_annotations_table, list_annotations, upsert_annotation
from .bookmark_store import bookmark_owner_from_auth, delete_bookmark, list_bookmarks, upsert_bookmark
from .bookmark_views import bookmarks_block
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
from .search_views import (
    posts_search_block as build_posts_search_block,
    render_posts_search_results,
)
from .sidebar_helpers import (
    build_toc_items as build_sidebar_toc_items,
    collapsible_sidebar as build_collapsible_sidebar,
    extract_toc as extract_sidebar_toc,
    get_custom_css_links as get_sidebar_custom_css_links,
    sidebar_section,
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


def render_blog_home(htmx, request: Request):
    roots = get_content_mounts()
    root = roots[0][1] if roots else get_root_folder()
    roles = get_roles_from_auth(request.scope.get("auth"), _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    entries = _sort_blog_home_entries(iter_blog_home_files(roots, roles), root)
    feed = render_blog_home_feed(entries, root, 0)
    shell = Div(H1(f"Welcome to {get_blog_title()}!", cls="vyasa-page-title text-4xl font-bold"), P("Latest posts", cls="mt-2 text-slate-500"), feed, cls="space-y-6")
    return layout(shell, htmx=htmx, title=f"Home - {get_blog_title()}", show_sidebar=True, current_path="__home__", auth=request.scope.get("auth"))


def _render_blog_preview_card(path, slug, root):
    title, render_content = resolve_markdown_title(path, abbreviations=_effective_abbreviations(root))
    preview = from_md(preview_markdown(render_content), current_path=slug)
    return Div(
        A(title, href=f"/posts/{slug}", cls="vyasa-blog-card-title absolute -left-56 top-6 block w-56 text-left text-3xl font-bold leading-tight hover:underline line-clamp-3 overflow-hidden"),
        Div(
            Div(preview, cls="prose prose-slate dark:prose-invert max-w-none"),
            A("continue reading...", href=f"/posts/{slug}", cls="inline-flex mt-4 text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200 hover:underline"),
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
    Link(rel="stylesheet", href=_hljs_theme_href(get_config().get_code_theme_light()), id="hljs-light", data_default_theme=get_config().get_code_theme_light()),
    Link(rel="stylesheet", href=_hljs_theme_href(get_config().get_code_theme_dark()), id="hljs-dark", data_default_theme=get_config().get_code_theme_dark()),
    Script(src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"),
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
        .vyasa-table-scroll th, .vyasa-table-scroll td { max-width: var(--vyasa-table-col-max, 33vw); white-space: normal; overflow-wrap: anywhere; word-break: normal; }
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
_annotations_store_cache = {"db": None, "tbl": None}
_bookmark_store_cache = {"db": None, "tbl": None}


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


def _annotations_db_list(path: str):
    return list_annotations(get_config().get_root_folder(), _annotations_store_cache, path)


def _annotations_db_upsert(row):
    upsert_annotation(get_config().get_root_folder(), _annotations_store_cache, row)


def _annotations_db_delete(annotation_id: str):
    return delete_annotation(get_config().get_root_folder(), _annotations_store_cache, annotation_id)


def _bookmarks_db_list(owner: str):
    return list_bookmarks(get_config().get_root_folder(), _bookmark_store_cache, owner)


def _bookmarks_db_upsert(owner: str, path: str):
    upsert_bookmark(
        get_config().get_root_folder(),
        _bookmark_store_cache,
        owner,
        path,
        datetime.utcnow().isoformat(),
    )


def _bookmarks_db_delete(owner: str, path: str):
    return delete_bookmark(get_config().get_root_folder(), _bookmark_store_cache, owner, path)


def _resolve_bookmark_items(owner: str, roles):
    items = []
    root = get_root_folder()
    for row in _bookmarks_db_list(owner):
        slug = (row.path or "").strip("/")
        path = content_path_for_slug(slug, ".md") or content_path_for_slug(slug, ".pdf")
        if not slug or not path or path.suffix not in {".md", ".pdf"}:
            continue
        if not is_allowed(f"/posts/{slug}", roles or [], _rbac_rules):
            continue
        abbreviations = _effective_abbreviations(root, path.parent)
        if path.suffix == ".md":
            metadata, _ = parse_frontmatter(path)
            title = metadata.get("title", slug_to_title(path.stem, abbreviations=abbreviations))
        else:
            title = slug_to_title(path.stem, abbreviations=abbreviations)
        items.append({"path": slug, "href": f"/posts/{slug}", "title": title})
    return items


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
    root, rel = content_root_and_relative(path)
    if root is None:
        return None
    return drawing_password_for(root, rel.as_posix())


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
        cls="hidden xl:block w-[var(--vyasa-sidebar-width,26rem)] shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-x-auto overflow-y-hidden z-[1000]",
        id="posts-sidebar",
    )


@rt("/_sidebar/posts/branch")
def posts_sidebar_branch(path: str = "", request: Request = None):
    roles = get_roles_from_request(request, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    folder = content_path_for_slug(path)
    if not folder or not folder.is_dir():
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

    file_path = content_path_for_slug(path, ".md")
    if file_path and file_path.exists():
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


@rt("/search/preview")
def search_preview_results(htmx, q: str = "", request: Request = None):
    return render_search_preview_page(htmx, request, q=q)


@rt("/search/preview/s/{query_token}")
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


# Route to serve static files (images, SVGs, etc.) from blog posts
@rt("/posts/{path:path}.{ext:static}")
def serve_post_static(path: str, ext: str):
    from starlette.responses import FileResponse

    file_path = content_path_for_slug(path, f".{ext}")
    if file_path and file_path.exists():
        return FileResponse(file_path)
    return Response(status_code=404)


# Serve JSON attachments from blog posts (not included in fasthtml static exts)
@rt("/posts/{path:path}.json")
def serve_post_json(path: str):
    from starlette.responses import FileResponse

    file_path = content_path_for_slug(path, ".json")
    if file_path and file_path.exists():
        return FileResponse(
            file_path,
            headers={"Content-Disposition": f'attachment; filename="{file_path.name}"'},
        )
    return Response(status_code=404)


@rt("/posts/{path:path}.excalidraw")
def serve_post_excalidraw(path: str):
    from starlette.responses import FileResponse

    file_path = content_path_for_slug(path, ".excalidraw")
    if file_path and file_path.exists():
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
    file_path = content_path_for_slug(path, ".excalidraw")
    if not file_path:
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


@rt("/api/annotations/{path:path}", methods=["GET"])
async def get_annotations(path: str, request: Request):
    if not _config.get_annotations_enabled():
        return Response("Not Found", status_code=404)
    roles = get_roles_from_request(request, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    if roles is not None and not is_allowed(f"/posts/{path}", roles or [], _rbac_rules):
        return Response("Forbidden", status_code=403)
    rows = _annotations_db_list(path)
    payload = [
        {
            "id": row.id, "path": row.path, "parent_id": getattr(row, "parent_id", ""), "quote": row.quote, "prefix": row.prefix, "suffix": row.suffix, "anchor": getattr(row, "anchor", ""),
            "comment": row.comment, "author": row.author, "created_at": row.created_at, "updated_at": row.updated_at,
        }
        for row in rows
    ]
    return Response(json.dumps(payload), media_type="application/json")


@rt("/api/annotations/{path:path}", methods=["POST"])
async def save_annotation(path: str, request: Request):
    if not _config.get_annotations_enabled():
        return Response("Not Found", status_code=404)
    roles = get_roles_from_request(request, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    if roles is not None and not is_allowed(f"/posts/{path}", roles or [], _rbac_rules):
        return Response("Forbidden", status_code=403)
    try:
        payload = json.loads((await request.body()).decode("utf-8"))
    except Exception:
        return Response("Invalid JSON", status_code=400)
    if not isinstance(payload, dict):
        return Response("Expected JSON object", status_code=400)
    auth = get_auth_from_request(request, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list) or {}
    author = auth.get("name") or auth.get("email") or auth.get("username") or "anonymous"
    now = payload.get("updated_at") or __import__("datetime").datetime.utcnow().isoformat()
    row = AnnotationRow(
        id=str(payload.get("id") or ""),
        path=path.strip("/"),
        parent_id=str(payload.get("parent_id") or ""),
        quote=str(payload.get("quote") or ""),
        prefix=str(payload.get("prefix") or ""),
        suffix=str(payload.get("suffix") or ""),
        anchor=json.dumps(payload.get("anchor") or {}),
        comment=str(payload.get("comment") or ""),
        author=author,
        created_at=str(payload.get("created_at") or now),
        updated_at=str(now),
    )
    if not row.id or not row.comment:
        return Response("Missing annotation fields", status_code=400)
    _annotations_db_upsert(row)
    return Response(json.dumps({"ok": True, "author": author}), media_type="application/json")


@rt("/api/annotations/{path:path}/{annotation_id}", methods=["DELETE"])
async def remove_annotation(path: str, annotation_id: str, request: Request):
    if not _config.get_annotations_enabled():
        return Response("Not Found", status_code=404)
    roles = get_roles_from_request(request, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    if roles is not None and not is_allowed(f"/posts/{path}", roles or [], _rbac_rules):
        return Response("Forbidden", status_code=403)
    rows = _annotations_db_list(path)
    ids = {annotation_id}
    changed = True
    while changed:
        changed = False
        for row in rows:
            if getattr(row, "parent_id", "") in ids and row.id not in ids:
                ids.add(row.id)
                changed = True
    ok = False
    for item_id in ids:
        ok = _annotations_db_delete(item_id) or ok
    return Response(json.dumps({"ok": ok}), media_type="application/json")


@rt("/api/bookmarks", methods=["GET"])
async def get_bookmarks(request: Request):
    auth = get_auth_from_request(request, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list) or {}
    owner = bookmark_owner_from_auth(auth)
    logger.info(f"[BOOKMARKS][GET] auth={auth} owner={owner!r}")
    if not owner:
        return Response(json.dumps({"items": [], "mode": "local"}), media_type="application/json", headers={"Cache-Control": "no-store"})
    roles = get_roles_from_request(request, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    db_rows = [(row.owner, row.path, row.created_at) for row in _bookmarks_db_list(owner)]
    items = _resolve_bookmark_items(owner, roles)
    logger.info(f"[BOOKMARKS][GET] owner={owner!r} roles={roles} db_rows={db_rows} returned={[item['path'] for item in items]}")
    return Response(json.dumps({"items": items, "mode": "server"}), media_type="application/json", headers={"Cache-Control": "no-store"})


@rt("/api/bookmarks/{path:path}", methods=["PUT"])
async def save_bookmark(path: str, request: Request):
    auth = get_auth_from_request(request, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list) or {}
    owner = bookmark_owner_from_auth(auth)
    logger.info(f"[BOOKMARKS][PUT] path={path!r} auth={auth} owner={owner!r}")
    if not owner:
        return Response("Unauthorized", status_code=401)
    slug = str(path or "").strip("/")
    if not content_path_for_slug(slug, ".md") and not content_path_for_slug(slug, ".pdf"):
        return Response("Not Found", status_code=404)
    roles = get_roles_from_request(request, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list)
    if not is_allowed(f"/posts/{slug}", roles or [], _rbac_rules):
        return Response("Forbidden", status_code=403)
    _bookmarks_db_upsert(owner, slug)
    logger.info(f"[BOOKMARKS][PUT] owner={owner!r} saved={slug!r} db_rows={[(row.owner, row.path) for row in _bookmarks_db_list(owner)]}")
    return Response(json.dumps({"ok": True}), media_type="application/json", headers={"Cache-Control": "no-store"})


@rt("/api/bookmarks/{path:path}", methods=["DELETE"])
async def remove_bookmark(path: str, request: Request):
    auth = get_auth_from_request(request, _rbac_rules, _rbac_cfg, _google_oauth_cfg, _config._coerce_list) or {}
    owner = bookmark_owner_from_auth(auth)
    if not owner:
        return Response("Unauthorized", status_code=401)
    return Response(json.dumps({"ok": _bookmarks_db_delete(owner, path)}), media_type="application/json", headers={"Cache-Control": "no-store"})


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

    file_path = content_path_for_slug(path)
    if not file_path:
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
        cls="vyasa-emphasis-control vyasa-emphasis-control-icon p-1 hover:scale-110 shadow-none",
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
        f'class="theme-preset-option vyasa-emphasis-control-option block w-full rounded px-3 py-2 text-left">{name}</button>'
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
    show_mobile_menus=False, htmx_nav=True, posts_menu_items=None, compact_mode=False
):
    return navbar_view(get_blog_title(), theme_toggle(), show_mobile_menus, htmx_nav, posts_menu_items, compact_mode)


def _posts_sidebar_fingerprint():
    try:
        mtimes = []
        for _, root in get_content_mounts():
            for suffix in (".md", ".pdf", ".excalidraw", ".vyasa"):
                mtimes.extend(p.stat().st_mtime for p in iter_visible_files(root, (suffix,), True))
        return max(mtimes, default=0)
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


def _find_search_preview_matches(query, limit=200):
    return find_search_matches(
        query,
        limit,
        _posts_sidebar_fingerprint(),
        get_config().get_show_hidden(),
        _find_search_preview_matches_uncached,
    )


def _find_search_candidates(query, limit=40, *, suffixes=(".md", ".pdf")):
    trimmed = (query or "").strip()
    if not trimmed:
        return [], ""
    regex, regex_error = parse_search_query(trimmed)
    query_norm = normalize_search_text(trimmed) if not regex else ""
    show_hidden = get_config().get_show_hidden()
    results = []
    for _, root in get_content_mounts():
        ignore_list = _effective_ignore_list(root)
        include_list = _effective_include_list(root)
        for item in iter_visible_files(root, suffixes, show_hidden):
            rel_parts = item.relative_to(root).parts
            if ".vyasa" in rel_parts:
                continue
            if any(not _should_include_folder(part, include_list, ignore_list) for part in rel_parts[:-1]):
                continue
            rel = content_slug_for_path(item)
            if not rel:
                continue
            haystack = f"{item.name} {rel}" if regex else normalize_search_text(f"{item.name} {rel}")
            is_match = bool(regex.search(haystack)) if regex else query_norm in haystack
            if is_match:
                results.append(item)
                if len(results) >= limit:
                    return tuple(results), regex_error
    return tuple(results), regex_error


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


def _render_posts_search_results(query, roles=None):
    trimmed = (query or "").strip()
    matches, regex_error = _find_search_matches(trimmed)
    matches = _filter_search_matches_by_roles(matches, roles)
    rendered_matches = [
        (slug, content_slug_for_path(item, strip_suffix=False) if item.suffix == ".pdf" else slug)
        for item in matches
        if (slug := content_slug_for_path(item))
    ]
    return render_posts_search_results(trimmed, rendered_matches, regex_error)


def _posts_search_block():
    return build_posts_search_block(_render_posts_search_results(""))


@lru_cache(maxsize=16)
def _cached_posts_sidebar_html(fingerprint, roles_key, show_hidden, current_path=""):
    sidebars_open = get_config().get_sidebars_open()
    posts_items = get_posts(list(roles_key) if roles_key else [], current_path=current_path)
    sidebar = build_collapsible_sidebar(
        "menu",
        "Library",
        [],
        is_open=sidebars_open,
        data_sidebar="posts",
        shortcut_key="Z",
        extra_content=[
            sidebar_section("Filter", _posts_search_block(), is_open=True, data_section="filter", body_cls="pt-1"),
            sidebar_section("Bookmarks", bookmarks_block(), is_open=True, data_section="bookmarks", body_cls="pt-1"),
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
    excalidraw_count = sum(1 for _, root in roots for _ in iter_visible_files(root, (".excalidraw",), show_hidden))
    vyasa_count = sum(1 for _, root in roots for _ in iter_visible_files(root, (".vyasa",), True))
    logger.info(
        "Startup scan root={} show_hidden={} md={} pdf={} excalidraw={} vyasa={} excludes={}",
        [str(root) for _, root in roots],
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
    slide_mode=False,
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
        slide_mode=slide_mode,
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
    try:
        mtimes = []
        for _, root in get_content_mounts():
            for suffix in (".md", ".pdf", ".excalidraw", ".vyasa"):
                mtimes.extend(p.stat().st_mtime for p in iter_visible_files(root, (suffix,), True))
        return max(mtimes, default=0)
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
        resolve_markdown_title=resolve_markdown_title,
        slug_to_title=slug_to_title,
        effective_abbreviations=_effective_abbreviations,
        from_md=from_md,
        layout=layout,
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
