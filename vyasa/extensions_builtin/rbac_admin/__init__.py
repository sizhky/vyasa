from ...extensions import ExtensionMeta, VyasaExtensionBase
from .routes import register_rbac_admin_routes


class RbacAdminExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.routes.add("/admin/impersonate", register_rbac_admin_routes)
        app.routes.add("/admin/rbac", register_rbac_admin_routes)


EXTENSION = RbacAdminExtension(
    ExtensionMeta(
        "rbac_admin",
        "route",
        ("cap:route:rbac_admin",),
        route_prefixes=("/admin/impersonate", "/admin/rbac"),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
