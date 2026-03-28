import time
import re
from urllib.parse import quote

from fasthtml.common import A, Aside, Button, Div, Footer, Main, NotStr, P, Span, Title
from monsterui.all import UkIcon


def _section_class(current_path):
    if not current_path:
        return ""
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", current_path).strip("-").lower()
    return f"section-{slug}" if slug else ""


def render_layout(*content, htmx, title=None, show_sidebar=False, toc_content=None, current_path=None, show_toc=True, auth=None, htmx_nav=True, nav_posts_menu=False, full_width=False, show_footer=True, no_scroll=False, logger, resolve_layout_config, width_class_and_style, style_attr, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar, get_roles_from_auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, cached_posts_sidebar_html, posts_sidebar_fingerprint, get_posts, navbar):
    layout_start_time = time.time()
    logger.debug("[LAYOUT] layout() start")
    section_class = _section_class(current_path)
    t_section = time.time()
    logger.debug(f"[LAYOUT] section_class computed in {(t_section - layout_start_time)*1000:.2f}ms")
    layout_config = resolve_layout_config(current_path)
    layout_max_class, layout_max_style = width_class_and_style(layout_config.get("layout_max_width"), "max")
    layout_fluid_class = "layout-fluid" if layout_max_style else ""
    if full_width:
        layout_max_class = layout_max_style = layout_fluid_class = ""
    main_spacing_cls = "px-0 py-0" if no_scroll else "px-6 py-8"
    page_container_cls = "flex flex-col h-screen overflow-hidden" if no_scroll else "flex flex-col min-h-screen"
    navbar_margin_cls = "mt-0" if no_scroll else "mt-4"

    def _footer_node(outer_cls, outer_style):
        logout_button = None
        if auth:
            display_name = auth.get("name") or auth.get("email") or auth.get("username") or "User"
            impersonator = auth.get("impersonator")
            if impersonator:
                original = impersonator.get("name") or impersonator.get("email") or impersonator.get("username") or "User"
                display_name = f"Impersonating {display_name} (as {original})"
            logout_button = A(f"Logout {display_name}", href="/logout", cls="text-sm text-white/80 hover:text-white underline")
        footer_inner = Div(Div(logout_button, cls="flex items-center") if logout_button else Div(), Div(NotStr('Powered by <a href="https://github.com/sizhky/vyasa" class="underline hover:text-white/80" target="_blank" rel="noopener noreferrer">Vyasa</a> and ❤️')), cls="flex items-center justify-between w-full")
        return Footer(Div(footer_inner, cls="vyasa-footer-card bg-slate-900 text-white rounded-lg p-4 my-4 dark:bg-slate-800"), cls=f"{outer_cls} vyasa-footer-shell".strip(), id="site-footer", **outer_style)

    if htmx and getattr(htmx, "request", None):
        return _render_htmx_layout(content, title, show_sidebar, toc_content, current_path, show_toc, logger, t_section, layout_start_time, main_spacing_cls, section_class, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar)

    return _render_full_layout(content, title, show_sidebar, toc_content, current_path, show_toc, auth, htmx_nav, nav_posts_menu, show_footer, no_scroll, logger, t_section, layout_start_time, layout_fluid_class, layout_max_class, layout_max_style, main_spacing_cls, page_container_cls, navbar_margin_cls, section_class, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar, get_roles_from_auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, cached_posts_sidebar_html, posts_sidebar_fingerprint, get_posts, navbar, style_attr, _footer_node)


def _toc_items(toc_content, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor):
    return build_sidebar_toc_items(extract_sidebar_toc(toc_content, strip_inline_markdown, text_to_anchor, unique_anchor)) if toc_content else []


