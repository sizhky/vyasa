import time
import re
from typing import Any
from urllib.parse import quote
from fasthtml.common import Link

from fasthtml.common import A, Aside, Button, Div, Footer, Main, NotStr, P, Span, Title
from monsterui.all import UkIcon
from .extensions import get_extension_runtime
from .sidebar_helpers import docked_sidebar_classes
from .page_frame import PageFrame, PageFrameDeps
from .runtime_context import traced

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


def _collect_main_attrs(current_path, auth, get_config, slide_mode=False):
    attrs = {}
    runtime = get_extension_runtime()
    providers = runtime.shell_main_attr_providers if runtime else []
    context = {
        "auth": auth,
        "current_path": current_path,
        "slide_mode": slide_mode,
        "get_config": get_config,
    }
    for provider in providers:
        attrs.update(provider(context) or {})
    return attrs


def _collect_body_fragments(current_path, show_sidebar, show_toc, auth, slide_mode):
    runtime = get_extension_runtime()
    providers = runtime.shell_body_fragment_providers if runtime else []
    context = {
        "auth": auth,
        "current_path": current_path,
        "show_sidebar": show_sidebar,
        "show_toc": show_toc,
        "slide_mode": slide_mode,
    }
    return [fragment for provider in providers if (fragment := provider(context))]


def _collect_footer_links(auth):
    runtime = get_extension_runtime()
    providers = runtime.shell_footer_link_providers if runtime else []
    context = {"auth": auth}
    links = []
    for provider in providers:
        links.extend(provider(context) or ())
    return links


def _collect_navbar_mobile_actions(current_path, show_toc, slide_mode):
    runtime = get_extension_runtime()
    providers = runtime.navbar_mobile_action_providers if runtime else []
    context = {
        "current_path": current_path,
        "show_toc": show_toc,
        "slide_mode": slide_mode,
    }
    return [node for provider in providers if (node := provider(context))]


