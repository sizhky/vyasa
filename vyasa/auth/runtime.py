from starlette.responses import RedirectResponse, Response

from .policy import is_allowed, normalize_auth, path_requires_roles, resolve_roles


def make_user_auth_before(auth_required, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list):
    value = lambda item: item() if callable(item) else item

    def user_auth_before(req, sess):
        rules = value(rbac_rules)
        is_api_request = req.url.path.startswith("/api/")
        auth = sess.get("auth", None)
        if not auth:
            if is_api_request:
                req.scope["auth"] = None
                return None
            if auth_required or path_requires_roles(req.url.path, rules):
                sess["next"] = req.url.path
                return RedirectResponse("/login", status_code=303)
            req.scope["auth"] = None
            return None
        auth = normalize_auth(auth)
        if rules:
            auth["roles"] = resolve_roles(auth, value(rbac_cfg), value(google_oauth_cfg), coerce_list)
            if not is_allowed(req.url.path, auth["roles"], rules):
                return Response("Forbidden", status_code=403)
        req.scope["auth"] = auth
        return None
    return user_auth_before
