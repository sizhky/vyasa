"""MkDocs compatibility: nav tree, header tabs, and MkDocs Markdown dialect.

Implements vyasa manual/mkdocs-compatibility.md.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from fasthtml.common import Div, NotStr, Span

from ...config import config_generation, get_config
from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase
from .config import markdown_extension_names
from .dialect import Translator
from .html_post import postprocess
from .nav import apply_indexes, derive_nav, flat_pages, gitignore_matcher, parse_nav, page_slug
from .render import item_title, nav_tree_items, tabs_band

_NAV_CACHE: dict[int, tuple] = {}


def mkdocs_settings() -> dict:
    value = get_config().get("mkdocs", "VYASA_MKDOCS", {})
    return value if isinstance(value, dict) else {}


def theme_features() -> set[str]:
    theme = mkdocs_settings().get("theme") or {}
    return {str(f) for f in theme.get("features") or []} if isinstance(theme, dict) else set()


def docs_dir() -> Path:
    raw = mkdocs_settings().get("docs_dir_path")
    return Path(raw) if raw else get_config().get_root_folder()


def nav_items():
    """Parsed nav for the loaded config; derived from files when `nav` is absent."""
    key = config_generation()
    cached = _NAV_CACHE.get(key)
    if cached is not None and cached[0] == _docs_fingerprint():
        return cached[1]
    settings = mkdocs_settings()
    root = docs_dir()
    hidden = gitignore_matcher("\n".join(filter(None, [".*\n/templates/", str(settings.get("exclude_docs") or ""), str(settings.get("not_in_nav") or ""), str(settings.get("draft_docs") or "")])))
    items = parse_nav(settings["nav"], root) if settings.get("nav") else derive_nav(root, excluded=hidden)
    if "navigation.indexes" in theme_features():
        items = apply_indexes(items)
    _NAV_CACHE.clear()
    _NAV_CACHE[key] = (_docs_fingerprint(), items)
    return items


def _docs_fingerprint() -> float:
    try:
        return docs_dir().stat().st_mtime
    except OSError:
        return 0.0


def current_slug(current_path) -> str:
    """Slug of the page being viewed; the site root is its index page.

    >>> current_slug("/posts/guide/setup")
    'guide/setup'
    """
    slug = str(current_path or "").strip("/")
    slug = slug.removeprefix("posts/")
    return page_slug(slug) if slug else "index"


def _posts_tree(*, roles=None, current_path="", can_read=lambda route: True, row_decorators=()):
    return nav_tree_items(
        nav_items(),
        docs_dir=docs_dir(),
        features=theme_features(),
        current_slug=current_slug(current_path),
        can_read=can_read,
        decorators=row_decorators,
    )


def _adjacent(current_path):
    """Prev/next in nav order; pages outside the nav get none, as in MkDocs."""
    from ...helpers import content_url_for_slug

    pages = [page for page in flat_pages(nav_items()) if not page.missing]
    slugs = [page_slug(page.path) for page in pages]
    slug = current_slug(current_path)
    if slug not in slugs:
        return (None, None)
    index = slugs.index(slug)
    root = docs_dir()

    def link(page):
        return {"title": item_title(page, root), "href": content_url_for_slug(page_slug(page.path))}

    return (link(pages[index - 1]) if index > 0 else None, link(pages[index + 1]) if index + 1 < len(pages) else None)


def _page_options(metadata, current_path):
    """Material `hide:` front matter; `navigation` alone has no Vyasa equivalent."""
    hidden = metadata.get("hide") or []
    hidden = {str(item) for item in ([hidden] if isinstance(hidden, str) else hidden)}
    if {"navigation", "toc"} <= hidden:
        return {"show_sidebar": False}
    return {"show_toc": False} if "toc" in hidden else {}


def _asset_href(value: str) -> str:
    from ...helpers import content_url_for_slug

    return value if re.match(r"^(https?:)?//", value) or value.startswith("/") else content_url_for_slug(value)


def _extra_assets(context):
    """`extra_css` and `extra_javascript` from mkdocs.yml, served from docs_dir."""
    from fasthtml.common import Link, Script

    settings = mkdocs_settings()
    nodes = [Link(rel="stylesheet", href=_asset_href(str(item))) for item in settings.get("extra_css") or [] if isinstance(item, str)]
    for item in settings.get("extra_javascript") or []:
        entry = {"path": item} if isinstance(item, str) else dict(item) if isinstance(item, dict) else {}
        if not entry.get("path"):
            continue
        attrs: dict[str, Any] = {key: True for key in ("async", "defer") if entry.get(key)}
        if entry.get("type"):
            attrs["type"] = entry["type"]
        nodes.append(Script(src=_asset_href(str(entry["path"])), **attrs))
    return Div(*nodes, cls="hidden", data_mkdocs_extra_assets="true") if nodes else None


def _footer_links(context):
    from fasthtml.common import NotStr, Span

    copyright_text = mkdocs_settings().get("copyright")
    return [Span(NotStr(str(copyright_text)), cls="text-sm")] if copyright_text else []


def _repo_link(context):
    from fasthtml.common import A
    from .icons import icon_html

    settings = mkdocs_settings()
    url = settings.get("repo_url")
    if not url:
        return None
    host = urlsplit(str(url)).netloc.lower()
    icon = "fontawesome-brands-github" if "github" in host else "fontawesome-brands-gitlab" if "gitlab" in host else "fontawesome-brands-git-alt"
    name = settings.get("repo_name") or urlsplit(str(url)).path.strip("/")
    return A(NotStr(icon_html(icon) or ""), Span(name, cls="hidden 2xl:inline"), href=str(url), target="_blank", rel="noopener", cls="vyasa-navbar-icon-button vyasa-mkdocs-repo inline-flex items-center gap-2 px-2", title=name)


def edit_url(relative_file_path: str) -> str | None:
    """MkDocs `repo_url` + `edit_uri` (or `edit_uri_template`) for a docs-relative file."""
    settings = mkdocs_settings()
    repo = str(settings.get("repo_url") or "").rstrip("/")
    template = settings.get("edit_uri_template")
    if template:
        return f"{repo}/{str(template).format(path=relative_file_path).lstrip('/')}" if repo else str(template).format(path=relative_file_path)
    edit_uri = settings.get("edit_uri")
    if edit_uri is None and repo:
        host = urlsplit(repo).netloc.lower()
        edit_uri = "edit/master/docs/" if ("github" in host or "gitlab" in host) else "src/default/docs/" if "bitbucket" in host else None
    if not edit_uri or (not repo and not re.match(r"^https?://", str(edit_uri))):
        return None
    base = str(edit_uri) if re.match(r"^https?://", str(edit_uri)) else f"{repo}/{str(edit_uri).lstrip('/')}"
    return base.rstrip("/") + "/" + relative_file_path.lstrip("/")


def _edit_action(context):
    from ...document_pages import DocumentActionItem, external_action_link

    settings = mkdocs_settings()
    wanted = "content.action.edit" in theme_features() or settings.get("edit_uri") or settings.get("edit_uri_template")
    url = edit_url(context.relative_file_path) if wanted and context.relative_file_path else None
    if not url:
        return None
    return DocumentActionItem(id="mkdocs.edit", node=external_action_link("Edit", url, "Edit this page in the repository"), order=40)


def _navbar_band(context):
    if "navigation.tabs" not in theme_features():
        return None
    from ...auth.policy import is_allowed
    from ...runtime_services import get_runtime_services

    rules = get_runtime_services().rbac_rules()
    roles = context.get("roles") or []
    return tabs_band(nav_items(), docs_dir=docs_dir(), current_slug=current_slug(context.get("current_path")), can_read=lambda route: is_allowed(route, roles, rules))


def _translate(markdown: str) -> str:
    settings = mkdocs_settings()
    config_file = settings.get("config_file")
    translator = Translator(
        markdown_extension_names(settings.get("markdown_extensions")),
        config_dir=Path(config_file).parent if config_file else None,
        docs_dir=docs_dir(),
    )
    return translator.translate(markdown)


def _page_bundles(context):
    return ("mkdocs.runtime",)


class MkDocsExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.content_source.posts_tree(_posts_tree)
        app.content_source.adjacent(_adjacent)
        app.documents.page_options(_page_options)
        app.documents.action(_edit_action)
        app.layout.body_fragment(_extra_assets)
        app.layout.footer_link(_footer_links)
        app.navigation.navbar_control(_repo_link)
        app.markdown.translator(_translate)
        app.markdown.postprocessor(postprocess)
        app.layout.navbar_band(_navbar_band)
        app.assets.bundle(AssetBundle("mkdocs.runtime", css=("/static/extensions/mkdocs/mkdocs.css",), js=("/static/extensions/mkdocs/mkdocs.js",)))
        app.assets.page(_page_bundles)


EXTENSION = MkDocsExtension(
    ExtensionMeta(
        "mkdocs",
        "render",
        ("cap:mkdocs", "cap:layout:navbar_band", "cap:layout:body_fragment", "cap:layout:footer_link", "bundle:mkdocs.runtime"),
        requires=("cap:markdown_pipeline",),
        description="Serve an MkDocs project: nav, header tabs, and MkDocs Markdown syntax.",
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
