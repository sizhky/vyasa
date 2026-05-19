from .auth_routes import _register_auth_routes
from .rbac_admin.routes import register_rbac_admin_routes
from ..extensions import ExtensionMeta, VyasaExtensionBase


class AuthRbacExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        for prefix, methods in (
            ("/login", ("GET", "POST")),
            ("/login/google", ("GET",)),
            ("/auth/google/callback", ("GET",)),
            ("/logout", ("GET",)),
        ):
            app.routes.add(prefix, _register_auth_routes, methods=methods)
        app.routes.add("/admin/impersonate", register_rbac_admin_routes)
        app.routes.add("/admin/rbac", register_rbac_admin_routes)


EXTENSION = AuthRbacExtension(
    ExtensionMeta(
        "auth_rbac",
        "route",
        ("cap:route:auth_rbac",),
        route_prefixes=(
            "/login",
            "/login/google",
            "/auth/google/callback",
            "/logout",
            "/admin/impersonate",
            "/admin/rbac",
        ),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
