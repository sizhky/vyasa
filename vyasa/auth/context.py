from .policy import normalize_auth, resolve_roles
from .unlock import unlocked_roles


def _session_unlocked_roles(request):
    """Unlocked roles for routes the auth gate skips, such as sidebar partials."""
    try:
        from ..config import get_config
        passwords = get_config().get_role_passwords()
        return unlocked_roles(request.session, passwords) if passwords else []
    except Exception:
        return []


def get_auth_from_request(request, rbac_rules, rbac_cfg, oauth_cfg, coerce_list):
    if not request:
        return None
    auth = None
    try:
        auth = request.scope.get("auth")
    except Exception:
        auth = None
    auth = normalize_auth(auth)
    if auth:
        if rbac_rules:
            auth["roles"] = auth.get("roles") or resolve_roles(auth, rbac_cfg, oauth_cfg, coerce_list)
        return auth
    try:
        auth = request.session.get("auth")
    except Exception:
        auth = None
    unlocked = _session_unlocked_roles(request) if rbac_rules else []
    if not auth:
        return {"provider": "unlock", "roles": unlocked} if unlocked else None
    auth = normalize_auth(auth)
    if auth and rbac_rules:
        auth["roles"] = list(dict.fromkeys(list(auth.get("roles") or resolve_roles(auth, rbac_cfg, oauth_cfg, coerce_list)) + unlocked))
    return auth


def get_roles_from_request(request, rbac_rules, rbac_cfg, oauth_cfg, coerce_list):
    auth = get_auth_from_request(request, rbac_rules, rbac_cfg, oauth_cfg, coerce_list)
    return auth.get("roles") if auth else []


def get_roles_from_auth(auth, rbac_rules, rbac_cfg, oauth_cfg, coerce_list):
    auth = normalize_auth(auth) if auth else None
    if auth and rbac_rules:
        auth["roles"] = auth.get("roles") or resolve_roles(auth, rbac_cfg, oauth_cfg, coerce_list)
    return auth.get("roles") if auth else []
