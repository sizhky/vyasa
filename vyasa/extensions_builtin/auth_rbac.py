from .auth_routes import _register_auth_routes
from .rbac_admin.routes import register_rbac_admin_routes
from ..extensions import ExtensionMeta, VyasaExtensionBase
from fasthtml.common import A


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
        app.layout.footer_link(_admin_footer_links)


def _admin_footer_links(context):
    auth = context.get("auth") or {}
    roles = auth.get("roles") or []
    impersonator_roles = ((auth.get("impersonator") or {}).get("roles")) or []
    is_admin = "full" in roles or "full" in impersonator_roles
    if not is_admin:
        return ()
    return (
        A("RBAC", href="/admin/rbac", cls="text-sm text-white/80 hover:text-white underline"),
        A("Impersonate", href="/admin/impersonate", cls="text-sm text-white/80 hover:text-white underline"),
    )


EXTENSION = AuthRbacExtension(
    ExtensionMeta(
        "auth_rbac",
        "route",
        ("cap:route:auth_rbac", "cap:layout:footer_link"),
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
