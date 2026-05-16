from ..extensions import ExtensionMeta, VyasaExtensionBase


class AuthRoutesExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.routes.add("/login", _register_auth_routes, methods=("GET", "POST"))
        app.routes.add("/login/google", _register_auth_routes)
        app.routes.add("/auth/google/callback", _register_auth_routes)
        app.routes.add("/logout", _register_auth_routes)


def _register_auth_routes(rt, runtime) -> None:
    from starlette.responses import RedirectResponse, Response

    from .. import core

    @rt("/login", methods=["GET", "POST"])
    async def login(request):
        return await core.handle_login(
            request,
            get_config=core.get_config,
            logger=core.logger,
            local_auth_enabled=core._local_auth_enabled,
            resolve_roles=core.resolve_roles,
            rbac_cfg=core._rbac_cfg,
            google_oauth_cfg=core._google_oauth_cfg,
            coerce_list=core._config._coerce_list,
            login_content=core.login_content,
            google_oauth_enabled=core._google_oauth_enabled,
        )

    @rt("/login/google")
    async def login_google(request):
        if not core._google_oauth_enabled:
            return Response(status_code=404)
        return await core.start_google_login(request, core._google_oauth)

    @rt("/auth/google/callback")
    async def google_auth_callback(request):
        if not core._google_oauth_enabled:
            return Response(status_code=404)
        try:
            userinfo = await core.fetch_google_userinfo(request, core._google_oauth, core.logger)
        except Exception as exc:
            core.logger.warning(f"Google OAuth failed: {exc}")
            return RedirectResponse("/login?error=Google+authentication+failed", status_code=303)
        email = userinfo.get("email") if isinstance(userinfo, dict) else None
        if not core.google_account_allowed(email, core._google_oauth_cfg):
            return RedirectResponse("/login?error=Google+account+not+allowed", status_code=303)
        auth = core.build_google_auth_payload(userinfo)
        auth["roles"] = core.resolve_roles(auth, core._rbac_cfg, core._google_oauth_cfg, core._config._coerce_list)
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