def _render_htmx_layout(content, title, show_sidebar, toc_content, current_path, show_toc, logger, t_section, layout_start_time, main_spacing_cls, section_class, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar):
    if show_sidebar:
        toc_sidebar = None
        t_toc = t_section
        if show_toc:
            toc_items = _toc_items(toc_content, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor)
            t_toc = time.time()
            logger.debug(f"[LAYOUT] TOC built in {(t_toc - t_section)*1000:.2f}ms")
            sidebars_open = get_config().get_sidebars_open()
            toc_sidebar = Aside(build_collapsible_sidebar("list", "Table of Contents", toc_items, is_open=sidebars_open, shortcut_key="X") if toc_items else Div(), cls="vyasa-sidebar vyasa-toc-sidebar hidden xl:block w-72 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]", id="toc-sidebar", hx_swap_oob="true")
            mobile_toc_panel = Div(Div(Button(UkIcon("x", cls="w-5 h-5"), id="close-mobile-toc", cls="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors ml-auto", type="button"), cls="vyasa-mobile-panel-header flex justify-end p-2 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800"), Div(build_collapsible_sidebar("list", "Table of Contents", toc_items, is_open=sidebars_open, shortcut_key="X") if toc_items else Div(P("No table of contents available.", cls="text-slate-500 dark:text-slate-400 text-sm p-4")), cls="vyasa-mobile-panel-body p-4 overflow-y-auto"), id="mobile-toc-panel", cls="vyasa-mobile-panel fixed inset-0 bg-white dark:bg-slate-950 z-[9999] xl:hidden transform translate-x-full transition-transform duration-300", hx_swap_oob="true")
        custom_css_links = get_sidebar_custom_css_links(get_root_folder(), current_path, section_class)
        logger.debug(f"[LAYOUT] Custom CSS resolved in {(time.time() - t_toc)*1000:.2f}ms")
        main_content_container = Main(*content, cls=f"vyasa-main-shell flex-1 min-w-0 {main_spacing_cls} space-y-8 {section_class}", id="main-content", hx_boost="true", hx_target="#main-content", hx_swap="outerHTML show:window:top settle:0.1s")
        result = [Title(title), Div(*custom_css_links, id="scoped-css-container", hx_swap_oob="true") if custom_css_links else Div(id="scoped-css-container", hx_swap_oob="true")]
        if show_toc:
            result.append(mobile_toc_panel)
        if toc_sidebar:
            result.extend([main_content_container, toc_sidebar])
        else:
            result.extend([main_content_container, Div(id="toc-sidebar", hx_swap_oob="true"), Div(id="mobile-toc-panel", hx_swap_oob="true")])
        logger.debug(f"[LAYOUT] TOTAL layout() time {(time.time() - layout_start_time)*1000:.2f}ms")
        return tuple(result)
    custom_css_links = get_sidebar_custom_css_links(get_root_folder(), current_path, section_class) if current_path else []
    result = [Title(title), Div(*custom_css_links, id="scoped-css-container", hx_swap_oob="true") if custom_css_links else Div(id="scoped-css-container", hx_swap_oob="true"), *content]
    logger.debug(f"[LAYOUT] TOTAL layout() time {(time.time() - layout_start_time)*1000:.2f}ms")
    return tuple(result)


