import time
import re
from urllib.parse import quote
from fasthtml.common import Link

from fasthtml.common import A, Aside, Button, Div, Footer, Main, NotStr, P, Span, Title
from monsterui.all import UkIcon

_GOOGLE_FONT_QUERIES = {
    "Alegreya": "family=Alegreya:wght@400;500;600;700",
    "Arimo": "family=Arimo:wght@400;500;600;700",
    "Archivo": "family=Archivo:wght@400;500;600;700",
    "Asap": "family=Asap:wght@400;500;600;700",
    "Assistant": "family=Assistant:wght@400;500;600;700;800",
    "Azeret Mono": "family=Azeret+Mono:wght@400;500;600;700",
    "Be Vietnam Pro": "family=Be+Vietnam+Pro:wght@400;500;600;700",
    "Besley": "family=Besley:wght@400;500;600;700",
    "Bitter": "family=Bitter:wght@400;500;600;700",
    "Bricolage Grotesque": "family=Bricolage+Grotesque:wght@400;500;600;700",
    "Cabin": "family=Cabin:wght@400;500;600;700",
    "Cardo": "family=Cardo:wght@400;700",
    "Chivo": "family=Chivo:wght@400;500;600;700",
    "Cormorant Garamond": "family=Cormorant+Garamond:wght@400;500;600;700",
    "Crimson Pro": "family=Crimson+Pro:wght@400;500;600;700",
    "Cutive Mono": "family=Cutive+Mono",
    "DM Sans": "family=DM+Sans:wght@400;500;700",
    "Domine": "family=Domine:wght@400;500;600;700",
    "EB Garamond": "family=EB+Garamond:wght@400;500;600;700",
    "Fauna One": "family=Fauna+One",
    "Figtree": "family=Figtree:wght@400;500;600;700;800",
    "Fira Code": "family=Fira+Code:wght@400;500;600;700",
    "Fraunces": "family=Fraunces:opsz,wght,SOFT,WONK@9..144,400..700,0..100,0..1",
    "Hanken Grotesk": "family=Hanken+Grotesk:wght@400;500;600;700;800",
    "Hepta Slab": "family=Hepta+Slab:wght@400;500;600;700",
    "IBM Plex Mono": "family=IBM+Plex+Mono:wght@400;500;600;700",
    "Inconsolata": "family=Inconsolata:wght@400;500;600;700",
    "Instrument Serif": "family=Instrument+Serif:ital@0;1",
    "Inter": "family=Inter:wght@400;500;600;700;800",
    "JetBrains Mono": "family=JetBrains+Mono:wght@400;500;600;700;800",
    "Karla": "family=Karla:wght@400;500;600;700;800",
    "Lexend": "family=Lexend:wght@400;500;600;700;800",
    "Libre Baskerville": "family=Libre+Baskerville:wght@400;700",
    "Libre Franklin": "family=Libre+Franklin:wght@400;500;600;700;800",
    "Lora": "family=Lora:wght@400;500;600;700",
    "Manrope": "family=Manrope:wght@400;500;700;800",
    "Merriweather": "family=Merriweather:wght@400;700",
    "Merriweather Sans": "family=Merriweather+Sans:wght@400;500;600;700;800",
    "Montserrat": "family=Montserrat:wght@400;500;600;700;800",
    "Mulish": "family=Mulish:wght@400;500;600;700;800",
    "Newsreader": "family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600",
    "Noto Serif": "family=Noto+Serif:wght@400;500;600;700",
    "Nunito Sans": "family=Nunito+Sans:wght@400;500;600;700;800",
    "Onest": "family=Onest:wght@400;500;600;700;800",
    "Outfit": "family=Outfit:wght@400;500;600;700",
    "Playfair Display": "family=Playfair+Display:wght@400;500;600;700",
    "Plus Jakarta Sans": "family=Plus+Jakarta+Sans:wght@400;500;600;700;800",
    "PT Serif": "family=PT+Serif:wght@400;700",
    "Public Sans": "family=Public+Sans:wght@400;500;600;700;800",
    "Raleway": "family=Raleway:wght@400;500;600;700;800",
    "Reddit Mono": "family=Reddit+Mono:wght@400;500;600;700",
    "Red Hat Display": "family=Red+Hat+Display:wght@400;500;600;700;800",
    "Red Hat Text": "family=Red+Hat+Text:wght@400;500;600;700",
    "Recursive": "family=Recursive:wght@400;500;600;700",
    "Roboto Slab": "family=Roboto+Slab:wght@400;500;600;700",
    "Schibsted Grotesk": "family=Schibsted+Grotesk:wght@400;500;600;700;800",
    "Share Tech Mono": "family=Share+Tech+Mono",
    "Space Mono": "family=Space+Mono:wght@400;700",
    "Sometype Mono": "family=Sometype+Mono:wght@400;500;600;700",
    "Source Sans 3": "family=Source+Sans+3:wght@400;500;600;700;800",
    "Source Code Pro": "family=Source+Code+Pro:wght@400;500;600;700",
    "Source Serif 4": "family=Source+Serif+4:wght@400;500;600;700",
    "Space Grotesk": "family=Space+Grotesk:wght@400;500;700",
    "Spectral": "family=Spectral:wght@400;500;600;700",
    "Sora": "family=Sora:wght@400;500;600;700;800",
    "Ubuntu Mono": "family=Ubuntu+Mono:wght@400;700",
    "Urbanist": "family=Urbanist:wght@400;500;600;700;800",
    "VT323": "family=VT323",
    "Work Sans": "family=Work+Sans:wght@400;500;600;700;800",
}


