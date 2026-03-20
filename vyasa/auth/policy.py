def normalize_auth(auth):
    if not auth:
        return None
    if isinstance(auth, dict):
        return auth
    return {"provider": "local", "username": str(auth)}


def path_requires_roles(path, rbac_rules):
    for pattern, _roles in rbac_rules:
        if pattern.search(path):
            return True
    return False


def is_allowed(path, roles, rbac_rules):
    if not rbac_rules:
        return True
    roles_set = set(roles or [])
    matched_any = False
    allowed = False
    for pattern, allowed_roles in rbac_rules:
        if pattern.search(path):
            matched_any = True
            if roles_set & allowed_roles:
                allowed = True
    return allowed if matched_any else True


def resolve_roles(auth, rbac_cfg, google_oauth_cfg, coerce_list):
    auth = normalize_auth(auth) or {}
    username = auth.get("username")
    email = auth.get("email")
    user_roles = rbac_cfg.get("user_roles", {})
    roles = []
    if isinstance(user_roles, dict):
        if email and email in user_roles:
            roles.extend(coerce_list(user_roles.get(email)))
        if username and username in user_roles:
            roles.extend(coerce_list(user_roles.get(username)))
    role_users = rbac_cfg.get("role_users", {})
    if isinstance(role_users, dict):
        for role, users in role_users.items():
            users_list = coerce_list(users)
            if email and email in users_list:
                roles.append(role)
            if username and username in users_list:
                roles.append(role)
    if not roles:
        roles = rbac_cfg.get("default_roles", []) or google_oauth_cfg.get("default_roles", [])
    roles = [r for r in roles if r]
    return list(dict.fromkeys(roles)) if roles else []