@traced("layout")
def render_page_frame(frame: PageFrame, *, htmx, deps: PageFrameDeps):
    logger = deps.logger
    resolve_layout_config = deps.resolve_layout_config
    width_class_and_style = deps.width_class_and_style
    style_attr = deps.style_attr
    get_sidebar_custom_css_links = deps.get_sidebar_custom_css_links
    get_root_folder = deps.get_root_folder
    build_sidebar_toc_items = deps.build_sidebar_toc_items
    extract_sidebar_toc = deps.extract_sidebar_toc
    strip_inline_markdown = deps.strip_inline_markdown
    text_to_anchor = deps.text_to_anchor
    unique_anchor = deps.unique_anchor
    get_config = deps.get_config
    build_collapsible_sidebar = deps.build_collapsible_sidebar
    get_roles_from_auth = deps.get_roles_from_auth
    rbac_rules = deps.rbac_rules
    rbac_cfg = deps.rbac_cfg
    google_oauth_cfg = deps.google_oauth_cfg
    coerce_list = deps.coerce_list
    cached_posts_sidebar_html = deps.cached_posts_sidebar_html
    posts_sidebar_fingerprint = deps.posts_sidebar_fingerprint
    get_posts = deps.get_posts
    navbar = deps.navbar
    current_path = frame.current_path
    auth = frame.auth
    no_scroll = frame.no_scroll
    slide_mode = frame.slide_mode
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
    sidebar_style = f"--vyasa-sidebar-width: {sidebar_width}; --vyasa-posts-sidebar-width: var(--vyasa-sidebar-width); --vyasa-toc-sidebar-width: var(--vyasa-sidebar-width);"
    page_style = "; ".join(part for part in (layout_max_style, sidebar_style, theme_style, font_style, token_style) if part)
    layout_fluid_class = "layout-fluid" if layout_max_style else ""
    if frame.full_width:
        layout_max_class = layout_max_style = layout_fluid_class = ""
    main_spacing_cls = "px-0 py-0" if no_scroll else "px-6 pt-4 pb-8"
    page_container_cls = "flex flex-col h-screen overflow-hidden" if no_scroll else "flex flex-col min-h-screen"
    navbar_margin_cls = "mt-0"

    def _footer_node(outer_cls, outer_style):
        logout_button = None
        extra_links = _collect_footer_links(auth)
        if auth:
            display_name = auth.get("name") or auth.get("email") or auth.get("username") or "User"
            impersonator = auth.get("impersonator")
            if impersonator:
                original = impersonator.get("name") or impersonator.get("email") or impersonator.get("username") or "User"
                display_name = f"Impersonating {display_name} (as {original})"
            logout_button = A(f"Logout {display_name}", href="/logout", cls="text-sm text-white/80 hover:text-white underline")
        footer_inner = Div(
            Div(logout_button, cls="flex items-center") if logout_button else Div(),
            Div(
                Div(*extra_links, cls="flex items-center gap-3") if extra_links else Div(),
                Div(NotStr('Powered by <a href="https://github.com/sizhky/vyasa" class="underline hover:text-white/80" target="_blank" rel="noopener noreferrer">Vyasa</a> and ❤️')),
                cls="flex items-center gap-4",
            ),
            cls="flex items-center justify-between w-full",
        )
        return Footer(Div(footer_inner, cls="vyasa-footer-card bg-slate-900 text-white p-4 dark:bg-slate-800"), cls=f"{outer_cls} vyasa-footer-shell".strip(), id="site-footer", **outer_style)

    # History-restore requests (back/swipe with a cache miss) must return the full
    # page; htmx writes the response into <body>, so a partial would wipe the navbar
    # and sidebars and leave main content orphaned.
    if htmx and getattr(htmx, "request", None) and not getattr(htmx, "history_restore_request", None):
        return _render_htmx_layout(frame.content, frame.title, frame.show_sidebar, frame.toc_content, frame.current_path, frame.show_toc, frame.slide_mode, frame.extra_head_nodes, logger, t_section, layout_start_time, main_spacing_cls, section_class, theme_font_links, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar)

    return _render_full_layout(frame.content, frame.title, frame.show_sidebar, frame.toc_content, frame.current_path, frame.show_toc, frame.auth, frame.htmx_nav, frame.nav_posts_menu, frame.show_footer, frame.no_scroll, frame.slide_mode, frame.current_updated_label, frame.extra_head_nodes, logger, t_section, layout_start_time, layout_fluid_class, layout_max_class, layout_max_style, page_style, main_spacing_cls, page_container_cls, navbar_margin_cls, section_class, theme_font_links, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar, get_roles_from_auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, cached_posts_sidebar_html, posts_sidebar_fingerprint, get_posts, navbar, style_attr, _footer_node)


def render_layout(*content, htmx, title=None, show_sidebar=False, toc_content=None, current_path=None, show_toc=True, auth=None, htmx_nav=True, nav_posts_menu=False, full_width=False, show_footer=True, no_scroll=False, slide_mode=False, current_updated_label=None, extra_head_nodes=(), logger, resolve_layout_config, width_class_and_style, style_attr, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar, get_roles_from_auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, cached_posts_sidebar_html, posts_sidebar_fingerprint, get_posts, navbar):
    frame = PageFrame(tuple(content), title=title, show_sidebar=show_sidebar, toc_content=toc_content, current_path=current_path, show_toc=show_toc, auth=auth, htmx_nav=htmx_nav, nav_posts_menu=nav_posts_menu, full_width=full_width, show_footer=show_footer, no_scroll=no_scroll, slide_mode=slide_mode, current_updated_label=current_updated_label, extra_head_nodes=tuple(extra_head_nodes))
    deps = PageFrameDeps(logger, resolve_layout_config, width_class_and_style, style_attr, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar, get_roles_from_auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, cached_posts_sidebar_html, posts_sidebar_fingerprint, get_posts, navbar)
    return render_page_frame(frame, htmx=htmx, deps=deps)


@traced("toc")
def _toc_items(toc_content, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor):
    return build_sidebar_toc_items(extract_sidebar_toc(toc_content, strip_inline_markdown, text_to_anchor, unique_anchor)) if toc_content else []