def _theme_font_links(*font_stacks):
    families = []
    seen = set()
    for stack in font_stacks:
        if not stack:
            continue
        for family in re.findall(r'"([^"]+)"|\'([^\']+)\'|([^,\s][^,]*)', stack):
            name = next(part for part in family if part).strip()
            if name.lower() in {"serif", "sans-serif", "monospace", "system-ui", "ui-serif", "ui-sans-serif"}:
                continue
            if name in _GOOGLE_FONT_QUERIES and name not in seen:
                seen.add(name)
                families.append(_GOOGLE_FONT_QUERIES[name])
    if not families:
        return []
    return [
        Link(rel="preconnect", href="https://fonts.googleapis.com"),
        Link(rel="preconnect", href="https://fonts.gstatic.com", crossorigin=""),
        Link(rel="stylesheet", href=f"https://fonts.googleapis.com/css2?{'&'.join(families)}&display=swap"),
    ]


def _section_class(current_path):
    if not current_path:
        return ""
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", current_path).strip("-").lower()
    return f"section-{slug}" if slug else ""


def _annotation_attrs(current_path, auth, get_config, slide_mode=False):
    if auth:
        author = auth.get("name") or auth.get("email") or auth.get("username") or "anonymous"
    else:
        author = "anonymous"
    return {
        "data-annotations-enabled": "1" if get_config().get_annotations_enabled() and not slide_mode else "0",
        "data-annotation-path": current_path or "__index__",
        "data-annotation-author": author,
        "data-slide-mode": "1" if slide_mode else "0",
    }


