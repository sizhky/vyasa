from typing import Callable

from starlette.responses import RedirectResponse, Response

from .policy import is_allowed, normalize_auth, path_requires_roles, resolve_roles
from .unlock import unlocked_roles


def make_user_auth_before(auth_required, rbac_rules, rbac_cfg, oauth_cfg, coerce_list, role_passwords: Callable[[], dict] | dict = dict):
    value = lambda item: item() if callable(item) else item

    def to_gate(req, sess, passwords):
        """Protected path, missing role: shared passwords open at /unlock, accounts at /login."""
        sess["next"] = req.url.path
        return RedirectResponse("/unlock" if passwords else "/login", status_code=303)

    def user_auth_before(req, sess):
        rules = value(rbac_rules)
        passwords = dict(role_passwords() if callable(role_passwords) else role_passwords or {})
        unlocked = unlocked_roles(sess, passwords) if passwords else []
        is_api_request = req.url.path.startswith("/api/")
        auth = sess.get("auth", None)
        if not auth:
            # An unlock is not an account, so it never satisfies a site-wide login requirement.
            if unlocked and not auth_required:
                if not is_allowed(req.url.path, unlocked, rules):
                    return to_gate(req, sess, passwords)
                req.scope["auth"] = {"provider": "unlock", "roles": unlocked}
                return None
            if is_api_request:
                req.scope["auth"] = None
                return None
            if auth_required:
                sess["next"] = req.url.path
                return RedirectResponse("/login", status_code=303)
            if path_requires_roles(req.url.path, rules):
                return to_gate(req, sess, passwords)
            req.scope["auth"] = None
            return None
        auth = normalize_auth(auth)
        if auth is None:
            return None
        if rules:
            auth["roles"] = list(dict.fromkeys(resolve_roles(auth, value(rbac_cfg), value(oauth_cfg), coerce_list) + unlocked))
            if not is_allowed(req.url.path, auth["roles"], rules):
                return to_gate(req, sess, passwords) if passwords else Response("Forbidden", status_code=403)
        req.scope["auth"] = auth
        return None
    return user_auth_before
