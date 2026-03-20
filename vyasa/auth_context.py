from .auth_policy import normalize_auth, resolve_roles


def get_auth_from_request(request, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list):
    if not request:
        return None
    auth = None
    try:
        auth = request.scope.get("auth")
    except Exception:
        auth = None
    if not auth:
        try:
            auth = request.session.get("auth")
        except Exception:
            auth = None
    auth = normalize_auth(auth) if auth else None
    if auth and rbac_rules:
        auth["roles"] = auth.get("roles") or resolve_roles(auth, rbac_cfg, google_oauth_cfg, coerce_list)
    return auth


def get_roles_from_request(request, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list):
    auth = get_auth_from_request(request, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list)
    return auth.get("roles") if auth else []


def get_roles_from_auth(auth, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list):
    auth = normalize_auth(auth) if auth else None
    if auth and rbac_rules:
        auth["roles"] = auth.get("roles") or resolve_roles(auth, rbac_cfg, google_oauth_cfg, coerce_list)
    return auth.get("roles") if auth else []