def render_layout(*content, htmx, title=None, show_sidebar=False, toc_content=None, current_path=None, show_toc=True, auth=None, htmx_nav=True, nav_posts_menu=False, full_width=False, show_footer=True, no_scroll=False, slide_mode=False, logger, resolve_layout_config, width_class_and_style, style_attr, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar, get_roles_from_auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, cached_posts_sidebar_html, posts_sidebar_fingerprint, get_posts, navbar):
    layout_start_time = time.time()
    logger.debug("[LAYOUT] layout() start")
    section_class = _section_class(current_path)
    t_section = time.time()
    logger.debug(f"[LAYOUT] section_class computed in {(t_section - layout_start_time)*1000:.2f}ms")
    layout_config = resolve_layout_config(current_path)
    layout_max_class, layout_max_style = width_class_and_style(layout_config.get("layout_max_width"), "max")
    sidebar_width = layout_config.get("sidebar_width") or "22rem"
    theme_primary = layout_config.get("theme_primary")
    theme_style = f"--vyasa-primary: {theme_primary}; --vyasa-primary-dim: color-mix(in srgb, {theme_primary} 82%, black);" if theme_primary else ""
    body_font = layout_config.get("theme_body_font")
    heading_font = layout_config.get("theme_heading_font")
    ui_font = layout_config.get("theme_ui_font")
    mono_font = layout_config.get("theme_mono_font")
    theme_tokens = layout_config.get("theme_tokens") or {}
    font_style = "; ".join(part for part in (
        f"--vyasa-font-body: {body_font}" if body_font else "",
        f"--vyasa-font-heading: {heading_font}" if heading_font else "",
        f"--vyasa-font-ui: {ui_font}" if ui_font else "",
        f"--vyasa-font-mono: {mono_font}" if mono_font else "",
    ) if part)
    theme_font_links = _theme_font_links(body_font, heading_font, ui_font, mono_font)
    token_style = "; ".join(
        f"--vyasa-{name}: {value}" for name, value in theme_tokens.items() if value
    )
    page_style = "; ".join(part for part in (layout_max_style, f"--vyasa-sidebar-width: {sidebar_width};", theme_style, font_style, token_style) if part)
    layout_fluid_class = "layout-fluid" if layout_max_style else ""
    if full_width:
        layout_max_class = layout_max_style = layout_fluid_class = ""
    main_spacing_cls = "px-0 py-0" if no_scroll else "px-6 pt-4 pb-8"
    page_container_cls = "flex flex-col h-screen overflow-hidden" if no_scroll else "flex flex-col min-h-screen"
    navbar_margin_cls = "mt-0" if no_scroll else "mt-4"

    def _footer_node(outer_cls, outer_style):
        logout_button = None
        admin_links = None
        if auth:
            display_name = auth.get("name") or auth.get("email") or auth.get("username") or "User"
            impersonator = auth.get("impersonator")
            roles = auth.get("roles") or []
            impersonator_roles = impersonator.get("roles") if impersonator else []
            is_admin = "full" in roles or "full" in (impersonator_roles or [])
            if impersonator:
                original = impersonator.get("name") or impersonator.get("email") or impersonator.get("username") or "User"
                display_name = f"Impersonating {display_name} (as {original})"
            logout_button = A(f"Logout {display_name}", href="/logout", cls="text-sm text-white/80 hover:text-white underline")
            if is_admin:
                admin_links = Div(
                    A("RBAC", href="/admin/rbac", cls="text-sm text-white/80 hover:text-white underline"),
                    A("Impersonate", href="/admin/impersonate", cls="text-sm text-white/80 hover:text-white underline"),
                    cls="flex items-center gap-3",
                )
        footer_inner = Div(
            Div(logout_button, cls="flex items-center") if logout_button else Div(),
            Div(
                admin_links if admin_links else Div(),
                Div(NotStr('Powered by <a href="https://github.com/sizhky/vyasa" class="underline hover:text-white/80" target="_blank" rel="noopener noreferrer">Vyasa</a> and ❤️')),
                cls="flex items-center gap-4",
            ),
            cls="flex items-center justify-between w-full",
        )
        return Footer(Div(footer_inner, cls="vyasa-footer-card bg-slate-900 text-white rounded-lg p-4 my-4 dark:bg-slate-800"), cls=f"{outer_cls} vyasa-footer-shell".strip(), id="site-footer", **outer_style)

    if htmx and getattr(htmx, "request", None):
        return _render_htmx_layout(content, title, show_sidebar, toc_content, current_path, show_toc, slide_mode, logger, t_section, layout_start_time, main_spacing_cls, section_class, theme_font_links, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar)

    return _render_full_layout(content, title, show_sidebar, toc_content, current_path, show_toc, auth, htmx_nav, nav_posts_menu, show_footer, no_scroll, slide_mode, logger, t_section, layout_start_time, layout_fluid_class, layout_max_class, layout_max_style, page_style, main_spacing_cls, page_container_cls, navbar_margin_cls, section_class, theme_font_links, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar, get_roles_from_auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, cached_posts_sidebar_html, posts_sidebar_fingerprint, get_posts, navbar, style_attr, _footer_node)