def _render_full_layout(content, title, show_sidebar, toc_content, current_path, show_toc, auth, htmx_nav, nav_posts_menu, show_footer, no_scroll, logger, t_section, layout_start_time, layout_fluid_class, layout_max_class, layout_max_style, main_spacing_cls, page_container_cls, navbar_margin_cls, section_class, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar, get_roles_from_auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, cached_posts_sidebar_html, posts_sidebar_fingerprint, get_posts, navbar, style_attr, footer_node):
    if show_sidebar:
        toc_sidebar = None
        if show_toc:
            toc_items = _toc_items(toc_content, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor)
            logger.debug(f"[LAYOUT] TOC built in {(time.time() - t_section)*1000:.2f}ms")
            sidebars_open = get_config().get_sidebars_open()
            toc_sidebar = Aside(build_collapsible_sidebar("list", "Table of Contents", toc_items, is_open=sidebars_open, shortcut_key="X") if toc_items else Div(), cls="vyasa-sidebar vyasa-toc-sidebar hidden xl:block w-72 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]", id="toc-sidebar")
        custom_css_links = get_sidebar_custom_css_links(get_root_folder(), current_path, section_class)
        main_content_container = Main(*content, cls=f"vyasa-main-shell flex-1 min-w-0 {main_spacing_cls} space-y-8 {section_class}", id="main-content", hx_boost="true", hx_target="#main-content", hx_swap="outerHTML show:window:top settle:0.1s")
        roles_key = tuple(get_roles_from_auth(auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list) or [])
        mobile_posts_panel = Div(Div(Button(UkIcon("x", cls="w-5 h-5"), id="close-mobile-posts", cls="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors ml-auto", type="button"), cls="vyasa-mobile-panel-header flex justify-end p-2 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800"), Div(NotStr(cached_posts_sidebar_html(posts_sidebar_fingerprint(), roles_key, get_config().get_show_hidden(), current_path or "")), cls="vyasa-mobile-panel-body p-4 overflow-y-auto"), id="mobile-posts-panel", cls="vyasa-mobile-panel fixed inset-0 bg-white dark:bg-slate-950 z-[9999] xl:hidden transform -translate-x-full transition-transform duration-300")
        mobile_toc_panel = Div(Div(Button(UkIcon("x", cls="w-5 h-5"), id="close-mobile-toc", cls="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors ml-auto", type="button"), cls="vyasa-mobile-panel-header flex justify-end p-2 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800"), Div(build_collapsible_sidebar("list", "Table of Contents", toc_items, is_open=sidebars_open, shortcut_key="X") if (show_toc and toc_items) else Div(P("No table of contents available.", cls="text-slate-500 dark:text-slate-400 text-sm p-4")), cls="vyasa-mobile-panel-body p-4 overflow-y-auto"), id="mobile-toc-panel", cls="vyasa-mobile-panel fixed inset-0 bg-white dark:bg-slate-950 z-[9999] xl:hidden transform translate-x-full transition-transform duration-300") if show_toc else None
        nav_posts_items = get_posts(list(roles_key) if roles_key else [], current_path=current_path or "") if nav_posts_menu else None
        content_with_sidebars = Div(cls=f"vyasa-content-grid layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-4 flex gap-6 flex-1 {'min-h-0' if no_scroll else ''}".strip(), id="content-with-sidebars", **style_attr(layout_max_style))((Aside(Div(UkIcon("loader", cls="w-5 h-5 animate-spin"), Span("Loading posts…", cls="ml-2 text-sm"), cls="flex items-center justify-center h-32 text-slate-400"), cls="vyasa-sidebar vyasa-posts-sidebar hidden xl:block w-72 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-x-auto overflow-y-hidden z-[1000]", id="posts-sidebar", hx_get=f"/_sidebar/posts?current_path={quote(current_path or '', safe='')}", hx_trigger="load", hx_swap="outerHTML") if not nav_posts_menu else None), main_content_container, toc_sidebar if toc_sidebar else None)
        body_content = Div(id="page-container", cls=page_container_cls)(Div(navbar(show_mobile_menus=True, htmx_nav=htmx_nav, posts_menu_items=nav_posts_items, compact_mode=nav_posts_menu), cls=f"vyasa-navbar-shell layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-4 sticky top-0 z-50 {navbar_margin_cls}".strip(), id="site-navbar", **style_attr(layout_max_style)), mobile_posts_panel, mobile_toc_panel if mobile_toc_panel else None, content_with_sidebars, footer_node(f"layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-6 mt-auto mb-6".strip(), style_attr(layout_max_style)) if show_footer else None)
    else:
        custom_css_links = get_sidebar_custom_css_links(get_root_folder(), current_path, section_class) if current_path else []
        body_content = Div(id="page-container", cls="flex flex-col min-h-screen")(Div(navbar(htmx_nav=htmx_nav), cls=f"vyasa-navbar-shell layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-4 sticky top-0 z-50 mt-4".strip(), id="site-navbar", **style_attr(layout_max_style)), Main(*content, cls=f"vyasa-main-shell layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-6 py-8 space-y-8".strip(), id="main-content", hx_boost="true", hx_target="#main-content", hx_swap="outerHTML show:window:top settle:0.1s", **style_attr(layout_max_style)), footer_node(f"layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-6 mt-auto mb-6".strip(), style_attr(layout_max_style)) if show_footer else None)
    result = [Title(title), Div(*custom_css_links, id="scoped-css-container") if custom_css_links else Div(id="scoped-css-container"), body_content]
    logger.debug(f"[LAYOUT] FULL PAGE assembled in {(time.time() - layout_start_time)*1000:.2f}ms")
    return tuple(result)
