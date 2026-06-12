from pathlib import Path
from urllib.parse import quote

from fasthtml.common import A, Aside, Details, Li, NotStr, Response, Span, Summary, Ul, to_xml
from monsterui.all import UkIcon

from ..extensions import ExtensionMeta, VyasaExtensionBase
from ..content_tree import ContentTree
from ..tree_rendering import _folder_summary, _decorate_row
from ..nav_views import FILE_ROW_CLASSES, NavigationRow, navigation_row_view
from ..sidebar_helpers import docked_sidebar_classes
from ..runtime_services import get_runtime_services
from ..helpers import document_icon_for_path


class SidebarRoutesExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.routes.add("/_sidebar/posts", _register_sidebar_routes)
        app.routes.add("/_sidebar/posts/branch", _register_sidebar_routes)
        app.routes.add("/_sidebar/posts/git-root", _register_sidebar_routes)


def _register_sidebar_routes(rt, runtime) -> None:
    @rt("/_sidebar/posts")
    def posts_sidebar_lazy(request=None, current_path: str = ""):
        services = get_runtime_services()
        roles = services.get_roles_from_request(request, services.rbac_rules(), services.rbac_cfg(), services.google_oauth_cfg(), services.coerce_list)
        html = services.cached_posts_sidebar_html(
            services.posts_sidebar_fingerprint(),
            tuple(roles or []),
            services.get_config().get_show_hidden(),
            current_path or "",
        )
        return Aside(
            NotStr(html),
            cls=docked_sidebar_classes("posts"),
            id="posts-sidebar",
        )

    @rt("/_sidebar/posts/branch")
    def posts_sidebar_branch(path: str = "", request=None):
        services = get_runtime_services()
        roles = services.get_roles_from_request(request, services.rbac_rules(), services.rbac_cfg(), services.google_oauth_cfg(), services.coerce_list)
        folder = services.content_path_for_slug(path)
        if not folder or not folder.is_dir():
            services.logger.debug("Sidebar branch invalid path={}", path)
            return Response(status_code=404)
        if "@" in str(path).split("/", 1)[0]:
            items = _build_branch_sidebar_items(path, folder, services.sidebar_row_decorators())
        else:
            items = services.build_post_tree(folder, roles=roles, max_depth=0)
        services.logger.debug("Sidebar branch path={} resolved={} items={}", path, folder, len(items))
        return "".join(to_xml(item) for item in items)

    @rt("/_sidebar/posts/git-root")
    def posts_sidebar_git_root(path: str = "", request=None):
        services = get_runtime_services()
        folder = services.content_path_for_slug(path)
        if not folder or not folder.is_dir():
            return Response(status_code=404)
        row_decorators = services.sidebar_row_decorators()
        item = _build_git_root_row(path, folder, row_decorators, services)
        return to_xml(item) if item else Response(status_code=404)


def _build_branch_sidebar_items(path: str, folder, row_decorators=()):
    branch_prefix = str(path).strip("/").split("/", 1)[0]
    snapshot_root = folder if str(path).strip("/") == branch_prefix else None
    if snapshot_root is None:
        from ..helpers import content_path_for_slug

        snapshot_root = content_path_for_slug(branch_prefix)
    if not snapshot_root or not snapshot_root.is_dir():
        return []
    tree = ContentTree(
        root=snapshot_root,
        show_hidden=False,
        excluded_dirs=set(),
        mounts=[("", snapshot_root)],
    )
    items = []
    for entry in tree.list_entries_for_path(folder):
        full_slug = f"{branch_prefix}/{entry.slug}".strip("/")
        if entry.kind == "folder":
            href = f"/posts/{quote(full_slug, safe='/')}"
            branch_href = f"/_sidebar/posts/branch?path={quote(full_slug, safe='')}"
            title_link = navigation_row_view(
                NavigationRow(slug=full_slug, title=f"Open {entry.title}", label=entry.title, href=href, icon="folder", kind="folder", folder_note=True),
                cls="post-link folder-note-link whitespace-nowrap",
                onclick="event.stopPropagation();",
                show_icon=False,
            )
            summary = _folder_summary(_decorate_row(title_link, full_slug, entry.title, row_decorators, context="tree-inline"), branch_href=branch_href)
            items.append(Li(Details(summary, Ul(cls="ml-4 pl-2 space-y-1 border-l border-slate-100 dark:border-slate-800"), data_folder="true"), cls="my-1"))
            continue
        href = f"/posts/{quote(full_slug, safe='/')}"
        icon = document_icon_for_path(entry.path)
        link = navigation_row_view(NavigationRow(slug=full_slug, title=entry.title, label=entry.title, href=href, icon=icon, kind=entry.kind), cls=FILE_ROW_CLASSES)
        items.append(Li(_decorate_row(link, full_slug, entry.title, row_decorators)))
    return items


def _build_git_root_row(path: str, folder, row_decorators, services):
    branch_prefix = str(path).strip("/")
    snapshot_root = folder
    tree = ContentTree(
        root=snapshot_root,
        show_hidden=False,
        excluded_dirs=set(),
        mounts=[("", snapshot_root)],
    )
    note_file = tree.find_folder_note("")
    title = services.slug_to_title(Path(branch_prefix.split("@", 1)[0]).name, abbreviations=services.effective_abbreviations(snapshot_root))
    href = f"/posts/{quote(branch_prefix, safe='/')}"
    title_node = navigation_row_view(
        NavigationRow(slug=f"{branch_prefix}/{note_file.stem}" if note_file else branch_prefix, title=f"Open {title}", label=title, href=href, icon="folder", kind="folder", folder_note=True),
        cls="post-link folder-note-link whitespace-nowrap",
        onclick="event.stopPropagation();",
        show_icon=False,
    ) if note_file else Span(title, cls="vyasa-tree-link whitespace-nowrap", title=title)
    title_node = _decorate_row(title_node, branch_prefix, title, row_decorators, context="tree-inline")
    branch_href = f"/_sidebar/posts/branch?path={quote(branch_prefix, safe='')}"
    children = _build_branch_sidebar_items(branch_prefix, snapshot_root, row_decorators)
    return Li(Details(_folder_summary(title_node, branch_href=branch_href), Ul(*children, cls="ml-4 pl-2 space-y-1 border-l border-slate-100 dark:border-slate-800"), data_folder="true", open=True), cls="my-1")


EXTENSION = SidebarRoutesExtension(
    ExtensionMeta(
        "sidebar_routes",
        "route",
        ("cap:route:sidebar_routes",),
        route_prefixes=("/_sidebar/posts", "/_sidebar/posts/branch", "/_sidebar/posts/git-root"),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
