import json


def apply_impersonation_action(session, current_auth, action, email, resolve_roles):
    impersonator = session.get("impersonator")
    if action == "stop":
        if not impersonator:
            return "Not currently impersonating.", None
        session["auth"] = impersonator
        session.pop("impersonator", None)
        return None, "Impersonation stopped."
    if not email:
        return "Email is required.", None
    if not impersonator:
        session["impersonator"] = current_auth
    auth = {"provider": "impersonate", "email": email, "username": email}
    if session.get("impersonator"):
        auth["impersonator"] = session.get("impersonator")
    auth["roles"] = resolve_roles(auth)
    session["auth"] = auth
    return None, f"Now impersonating {email}."


def parse_rbac_form(form, parse_roles_text):
    try:
        role_users = json.loads(form.get("role_users_json", "{}").strip() or "{}")
        user_roles = json.loads(form.get("user_roles_json", "{}").strip() or "{}")
        rules = json.loads(form.get("rules_json", "[]").strip() or "[]")
    except Exception as exc:
        return None, f"Invalid JSON: {exc}"
    if not isinstance(role_users, dict):
        return None, "Role users JSON must be an object."
    if not isinstance(user_roles, dict):
        return None, "User roles JSON must be an object."
    if not isinstance(rules, list):
        return None, "Rules JSON must be an array."
    return {
        "enabled": form.get("enabled") == "on",
        "default_roles": parse_roles_text(form.get("default_roles", "")),
        "role_users": role_users,
        "user_roles": user_roles,
        "rules": rules,
    }, None