def _toc_items(toc_content, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor):
    return build_sidebar_toc_items(extract_sidebar_toc(toc_content, strip_inline_markdown, text_to_anchor, unique_anchor)) if toc_content else []


def _render_htmx_layout(content, title, show_sidebar, toc_content, current_path, show_toc, slide_mode, logger, t_section, layout_start_time, main_spacing_cls, section_class, theme_font_links, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar):
    slide_assets = [Link(rel="stylesheet", href="/static/present.css")] if slide_mode else []
    if show_sidebar:
        toc_sidebar = None
        t_toc = t_section
        if show_toc:
            toc_items = _toc_items(toc_content, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor)
            t_toc = time.time()
            logger.debug(f"[LAYOUT] TOC built in {(t_toc - t_section)*1000:.2f}ms")
            sidebars_open = get_config().get_sidebars_open()
            toc_sidebar = Aside(build_collapsible_sidebar("list", "Table of Contents", toc_items, is_open=sidebars_open, shortcut_key="X") if toc_items else Div(), cls="vyasa-sidebar vyasa-toc-sidebar hidden xl:block w-[var(--vyasa-sidebar-width,22rem)] shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]", id="toc-sidebar", hx_swap_oob="true")
            mobile_toc_panel = Div(Div(Button(UkIcon("x", cls="w-5 h-5"), id="close-mobile-toc", cls="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors ml-auto", type="button"), cls="vyasa-mobile-panel-header flex justify-end p-2 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800"), Div(build_collapsible_sidebar("list", "Table of Contents", toc_items, is_open=sidebars_open, shortcut_key="X") if toc_items else Div(P("No table of contents available.", cls="text-slate-500 dark:text-slate-400 text-sm p-4")), cls="vyasa-mobile-panel-body p-4 overflow-y-auto"), id="mobile-toc-panel", cls="vyasa-mobile-panel fixed inset-0 bg-white dark:bg-slate-950 z-[9999] xl:hidden transform translate-x-full transition-transform duration-300", hx_swap_oob="true", aria_hidden="true")
        custom_css_links = get_sidebar_custom_css_links(get_root_folder(), current_path, section_class)
        logger.debug(f"[LAYOUT] Custom CSS resolved in {(time.time() - t_toc)*1000:.2f}ms")
        main_content_container = Main(*content, cls=f"vyasa-main-shell {'vyasa-zen-present' if slide_mode else ''} flex-1 min-w-0 {main_spacing_cls} space-y-8 {section_class}".strip(), id="main-content", hx_boost="true", hx_target="#main-content", hx_swap="outerHTML show:window:top settle:0.1s", **_annotation_attrs(current_path, None, get_config, slide_mode=slide_mode))
        result = [Title(title), *theme_font_links, *slide_assets, Div(*custom_css_links, id="scoped-css-container", hx_swap_oob="true") if custom_css_links else Div(id="scoped-css-container", hx_swap_oob="true")]
        if show_toc:
            result.append(mobile_toc_panel)
        if toc_sidebar:
            result.extend([main_content_container, toc_sidebar])
        else:
            result.extend([main_content_container, Div(id="toc-sidebar", hx_swap_oob="true"), Div(id="mobile-toc-panel", hx_swap_oob="true")])
        logger.debug(f"[LAYOUT] TOTAL layout() time {(time.time() - layout_start_time)*1000:.2f}ms")
        return tuple(result)
    custom_css_links = get_sidebar_custom_css_links(get_root_folder(), current_path, section_class) if current_path else []
    main_content_container = Main(*content, cls=f"vyasa-main-shell {'vyasa-zen-present' if slide_mode else ''} layout-container w-full mx-auto px-6 py-8 space-y-8 {section_class}".strip(), id="main-content", hx_boost="true", hx_target="#main-content", hx_swap="outerHTML show:window:top settle:0.1s", **_annotation_attrs(current_path, None, get_config, slide_mode=slide_mode))
    result = [Title(title), *theme_font_links, *slide_assets, Div(*custom_css_links, id="scoped-css-container", hx_swap_oob="true") if custom_css_links else Div(id="scoped-css-container", hx_swap_oob="true"), main_content_container]
    logger.debug(f"[LAYOUT] TOTAL layout() time {(time.time() - layout_start_time)*1000:.2f}ms")
    return tuple(result)