def _collect_scoped_css_links(current_path, section_class, get_root_folder, get_sidebar_custom_css_links):
    context = {
        "current_path": current_path,
        "section_class": section_class,
        "root_folder": get_root_folder(),
        "default_provider": get_sidebar_custom_css_links,
    }
    runtime = get_extension_runtime()
    providers = runtime.scoped_css_providers if runtime else []
    if not providers:
        return get_sidebar_custom_css_links(get_root_folder(), current_path, section_class)
    nodes = []
    for provider in providers:
        provided = provider(context) or ()
        nodes.extend(provided)
    return nodes


def _collect_toc_panels(*, toc_content, show_toc, current_path, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar, oob=False, desktop_margin_top=False):
    if not show_toc:
        return None, None, []
    toc_items = _toc_items(toc_content, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor)
    context = {
        "toc_items": toc_items,
        "current_path": current_path,
        "show_toc": show_toc,
        "sidebars_open": get_config().get_sidebars_open(),
        "build_collapsible_sidebar": build_collapsible_sidebar,
        "mode": "htmx" if oob else "full",
        "oob": oob,
        "desktop_margin_top": desktop_margin_top,
    }
    runtime = get_extension_runtime()
    providers = runtime.toc_panel_providers if runtime else []
    if providers:
        for provider in providers:
            if panels := provider(context):
                desktop, mobile = panels
                return desktop, mobile, toc_items
    desktop_cls = docked_sidebar_classes("toc")
    desktop_attrs: dict[str, Any] = {"id": "toc-sidebar"}
    if oob:
        desktop_attrs["hx_swap_oob"] = "true"
    desktop = Aside(
        build_collapsible_sidebar("list", "Table of Contents", toc_items, is_open=True, data_sidebar="toc", shortcut_key="X"),
        cls=desktop_cls,
        **desktop_attrs,
    ) if toc_items else Div(**desktop_attrs)
    mobile_attrs: dict[str, Any] = {
        "id": "mobile-toc-panel",
        "cls": "vyasa-mobile-panel fixed inset-y-0 right-0 w-full sm:w-96 sm:border-l border-slate-200 dark:border-slate-800 sm:shadow-2xl bg-white dark:bg-slate-950 z-[9999] xl:hidden transform translate-x-full transition-transform duration-300",
        "aria_hidden": "true",
    }
    if oob:
        mobile_attrs["hx_swap_oob"] = "true"
    mobile = Div(
        Div(Button(UkIcon("x", cls="w-5 h-5"), id="close-mobile-toc", cls="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors ml-auto", type="button"), cls="vyasa-mobile-panel-header flex justify-end p-2 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800"),
        Div(
            build_collapsible_sidebar("list", "Table of Contents", toc_items, is_open=True, data_sidebar="toc", shortcut_key="X") if toc_items else Div(P("No table of contents available.", cls="text-slate-500 dark:text-slate-400 text-sm p-4")),
            cls="vyasa-mobile-panel-body p-4 overflow-y-auto",
        ),
        **mobile_attrs,
    )
    return desktop, mobile, toc_items


