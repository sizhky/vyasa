from ..extensions import ExtensionMeta, VyasaExtensionBase


class SidebarRoutesExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.routes.add("/_sidebar/posts", _register_sidebar_routes)
        app.routes.add("/_sidebar/posts/branch", _register_sidebar_routes)


def _register_sidebar_routes(rt, runtime) -> None:
    from fasthtml.common import Aside, NotStr, Response, to_xml

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
        items = core.build_post_tree(folder, roles=roles, max_depth=0)
        core.logger.debug("Sidebar branch path={} resolved={} items={}", path, folder, len(items))
        return "".join(to_xml(item) for item in items)


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
