from starlette.responses import RedirectResponse, Response

from .policy import is_allowed, normalize_auth, path_requires_roles, resolve_roles


def make_user_auth_before(auth_required, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list):
    def user_auth_before(req, sess):
        auth = sess.get("auth", None)
        if not auth:
            if auth_required or path_requires_roles(req.url.path, rbac_rules):
                sess["next"] = req.url.path
                return RedirectResponse("/login", status_code=303)
            req.scope["auth"] = None
            return None
        auth = normalize_auth(auth)
        if rbac_rules:
            auth["roles"] = auth.get("roles") or resolve_roles(auth, rbac_cfg, google_oauth_cfg, coerce_list)
            if not is_allowed(req.url.path, auth["roles"], rbac_rules):
                return Response("Forbidden", status_code=403)
        req.scope["auth"] = auth
        return None
    return user_auth_before