def _render_htmx_layout(content, title, show_sidebar, toc_content, current_path, show_toc, slide_mode, extra_head_nodes, logger, t_section, layout_start_time, main_spacing_cls, section_class, theme_font_links, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar):
    if show_sidebar:
        toc_sidebar, mobile_toc_panel, _ = _collect_toc_panels(
            toc_content=toc_content,
            show_toc=show_toc,
            current_path=current_path,
            build_sidebar_toc_items=build_sidebar_toc_items,
            extract_sidebar_toc=extract_sidebar_toc,
            strip_inline_markdown=strip_inline_markdown,
            text_to_anchor=text_to_anchor,
            unique_anchor=unique_anchor,
            get_config=get_config,
            build_collapsible_sidebar=build_collapsible_sidebar,
            oob=True,
            desktop_margin_top=False,
        )
        t_toc = time.time()
        logger.debug(f"[LAYOUT] TOC built in {(t_toc - t_section)*1000:.2f}ms")
        custom_css_links = _collect_scoped_css_links(current_path, section_class, get_root_folder, get_sidebar_custom_css_links)
        logger.debug(f"[LAYOUT] Custom CSS resolved in {(time.time() - t_toc)*1000:.2f}ms")
        main_content_container = Main(*content, cls=f"vyasa-main-shell {'vyasa-zen-present' if slide_mode else ''} flex-1 min-w-0 {main_spacing_cls} space-y-8 {section_class}".strip(), id="main-content", hx_boost="true", hx_target="#main-content", hx_swap="outerHTML show:window:top settle:0.1s", **_collect_main_attrs(current_path, None, get_config, slide_mode=slide_mode))
        result = [Title(title), *theme_font_links, *extra_head_nodes, Div(*custom_css_links, id="scoped-css-container", hx_swap_oob="true") if custom_css_links else Div(id="scoped-css-container", hx_swap_oob="true")]
        if mobile_toc_panel:
            result.append(mobile_toc_panel)
        if toc_sidebar:
            result.extend([main_content_container, toc_sidebar])
        else:
            result.extend([main_content_container, Div(id="toc-sidebar", hx_swap_oob="true"), Div(id="mobile-toc-panel", hx_swap_oob="true")])
        logger.debug(f"[LAYOUT] TOTAL layout() time {(time.time() - layout_start_time)*1000:.2f}ms")
        return tuple(result)
    custom_css_links = _collect_scoped_css_links(current_path, section_class, get_root_folder, get_sidebar_custom_css_links) if current_path else []
    main_content_container = Main(*content, cls=f"vyasa-main-shell {'vyasa-zen-present' if slide_mode else ''} layout-container w-full mx-auto px-6 py-8 space-y-8 {section_class}".strip(), id="main-content", hx_boost="true", hx_target="#main-content", hx_swap="outerHTML show:window:top settle:0.1s", **_collect_main_attrs(current_path, None, get_config, slide_mode=slide_mode))
    result = [Title(title), *theme_font_links, *extra_head_nodes, Div(*custom_css_links, id="scoped-css-container", hx_swap_oob="true") if custom_css_links else Div(id="scoped-css-container", hx_swap_oob="true"), main_content_container]
    logger.debug(f"[LAYOUT] TOTAL layout() time {(time.time() - layout_start_time)*1000:.2f}ms")
    return tuple(result)


