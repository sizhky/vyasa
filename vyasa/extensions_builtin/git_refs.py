from fasthtml.common import NotStr, Response, to_xml

from ..extensions import ExtensionMeta, VyasaExtensionBase
from ..runtime_services import get_runtime_services
from .. import git_refs


class GitRefsExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.routes.add("/_vyasa/refresh-refs", _register_git_ref_routes)
        app.navigation.navbar_control(_navbar_control)


def _navbar_control(context):
    return git_refs.navbar_ref_switcher(context.get("current_path"), roles=context.get("roles"))


def _roles_from_request(request):
    services = get_runtime_services()
    return services.get_roles_from_request(request, services.rbac_rules(), services.rbac_cfg(), services.google_oauth_cfg(), services.coerce_list)


def _register_git_ref_routes(rt, runtime) -> None:
    @rt("/_vyasa/refresh-refs")
    def refresh_refs(request=None):
        return git_refs.refresh_refs_for_root("", request)

    @rt("/_vyasa/refresh-refs/root/{root:path}")
    def refresh_refs_root(root: str, request=None):
        return git_refs.refresh_refs_for_root(root, request)

    @rt("/_vyasa/refresh-ref-tree/{path:path}")
    def refresh_ref_tree(path: str, request=None):
        return git_refs.refresh_ref_tree(path, request)

    @rt("/_vyasa/ref-switcher")
    def ref_switcher(current_path: str = "", request=None):
        node = git_refs.navbar_ref_switcher(current_path, roles=_roles_from_request(request))
        return NotStr(to_xml(node)) if node else Response(status_code=204)


EXTENSION = GitRefsExtension(
    ExtensionMeta(
        "git_refs",
        "route",
        ("cap:route:git_refs", "cap:navigation:git_refs"),
        route_prefixes=("/_vyasa/refresh-refs", "/_vyasa/refresh-refs/root", "/_vyasa/refresh-ref-tree", "/_vyasa/ref-switcher"),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
