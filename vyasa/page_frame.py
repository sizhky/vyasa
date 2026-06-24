from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class PageFrame:
    content: tuple[Any, ...]
    title: str | None = None
    show_sidebar: bool = False
    toc_content: Any = None
    current_path: str | None = None
    show_toc: bool = True
    auth: dict | None = None
    htmx_nav: bool = True
    nav_posts_menu: bool = False
    full_width: bool = False
    show_footer: bool = True
    no_scroll: bool = False
    slide_mode: bool = False
    current_updated_label: str | None = None
    extra_head_nodes: tuple[Any, ...] = ()


@dataclass(frozen=True)
class PageFrameDeps:
    logger: Any
    resolve_layout_config: Callable
    width_class_and_style: Callable
    style_attr: Callable
    get_sidebar_custom_css_links: Callable
    get_root_folder: Callable
    build_sidebar_toc_items: Callable
    extract_sidebar_toc: Callable
    strip_inline_markdown: Callable
    text_to_anchor: Callable
    unique_anchor: Callable
    get_config: Callable
    build_collapsible_sidebar: Callable
    get_roles_from_auth: Callable
    rbac_rules: Any
    rbac_cfg: Any
    google_oauth_cfg: Any
    coerce_list: Callable
    cached_posts_sidebar_html: Callable
    posts_sidebar_fingerprint: Callable
    get_posts: Callable
    navbar: Callable
