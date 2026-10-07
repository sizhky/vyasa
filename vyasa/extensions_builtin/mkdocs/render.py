"""Sidebar tree and header tabs built from the MkDocs nav model.

Implements vyasa manual/mkdocs-compatibility.md#navigation; rows reuse the
filesystem tree's row views so active state, decorators, and pins behave alike.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fasthtml.common import A, Details, Div, Li, Nav, Span, Ul

from ...helpers import content_url_for_slug, document_icon_for_path, get_post_title
from ...nav_views import FILE_ROW_CLASSES, NavigationRow, navigation_row_view
from ...tree_rendering import _decorate_row, _folder_summary
from .nav import NavItem, contains_slug, page_slug

CHILD_LIST_CLASSES = "ml-4 pl-2 space-y-1 border-l border-vyasa-border"
TAB_LINK_ATTRS = {"hx_target": "#main-content", "hx_push_url": "true", "hx_swap": "outerHTML show:window:top settle:0.1s"}


def item_title(item: NavItem, docs_dir: Path) -> str:
    """Nav title, else the page's own title (front matter, first H1, filename)."""
    if item.title:
        return item.title
    if item.kind == "page" and not item.missing:
        title = get_post_title(docs_dir / item.path)
        # MkDocs titles the homepage "Home" when it has no H1 or front matter title.
        return "Home" if item.path.lower() in {"index.md", "readme.md"} and title.lower() in {"index", "readme"} else title
    return Path(item.path).stem if item.path else (item.url or "")


def _page_row(item: NavItem, docs_dir: Path, decorators, *, title: str | None = None):
    title = title or item_title(item, docs_dir)
    if item.missing:
        return Span(title, cls=f"vyasa-tree-link vyasa-mkdocs-missing {FILE_ROW_CLASSES}", title=f"Not found in docs_dir: {item.path}")
    slug = page_slug(item.path)
    row = NavigationRow(slug=slug, title=title, label=title, href=content_url_for_slug(slug), icon=document_icon_for_path(docs_dir / item.path), kind="md")
    return _decorate_row(navigation_row_view(row, cls=FILE_ROW_CLASSES), slug, title, decorators)


def _link_row(item: NavItem):
    row = NavigationRow(slug=None, title=item.url, label=item.title or item.url, href=item.url, icon="external-link", kind="link")
    return navigation_row_view(row, cls=FILE_ROW_CLASSES, external=True)


def _visible(item: NavItem, can_read) -> bool:
    if item.kind == "link":
        return True
    if item.kind == "page":
        return item.missing or can_read(content_url_for_slug(page_slug(item.path)))
    return bool(item.path and can_read(content_url_for_slug(page_slug(item.path)))) or any(_visible(child, can_read) for child in item.children)


def nav_tree_items(items, *, docs_dir: Path, features: set[str], current_slug: str, can_read, decorators, depth: int = 0, trail: str = "") -> list:
    """`<li>` rows for one nav level, in the posts tree's markup."""
    tabs = "navigation.tabs" in features
    section_depth = 1 if tabs else 0
    rows = []
    for index, item in enumerate(items):
        if not _visible(item, can_read):
            continue
        attrs: dict[str, Any] = {"data_mkdocs_tab": str(index)} if tabs and depth == 0 else {}
        if item.kind == "link":
            rows.append(Li(_link_row(item), **attrs))
            continue
        if item.kind == "page":
            rows.append(Li(_page_row(item, docs_dir, decorators), **attrs))
            continue
        title = item_title(item, docs_dir)
        path = f"{trail}/{title}" if trail else title
        children = nav_tree_items(item.children, docs_dir=docs_dir, features=features, current_slug=current_slug, can_read=can_read, decorators=decorators, depth=depth + 1, trail=path)
        index_row = _page_row(NavItem(title, "page", path=item.path), docs_dir, decorators, title=title) if item.path else None
        title_node = index_row if index_row is not None else Span(title, cls="vyasa-tree-link whitespace-nowrap", title=title)
        if tabs and depth == 0 and item.path:
            # The tab's own summary is hidden on desktop, so its index page leads the list.
            children = [Li(_page_row(NavItem(title, "page", path=item.path), docs_dir, decorators, title=title), cls="vyasa-mkdocs-tab-index"), *children]
        is_group = (tabs and depth == 0) or ("navigation.sections" in features and depth == section_depth)
        expanded = is_group or "navigation.expand" in features or contains_slug(item, current_slug)
        details_attrs: dict[str, Any] = {"data_mkdocs_section": "true"} if is_group else {}
        rows.append(Li(
            Details(_folder_summary(title_node), Ul(*children, cls=CHILD_LIST_CLASSES), data_folder="true", data_folder_path=f"mkdocs:{path}", open=expanded, **details_attrs),
            cls="my-1",
            **attrs,
        ))
    return rows


def tab_pages(item: NavItem) -> list[str]:
    """Slugs that activate this tab."""
    slugs = [page_slug(item.path)] if item.path else []
    return slugs + [slug for child in item.children for slug in tab_pages(child)]


def tabs_band(items, *, docs_dir: Path, current_slug: str, can_read):
    """Header row with one tab per top-level nav item (`navigation.tabs`)."""
    links = []
    for index, item in enumerate(items):
        if not _visible(item, can_read):
            continue
        target = item.first_url_item()
        title = item_title(item, docs_dir)
        active = contains_slug(item, current_slug)
        cls = "vyasa-mkdocs-tab" + (" is-active" if active else "")
        if target is None:
            links.append(Span(title, cls=f"{cls} vyasa-mkdocs-missing", title="No page of this tab exists in docs_dir", data_mkdocs_tab=str(index), data_mkdocs_pages="[]"))
            continue
        if target.kind == "link":
            links.append(A(title, href=target.url, cls=cls, target="_blank", rel="noopener", data_mkdocs_tab=str(index), data_mkdocs_pages="[]"))
            continue
        href = content_url_for_slug(page_slug(target.path))
        links.append(A(title, href=href, hx_get=href, cls=cls, data_mkdocs_tab=str(index), data_mkdocs_pages=json.dumps(tab_pages(item)), **TAB_LINK_ATTRS))
    if not links:
        return None
    return Div(Nav(*links, cls="vyasa-mkdocs-tabs-inner", aria_label="Sections"), cls="vyasa-mkdocs-tabs hidden xl:block", id="vyasa-mkdocs-tabs")
