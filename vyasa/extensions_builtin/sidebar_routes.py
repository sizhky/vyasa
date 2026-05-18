from urllib.parse import quote

from fasthtml.common import A, Aside, Details, Li, NotStr, Response, Span, Summary, Ul, to_xml
from monsterui.all import UkIcon

from ..extensions import ExtensionMeta, VyasaExtensionBase
from ..content_tree import ContentTree
from ..tree_rendering import FILE_ROW_CLASSES, FOLDER_ROW_CLASSES


class SidebarRoutesExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.routes.add("/_sidebar/posts", _register_sidebar_routes)
        app.routes.add("/_sidebar/posts/branch", _register_sidebar_routes)


def _register_sidebar_routes(rt, runtime) -> None:
    from .. import core

    @rt("/_sidebar/posts")
    def posts_sidebar_lazy(request=None, current_path: str = ""):
        roles = core.get_roles_from_request(request, core._rbac_rules, core._rbac_cfg, core._google_oauth_cfg, core._config._coerce_list)
        html = core._cached_posts_sidebar_html(
            core._posts_sidebar_fingerprint(),
            tuple(roles or []),
            core.get_config().get_show_hidden(),
            current_path or "",
        )
        return Aside(
            NotStr(html),
            cls="hidden xl:block w-[var(--vyasa-sidebar-width,26rem)] shrink-0 sticky top-24 self-start mt-4 max-h-[calc(100vh-10rem)] overflow-x-auto overflow-y-hidden z-[1000]",
            id="posts-sidebar",
        )

    @rt("/_sidebar/posts/branch")
    def posts_sidebar_branch(path: str = "", request=None):
        roles = core.get_roles_from_request(request, core._rbac_rules, core._rbac_cfg, core._google_oauth_cfg, core._config._coerce_list)
        folder = core.content_path_for_slug(path)
        if not folder or not folder.is_dir():
            core.logger.debug("Sidebar branch invalid path={}", path)
            return Response(status_code=404)
        if "@" in str(path).split("/", 1)[0]:
            items = _build_branch_sidebar_items(path, folder)
        else:
            items = core.build_post_tree(folder, roles=roles, max_depth=0)
        core.logger.debug("Sidebar branch path={} resolved={} items={}", path, folder, len(items))
        return "".join(to_xml(item) for item in items)


def _build_branch_sidebar_items(path: str, folder):
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
            title_link = A(
                entry.title,
                href=href,
                hx_get=href,
                hx_target="#main-content",
                hx_push_url="true",
                hx_swap="outerHTML show:window:top settle:0.1s",
                cls="post-link folder-note-link whitespace-nowrap",
                title=f"Open {entry.title}",
                onclick="event.stopPropagation();",
                data_path=full_slug,
            )
            summary = Summary(
                Span(Span(cls="folder-chevron"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
                Span(UkIcon("folder", cls="text-current w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
                title_link,
                cls=FOLDER_ROW_CLASSES,
                hx_get=branch_href,
                hx_trigger="click once",
                hx_target="next ul",
                hx_swap="innerHTML",
            )
            items.append(Li(Details(summary, Ul(cls="ml-4 pl-2 space-y-1 border-l border-slate-100 dark:border-slate-800"), data_folder="true"), cls="my-1"))
            continue
        href = f"/posts/{quote(full_slug, safe='/')}"
        icon = "file-text" if entry.kind == "markdown" else ("file" if entry.kind == "pdf" else "table")
        link = A(
            Span(cls="w-4 mr-2 shrink-0"),
            Span(UkIcon(icon, cls="text-current w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
            Span(entry.title, cls="whitespace-nowrap", title=entry.title),
            href=href,
            hx_get=href,
            hx_target="#main-content",
            hx_push_url="true",
            hx_swap="outerHTML show:window:top settle:0.1s",
            cls=FILE_ROW_CLASSES,
            data_path=full_slug,
        )
        items.append(Li(link))
    return items


EXTENSION = SidebarRoutesExtension(
    ExtensionMeta(
        "sidebar_routes",
        "route",
        ("cap:route:sidebar_routes",),
        route_prefixes=("/_sidebar/posts", "/_sidebar/posts/branch"),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
