from .auth_routes import AUTH_ROUTE_PREFIXES, AUTH_ROUTES, _register_auth_routes
from .rbac_admin.routes import register_rbac_admin_routes
from ..extensions import ExtensionMeta, VyasaExtensionBase
from fasthtml.common import A, Button, Form
from monsterui.all import UkIcon


class AuthRbacExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        for prefix, methods in AUTH_ROUTES:
            app.routes.add(prefix, _register_auth_routes, methods=methods)
        app.routes.add("/admin/impersonate", register_rbac_admin_routes)
        app.routes.add("/admin/rbac", register_rbac_admin_routes)
        app.layout.footer_link(_admin_footer_links)
        app.layout.footer_link(_unlock_footer_links)


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


def _unlock_footer_links(context):
    from ..config import get_config

    if not get_config().get_role_passwords():
        return ()
    icon_cls = "inline-flex items-center text-white/80 hover:text-white"
    if (context.get("auth") or {}).get("provider") != "unlock":
        return (A(UkIcon("lock", cls="w-4 h-4"), href="/unlock", cls=icon_cls, aria_label="Unlock", title="Unlock"),)
    return (
        Form(Button(UkIcon("lock-open", cls="w-4 h-4"), type="submit", cls=f"{icon_cls} bg-transparent border-0 p-0 cursor-pointer",
                    aria_label="Lock again", title="Unlocked. Click to lock again."),
             method="post", action="/unlock/lock", hx_boost="false", cls="inline-flex"),
    )


EXTENSION = AuthRbacExtension(
    ExtensionMeta(
        "auth_rbac",
        "route",
        ("cap:route:auth_rbac", "cap:layout:footer_link"),
        route_prefixes=(
            *AUTH_ROUTE_PREFIXES,
            "/admin/impersonate",
            "/admin/rbac",
        ),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
