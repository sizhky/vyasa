import json, os, re
from pathlib import Path


def normalize_rbac_cfg(cfg, coerce_list):
    cfg = cfg if isinstance(cfg, dict) else {}
    user_roles = cfg.get("user_roles", {})
    role_users = cfg.get("role_users", {})
    rules = cfg.get("rules", [])
    cleaned_rules = []
    for rule in rules if isinstance(rules, list) else []:
        if not isinstance(rule, dict):
            continue
        pattern = rule.get("pattern")
        roles = coerce_list(rule.get("roles", []))
        if pattern and roles:
            cleaned_rules.append({"pattern": str(pattern), "roles": roles})
    return {
        "enabled": bool(cfg.get("enabled", False)),
        "default_roles": coerce_list(cfg.get("default_roles", [])),
        "user_roles": user_roles if isinstance(user_roles, dict) else {},
        "role_users": role_users if isinstance(role_users, dict) else {},
        "rules": cleaned_rules,
    }


def render_rbac_toml(cfg, coerce_list):
    cfg = normalize_rbac_cfg(cfg, coerce_list)
    q = lambda value: json.dumps(str(value))
    lst = lambda items: "[" + ", ".join(q(item) for item in items) + "]"
    table = lambda mapping: "{}" if not mapping else "{ " + ", ".join(
        f"{q(key)} = {lst(coerce_list(mapping[key]))}" for key in sorted(mapping.keys())
    ) + " }"
    lines = ["[rbac]", f"enabled = {'true' if cfg.get('enabled') else 'false'}", f"default_roles = {lst(cfg.get('default_roles', []))}", f"user_roles = {table(cfg.get('user_roles', {}))}", f"role_users = {table(cfg.get('role_users', {}))}", ""]
    for rule in cfg.get("rules", []):
        lines.extend(["[[rbac.rules]]", f"pattern = {q(rule.get('pattern'))}", f"roles = {lst(rule.get('roles', []))}", ""])
    return "\n".join(lines).rstrip() + "\n"


def write_rbac_to_vyasa(cfg, coerce_list, root_folder):
    root_env = os.getenv("VYASA_ROOT")
    path = Path(root_env) / ".vyasa" if root_env and (Path(root_env) / ".vyasa").exists() else (Path.cwd() / ".vyasa" if (Path.cwd() / ".vyasa").exists() else root_folder / ".vyasa")
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    new_block = render_rbac_toml(cfg, coerce_list)
    pattern = r"(?ms)^\[rbac\]\n.*?(?=^\[[^\[]|\Z)"
    text = re.sub(pattern, new_block + "\n", text) if re.search(r"(?m)^\[rbac\]", text) else ((text + ("" if not text or text.endswith("\n") else "\n")) + "\n" + new_block)
    path.write_text(text, encoding="utf-8")
