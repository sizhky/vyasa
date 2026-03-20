from fasthtml.common import RedirectResponse, Response


async def handle_login(request, *, get_config, logger, local_auth_enabled, resolve_roles, rbac_cfg, google_oauth_cfg, coerce_list, login_content, google_oauth_enabled):
    config = get_config()
    user, pwd = config.get_auth()
    logger.info(f"Login attempt for user: {user}")
    error = request.query_params.get("error")
    if request.method == "POST":
        if not local_auth_enabled:
            return RedirectResponse("/login?error=Local+login+disabled", status_code=303)
        form = await request.form()
        username, password = form.get("username", ""), form.get("password", "")
        if username == user and password == pwd:
            roles = resolve_roles({"provider": "local", "username": username}, rbac_cfg, google_oauth_cfg, coerce_list)
            request.session["auth"] = {"provider": "local", "username": username, "roles": roles}
            return RedirectResponse(request.session.pop("next", "/"), status_code=303)
        error = "Invalid username or password."
    return login_content(error, google_oauth_enabled, local_auth_enabled)


async def handle_admin_impersonate(htmx, request, *, get_auth_from_request, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, apply_impersonation_action, resolve_roles, layout, impersonate_content):
    auth = get_auth_from_request(request, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list)
    roles = auth.get("roles") if auth else []
    impersonator = auth.get("impersonator") if auth else None
    impersonator_roles = impersonator.get("roles") if impersonator else []
    if (not roles or "full" not in roles) and (not impersonator_roles or "full" not in impersonator_roles):
        return Response("Forbidden", status_code=403)
    error = success = None
    if request.method == "POST":
        form = await request.form()
        error, success = apply_impersonation_action(request.session, request.session.get("auth"), form.get("action", "start"), (form.get("email") or "").strip(), lambda imp_auth: resolve_roles(imp_auth, rbac_cfg, google_oauth_cfg, coerce_list))
    current_auth, impersonator = request.session.get("auth"), request.session.get("impersonator")
    impersonating_email = current_auth.get("email") or current_auth.get("username") if impersonator and current_auth and current_auth.get("provider") == "impersonate" else None
    return layout(impersonate_content(error, success, impersonating_email), htmx=htmx, title="Impersonate", show_sidebar=False, auth=auth, htmx_nav=False)


async def handle_admin_rbac(htmx, request, *, get_auth_from_request, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, parse_rbac_form, parse_roles_text, rbac_db_write, write_rbac_to_vyasa, set_rbac_cfg, cached_build_post_tree, cached_posts_sidebar_html, render_rbac_toml, rbac_admin_content, layout):
    auth = get_auth_from_request(request, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list)
    roles = auth.get("roles") if auth else []
    if not roles or "full" not in roles:
        return Response("Forbidden", status_code=403)
    error = success = None
    cfg = rbac_cfg
    if request.method == "POST":
        form = await request.form()
        new_cfg, error = parse_rbac_form(form, parse_roles_text)
        if not error:
            try:
                rbac_db_write(new_cfg); write_rbac_to_vyasa(new_cfg); set_rbac_cfg(new_cfg); cached_build_post_tree.cache_clear(); cached_posts_sidebar_html.cache_clear(); success = "RBAC settings saved."; cfg = new_cfg
            except Exception as exc:
                error = f"Failed to save RBAC settings: {exc}"
    return layout(rbac_admin_content(cfg, error, success, render_rbac_toml(cfg)), htmx=htmx, title="RBAC Admin", show_sidebar=False, auth=auth, htmx_nav=False)