def _render_full_layout(content, title, show_sidebar, toc_content, current_path, show_toc, auth, htmx_nav, nav_posts_menu, show_footer, no_scroll, slide_mode, logger, t_section, layout_start_time, layout_fluid_class, layout_max_class, layout_max_style, page_style, main_spacing_cls, page_container_cls, navbar_margin_cls, section_class, theme_font_links, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar, get_roles_from_auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, cached_posts_sidebar_html, posts_sidebar_fingerprint, get_posts, navbar, style_attr, footer_node):
    slide_assets = [Link(rel="stylesheet", href="/static/present.css")] if slide_mode else []
    code_copy_template = NotStr('<template id="vyasa-code-copy-tpl"><button type="button" class="code-copy-button absolute top-2 right-2 inline-flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500 transition-colors" aria-label="Copy code"><span class="w-4 h-4" aria-hidden="true">⧉</span><span class="sr-only">Copy code</span></button></template>')
    if show_sidebar:
        toc_sidebar = None
        if show_toc:
            toc_items = _toc_items(toc_content, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor)
            logger.debug(f"[LAYOUT] TOC built in {(time.time() - t_section)*1000:.2f}ms")
            sidebars_open = get_config().get_sidebars_open()
            toc_sidebar = Aside(build_collapsible_sidebar("list", "Table of Contents", toc_items, is_open=sidebars_open, shortcut_key="X") if toc_items else Div(), cls="vyasa-sidebar vyasa-toc-sidebar hidden xl:block w-[var(--vyasa-sidebar-width,22rem)] shrink-0 sticky top-24 self-start mt-4 max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]", id="toc-sidebar")
        custom_css_links = get_sidebar_custom_css_links(get_root_folder(), current_path, section_class)
        main_content_container = Main(*content, cls=f"vyasa-main-shell {'vyasa-zen-present' if slide_mode else ''} flex-1 min-w-0 {main_spacing_cls} space-y-8 {section_class}".strip(), id="main-content", hx_boost="true", hx_target="#main-content", hx_swap="outerHTML show:window:top settle:0.1s", **_annotation_attrs(current_path, auth, get_config, slide_mode=slide_mode))
        roles_key = tuple(get_roles_from_auth(auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list) or [])
        mobile_posts_panel = Div(Div(Button(UkIcon("x", cls="w-5 h-5"), id="close-mobile-posts", cls="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors ml-auto", type="button"), cls="vyasa-mobile-panel-header flex justify-end p-2 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800"), Div(NotStr(cached_posts_sidebar_html(posts_sidebar_fingerprint(), roles_key, get_config().get_show_hidden(), current_path or "")), cls="vyasa-mobile-panel-body p-4 overflow-y-auto"), id="mobile-posts-panel", cls="vyasa-mobile-panel fixed inset-0 bg-white dark:bg-slate-950 z-[9999] xl:hidden transform -translate-x-full transition-transform duration-300", aria_hidden="true")
        mobile_toc_panel = Div(Div(Button(UkIcon("x", cls="w-5 h-5"), id="close-mobile-toc", cls="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors ml-auto", type="button"), cls="vyasa-mobile-panel-header flex justify-end p-2 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800"), Div(build_collapsible_sidebar("list", "Table of Contents", toc_items, is_open=sidebars_open, shortcut_key="X") if (show_toc and toc_items) else Div(P("No table of contents available.", cls="text-slate-500 dark:text-slate-400 text-sm p-4")), cls="vyasa-mobile-panel-body p-4 overflow-y-auto"), id="mobile-toc-panel", cls="vyasa-mobile-panel fixed inset-0 bg-white dark:bg-slate-950 z-[9999] xl:hidden transform translate-x-full transition-transform duration-300", aria_hidden="true") if show_toc else None
        nav_posts_items = get_posts(list(roles_key) if roles_key else [], current_path=current_path or "") if nav_posts_menu else None
        content_with_sidebars = Div(cls=f"vyasa-content-grid layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-4 flex gap-6 flex-1 {'min-h-0' if no_scroll else ''}".strip(), id="content-with-sidebars", **style_attr(layout_max_style))((Aside(Div(UkIcon("loader", cls="w-5 h-5 animate-spin"), Span("Loading posts…", cls="ml-2 text-sm"), cls="flex items-center justify-center h-32 text-slate-400"), cls="vyasa-sidebar vyasa-posts-sidebar hidden xl:block w-[var(--vyasa-sidebar-width,22rem)] shrink-0 sticky top-24 self-start mt-4 max-h-[calc(100vh-10rem)] overflow-x-auto overflow-y-hidden z-[1000]", id="posts-sidebar", hx_get=f"/_sidebar/posts?current_path={quote(current_path or '', safe='')}", hx_trigger="load", hx_swap="outerHTML") if not nav_posts_menu else None), main_content_container, toc_sidebar if toc_sidebar else None)
        body_content = Div(id="page-container", cls=page_container_cls, **style_attr(page_style))(code_copy_template, Div(navbar(show_mobile_menus=True, htmx_nav=htmx_nav, posts_menu_items=nav_posts_items, compact_mode=nav_posts_menu), cls=f"vyasa-navbar-shell layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-4 sticky top-0 z-[1300] {navbar_margin_cls}".strip(), id="site-navbar", **style_attr(layout_max_style)), mobile_posts_panel, mobile_toc_panel if mobile_toc_panel else None, content_with_sidebars, footer_node(f"layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-6 mt-auto mb-6".strip(), style_attr(layout_max_style)) if show_footer else None)
    else:
        custom_css_links = get_sidebar_custom_css_links(get_root_folder(), current_path, section_class) if current_path else []
        body_content = Div(id="page-container", cls=f"flex flex-col min-h-screen {'vyasa-zen-present' if slide_mode else ''}".strip(), **style_attr(page_style))(code_copy_template, Div(navbar(htmx_nav=htmx_nav), cls=f"vyasa-navbar-shell layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-4 sticky top-0 z-[1300] mt-4".strip(), id="site-navbar", **style_attr(layout_max_style)), Main(*content, cls=f"vyasa-main-shell {'vyasa-zen-present' if slide_mode else ''} layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-6 py-8 space-y-8 {section_class}".strip(), id="main-content", hx_boost="true", hx_target="#main-content", hx_swap="outerHTML show:window:top settle:0.1s", **_annotation_attrs(current_path, auth, get_config, slide_mode=slide_mode), **style_attr(layout_max_style)), footer_node(f"layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-6 mt-auto mb-6".strip(), style_attr(layout_max_style)) if show_footer else None)
    result = [Title(title), *theme_font_links, *slide_assets, Div(*custom_css_links, id="scoped-css-container") if custom_css_links else Div(id="scoped-css-container"), body_content]
    logger.debug(f"[LAYOUT] FULL PAGE assembled in {(time.time() - layout_start_time)*1000:.2f}ms")
    return tuple(result)
