from ..extensions import ExtensionMeta, VyasaExtensionBase
from ..runtime_services import get_runtime_services


AUTH_ROUTES = (
    ("/login", ("GET", "POST")),
    ("/login/{provider}", ("GET",)),
    ("/auth/{provider}/callback", ("GET",)),
    ("/logout", ("GET",)),
    ("/unlock", ("GET", "POST")),
    ("/unlock/lock", ("POST",)),
)
AUTH_ROUTE_PREFIXES = tuple(prefix for prefix, _methods in AUTH_ROUTES)


class AuthRoutesExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        for prefix, methods in AUTH_ROUTES:
            app.routes.add(prefix, _register_auth_routes, methods=methods)


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
            oauth_cfg=services.oauth_cfg(),
            coerce_list=services.coerce_list,
            login_content=services.login_content,
            oauth_buttons=[(name, services.oauth_providers[name].label) for name in services.oauth_enabled],
        )

    @rt("/login/{provider}")
    async def login_oauth(request, provider: str):
        services = get_runtime_services()
        if provider not in services.oauth_enabled:
            return Response(status_code=404)
        return await services.start_oauth_login(request, services.oauth, provider)

    @rt("/auth/{provider}/callback")
    async def oauth_callback(request, provider: str):
        services = get_runtime_services()
        if provider not in services.oauth_enabled:
            return Response(status_code=404)
        label = services.oauth_providers[provider].label
        try:
            userinfo = await services.fetch_oauth_userinfo(request, services.oauth, provider, services.logger)
        except Exception as exc:
            services.logger.warning(f"{label} OAuth failed: {exc}")
            return RedirectResponse(f"/login?error={label}+authentication+failed", status_code=303)
        provider_cfg = services.oauth_cfg().get(provider) or {}
        if not services.oauth_account_allowed(userinfo, provider_cfg):
            return RedirectResponse(f"/login?error={label}+account+not+allowed", status_code=303)
        auth = services.build_oauth_auth_payload(provider, userinfo)
        auth["roles"] = services.resolve_roles(auth, services.rbac_cfg(), services.oauth_cfg(), services.coerce_list)
        request.session["auth"] = auth
        return RedirectResponse(request.session.pop("next", "/"), status_code=303)

    @rt("/unlock", methods=["GET", "POST"])
    async def unlock(request):
        from ..auth import unlock as gate
        from ..auth.views import unlock_content

        from ..config import get_config

        passwords = get_config().get_role_passwords()
        if not passwords:
            return Response(status_code=404)
        error = None
        if request.method == "POST":
            client = request.client.host if request.client else "unknown"
            if gate.throttled(client):
                error = "Too many attempts. Wait a minute, then try again."
            else:
                password = str((await request.form()).get("password", ""))
                roles = gate.matching_roles(password, passwords)
                if roles:
                    gate.grant(request.session, roles, passwords)
                    return RedirectResponse(request.session.pop("next", "/"), status_code=303)
                gate.record_failure(client)
                error = "That password does not unlock anything."
        return unlock_content(error, gate.unlocked_roles(request.session, passwords))

    @rt("/unlock/lock", methods=["POST"])
    async def unlock_lock(request):
        from ..auth import unlock as gate

        gate.lock(request.session)
        return RedirectResponse("/unlock", status_code=303)

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
        route_prefixes=AUTH_ROUTE_PREFIXES,
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