def _render_full_layout(content, title, show_sidebar, toc_content, current_path, show_toc, auth, htmx_nav, nav_posts_menu, show_footer, no_scroll, slide_mode, current_updated_label, extra_head_nodes, logger, t_section, layout_start_time, layout_fluid_class, layout_max_class, layout_max_style, page_style, main_spacing_cls, page_container_cls, navbar_margin_cls, section_class, theme_font_links, get_sidebar_custom_css_links, get_root_folder, build_sidebar_toc_items, extract_sidebar_toc, strip_inline_markdown, text_to_anchor, unique_anchor, get_config, build_collapsible_sidebar, get_roles_from_auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, cached_posts_sidebar_html, posts_sidebar_fingerprint, get_posts, navbar, style_attr, footer_node):
    body_fragments = _collect_body_fragments(current_path, show_sidebar, show_toc, auth, slide_mode)
    main_column_padding_cls = "px-2" if no_scroll else "px-4"
    if show_sidebar:
        toc_sidebar, mobile_toc_panel, toc_items = _collect_toc_panels(
            toc_content=toc_content,
            show_toc=show_toc,
            current_path=current_path,
            build_sidebar_toc_items=build_sidebar_toc_items,
            extract_sidebar_toc=extract_sidebar_toc,
            strip_inline_markdown=strip_inline_markdown,
            text_to_anchor=text_to_anchor,
            unique_anchor=unique_anchor,
            get_config=get_config,
            build_collapsible_sidebar=build_collapsible_sidebar,
            oob=False,
            desktop_margin_top=True,
        )
        logger.debug(f"[LAYOUT] TOC built in {(time.time() - t_section)*1000:.2f}ms")
        custom_css_links = _collect_scoped_css_links(current_path, section_class, get_root_folder, get_sidebar_custom_css_links)
        main_content_container = Main(*content, cls=f"vyasa-main-shell {'vyasa-zen-present' if slide_mode else ''} flex-1 min-w-0 {main_spacing_cls} space-y-8 {section_class}".strip(), id="main-content", hx_boost="true", hx_target="#main-content", hx_swap="outerHTML show:window:top settle:0.1s", **_collect_main_attrs(current_path, auth, get_config, slide_mode=slide_mode))
        roles_key = tuple(get_roles_from_auth(auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list) or [])
        mobile_posts_panel = Div(Div(Button(UkIcon("x", cls="w-5 h-5"), id="close-mobile-posts", cls="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors ml-auto", type="button"), cls="vyasa-mobile-panel-header flex justify-end p-2 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800"), Div(NotStr(cached_posts_sidebar_html(posts_sidebar_fingerprint(), roles_key, get_config().get_show_hidden(), current_path or "")), cls="vyasa-mobile-panel-body p-4 overflow-y-auto"), id="mobile-posts-panel", cls="vyasa-mobile-panel fixed inset-y-0 left-0 w-full sm:w-96 sm:border-r border-slate-200 dark:border-slate-800 sm:shadow-2xl bg-white dark:bg-slate-950 z-[9999] xl:hidden transform -translate-x-full transition-transform duration-300", aria_hidden="true")
        nav_posts_items = get_posts(list(roles_key) if roles_key else [], current_path=current_path or "") if nav_posts_menu else None
        main_column = Div(main_content_container, cls=f"layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto {main_column_padding_cls} flex flex-1 min-w-0 {'min-h-0' if no_scroll else ''}".strip(), **style_attr(layout_max_style))
        content_with_sidebars = Div(cls=f"vyasa-content-grid w-full flex flex-1 {'min-h-0' if no_scroll else ''}".strip(), id="content-with-sidebars")((Aside(Div(UkIcon("loader", cls="w-5 h-5 animate-spin"), Span("Loading posts…", cls="ml-2 text-sm"), cls="flex items-center justify-center h-32 text-slate-400"), cls=docked_sidebar_classes("posts"), id="posts-sidebar", hx_get=f"/_sidebar/posts?current_path={quote(current_path or '', safe='')}", hx_trigger="load", hx_swap="outerHTML") if not nav_posts_menu else None), main_column, toc_sidebar if toc_sidebar else None)
        mobile_extra_controls = _collect_navbar_mobile_actions(current_path, show_toc, slide_mode)
        body_content = Div(id="page-container", cls=page_container_cls, data_posts_hover_expand="1", **style_attr(page_style))(*body_fragments, Div(navbar(show_mobile_menus=True, htmx_nav=htmx_nav, posts_menu_items=nav_posts_items, compact_mode=nav_posts_menu, updated_label=current_updated_label, mobile_extra_controls=mobile_extra_controls, current_path=current_path, roles=list(roles_key)), cls=f"vyasa-navbar-shell w-full sticky top-0 z-[1300] {navbar_margin_cls}".strip(), id="site-navbar"), mobile_posts_panel, mobile_toc_panel if mobile_toc_panel else None, content_with_sidebars, footer_node("w-full mt-auto".strip(), {}) if show_footer else None)
    else:
        custom_css_links = _collect_scoped_css_links(current_path, section_class, get_root_folder, get_sidebar_custom_css_links) if current_path else []
        roles_key = tuple(get_roles_from_auth(auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list) or [])
        body_content = Div(id="page-container", cls=f"flex flex-col min-h-screen {'vyasa-zen-present' if slide_mode else ''}".strip(), **style_attr(page_style))(*body_fragments, Div(navbar(htmx_nav=htmx_nav, updated_label=current_updated_label, current_path=current_path, roles=list(roles_key)), cls="vyasa-navbar-shell w-full sticky top-0 z-[1300]", id="site-navbar"), Main(*content, cls=f"vyasa-main-shell {'vyasa-zen-present' if slide_mode else ''} layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-6 py-8 space-y-8 {section_class}".strip(), id="main-content", hx_boost="true", hx_target="#main-content", hx_swap="outerHTML show:window:top settle:0.1s", **_collect_main_attrs(current_path, auth, get_config, slide_mode=slide_mode), **style_attr(layout_max_style)), footer_node("w-full mt-auto", {}) if show_footer else None)
    result = [Title(title), *theme_font_links, *extra_head_nodes, Div(*custom_css_links, id="scoped-css-container") if custom_css_links else Div(id="scoped-css-container"), body_content]
    logger.debug(f"[LAYOUT] FULL PAGE assembled in {(time.time() - layout_start_time)*1000:.2f}ms")
    return tuple(result)
