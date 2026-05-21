from ..extensions import ExtensionMeta, VyasaExtensionBase
from ..runtime_services import get_runtime_services


class AuthRoutesExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.routes.add("/login", _register_auth_routes, methods=("GET", "POST"))
        app.routes.add("/login/google", _register_auth_routes)
        app.routes.add("/auth/google/callback", _register_auth_routes)
        app.routes.add("/logout", _register_auth_routes)


def _register_auth_routes(rt, runtime) -> None:
    from starlette.responses import RedirectResponse, Response

    @rt("/login", methods=["GET", "POST"])
    async def login(request):
        services = get_runtime_services()
        return await services.handle_login(
            request,
            get_config=services.get_config,
            logger=services.logger,
            local_auth_enabled=services.local_auth_enabled,
            resolve_roles=services.resolve_roles,
            rbac_cfg=services.rbac_cfg(),
            google_oauth_cfg=services.google_oauth_cfg(),
            coerce_list=services.coerce_list,
            login_content=services.login_content,
            google_oauth_enabled=services.google_oauth_enabled,
        )

    @rt("/login/google")
    async def login_google(request):
        services = get_runtime_services()
        if not services.google_oauth_enabled:
            return Response(status_code=404)
        return await services.start_google_login(request, services.google_oauth)

    @rt("/auth/google/callback")
    async def google_auth_callback(request):
        services = get_runtime_services()
        if not services.google_oauth_enabled:
            return Response(status_code=404)
        try:
            userinfo = await services.fetch_google_userinfo(request, services.google_oauth, services.logger)
        except Exception as exc:
            services.logger.warning(f"Google OAuth failed: {exc}")
            return RedirectResponse("/login?error=Google+authentication+failed", status_code=303)
        email = userinfo.get("email") if isinstance(userinfo, dict) else None
        if not services.google_account_allowed(email, services.google_oauth_cfg()):
            return RedirectResponse("/login?error=Google+account+not+allowed", status_code=303)
        auth = services.build_google_auth_payload(userinfo)
        auth["roles"] = services.resolve_roles(auth, services.rbac_cfg(), services.google_oauth_cfg(), services.coerce_list)
        request.session["auth"] = auth
        return RedirectResponse(request.session.pop("next", "/"), status_code=303)

    @rt("/logout")
    async def logout(request):
        request.session.pop("auth", None)
        request.session.pop("next", None)
        return RedirectResponse("/login", status_code=303)


EXTENSION = AuthRoutesExtension(
    ExtensionMeta(
        "auth_routes",
        "route",
        ("cap:route:auth_routes",),
        route_prefixes=("/login", "/login/google", "/auth/google/callback", "/logout"),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
