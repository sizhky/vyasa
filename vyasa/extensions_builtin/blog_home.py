from fasthtml.common import A, Div, H1, P, Span

from ..extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase
from ..helpers import (
    content_slug_for_path,
    content_url_for_slug,
    estimate_read_time_minutes,
    expand_markdown_includes_for_reading,
    get_content_mounts,
    get_vyasa_config,
    iter_visible_files,
    preview_markdown,
)
from ..runtime_services import get_runtime_services
from .markdown.renderer import from_md


def _home_provider(htmx, request):
    services = get_runtime_services()
    roots = services.get_content_mounts()
    root = roots[0][1] if roots else services.get_root_folder()
    roles = services.get_roles_from_auth(request.scope.get("auth"), services.rbac_rules(), services.rbac_cfg(), services.google_oauth_cfg(), services.coerce_list)
    entries = sort_entries(iter_home_files(roots, roles, is_allowed_fn=services.is_allowed, rbac_rules=services.rbac_rules(), iter_files=services.iter_visible_files, slug_for_path=services.content_slug_for_path), root, get_sort=services.get_config().get_home_sort, created_ts=services.get_file_created_ts)
    feed = services.render_blog_home_feed(entries, root, 0)
    shell = Div(H1(f"Welcome to {services.get_blog_title()}!", cls="vyasa-page-title text-4xl font-bold"), P("Latest posts", cls="mt-2 text-slate-500"), feed, cls="space-y-6")
    return services.layout(shell, htmx=htmx, title=f"Home - {services.get_blog_title()}", show_sidebar=True, current_path="__home__", auth=request.scope.get("auth"))


def _feed_provider(offset=0, htmx=None, request=None):
    services = get_runtime_services()
    roots = services.get_content_mounts()
    root = roots[0][1] if roots else services.get_root_folder()
    roles = services.get_roles_from_auth(request.scope.get("auth"), services.rbac_rules(), services.rbac_cfg(), services.google_oauth_cfg(), services.coerce_list) if request else None
    entries = sort_entries(iter_home_files(roots, roles, is_allowed_fn=services.is_allowed, rbac_rules=services.rbac_rules(), iter_files=services.iter_visible_files, slug_for_path=services.content_slug_for_path), root, get_sort=services.get_config().get_home_sort, created_ts=services.get_file_created_ts)
    return services.render_blog_home_feed(entries, root, max(0, offset), wrap=False)


def iter_home_files(roots=None, roles=None, *, is_allowed_fn, rbac_rules, iter_files=iter_visible_files, slug_for_path=content_slug_for_path):
    for _, root in roots or get_content_mounts():
        for path in iter_files(root, (".md",), include_hidden=False):
            if path.name.startswith(".") or is_ignored(path, root):
                continue
            if path.parent == root and path.stem.lower() in {"index", "readme"}:
                continue
            slug = slug_for_path(path)
            if not slug:
                continue
            if roles is not None and not is_allowed_fn(f"/posts/{slug}", roles, rbac_rules):
                continue
            yield path, slug


def sort_entries(entries, root, *, get_sort, created_ts):
    sort = get_sort()
    items = list(entries)
    if sort == "name_asc":
        return sorted(items, key=lambda item: item[1].lower())
    if sort == "name_desc":
        return sorted(items, key=lambda item: item[1].lower(), reverse=True)
    return sorted(items, key=lambda item: created_ts(item[0]), reverse=True)


def is_ignored(path, root):
    relative = path.relative_to(root)
    ignore_names = set()
    ancestor = root
    ignore_names.update(str(item).strip() for item in (get_vyasa_config(root).get("ignore") or []) if str(item).strip())
    for part in relative.parts[:-1]:
        ancestor = ancestor / part
        ignore_names.update(str(item).strip() for item in (get_vyasa_config(ancestor).get("ignore") or []) if str(item).strip())
    candidates = set(relative.parts) | set(relative.with_suffix("").parts) | {path.name, path.stem}
    return bool(ignore_names.intersection(candidates))


def render_card(path, slug, root, *, resolve_title, abbreviations):
    title, render_content = resolve_title(path, abbreviations=abbreviations(root))
    read_source = expand_markdown_includes_for_reading(render_content, current_path=slug, root_folder=root)
    read_time = estimate_read_time_minutes(read_source)
    preview = from_md(preview_markdown(render_content), current_path=slug)
    href = content_url_for_slug(slug)
    return Div(
        A(Span(title, cls="block line-clamp-3 overflow-hidden"), Span(f"{read_time}-min read", cls="block mt-1 text-xs font-normal text-slate-500 dark:text-slate-400"), href=href, cls="vyasa-blog-card-title absolute top-6 block text-right text-xl font-bold leading-tight hover:underline"),
        Div(Div(preview, cls="prose prose-slate dark:prose-invert max-w-none"), A("continue reading...", href=href, cls="inline-flex mt-4 text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200 hover:underline"), cls="vyasa-blog-card min-w-0 w-full"),
        cls="relative flex w-full items-start",
    )


def render_feed(entries, root, offset=0, batch_size=4, wrap=True):
    services = get_runtime_services()
    cards = [render_card(path, slug, root, resolve_title=services.resolve_markdown_title, abbreviations=services.effective_abbreviations) for path, slug in entries[offset:offset + batch_size]]
    sentinel = Div(id="blog-feed-sentinel", cls="h-8", hx_get=f"/_home/feed?offset={offset + batch_size}", hx_trigger="revealed once", hx_target="this", hx_swap="outerHTML") if offset + batch_size < len(entries) else ""
    if wrap:
        return Div(*cards, sentinel, id="blog-feed", cls="space-y-4")
    return tuple([*cards, sentinel] if sentinel else cards)


def _page_bundles(context):
    return ("blog_home.runtime",) if context.get("current_path") == "__home__" else ()


class BlogHomeExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.assets.bundle(AssetBundle("blog_home.runtime", css=("/static/extensions/blog_home/blog_home.css",)))
        app.assets.page(_page_bundles)
        app.layout.slot("home", _home_provider)
        app.layout.slot("home_feed", _feed_provider)


EXTENSION = BlogHomeExtension(
    ExtensionMeta(
        "blog_home",
        "home",
        ("slot:home", "slot:home_feed", "bundle:blog_home.runtime"),
        requires=("slot:layout",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
