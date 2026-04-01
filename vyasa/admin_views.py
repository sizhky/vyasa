import json

from fasthtml.common import *


def rbac_admin_content(cfg, error, success, preview_text, form_values=None):
    field_cls = "vyasa-admin-field w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-900/70"
    json_cls = f"{field_cls} vyasa-admin-json"
    form_values = form_values or {}
    default_roles = form_values.get("default_roles", ", ".join(cfg.get("default_roles", [])))
    role_users_json = form_values.get("role_users_json", json.dumps(cfg.get("role_users", {}), indent=2, sort_keys=True))
    user_roles_json = form_values.get("user_roles_json", json.dumps(cfg.get("user_roles", {}), indent=2, sort_keys=True))
    rules_json = form_values.get("rules_json", json.dumps(cfg.get("rules", []), indent=2, sort_keys=True))
    return Div(
        H1("RBAC Administration", cls="text-3xl font-bold"),
        P("Edits save to SQLite immediately and also update the .vyasa file for transparency.", cls="text-slate-600 dark:text-slate-400"),
        P("Rule patterns are matched against request paths (e.g. /posts/ai/...).", cls="text-slate-500 dark:text-slate-500 text-sm"),
        Div(P(error, cls="text-red-600") if error else None, P(success, cls="text-emerald-600") if success else None, cls="mt-4"),
        Form(
            Div(Label(Input(type="checkbox", name="enabled", checked=cfg.get("enabled", False), cls="mr-2"), Span("Enable RBAC"), cls="flex items-center gap-2"), cls="mt-6"),
            Div(Label("Default roles (comma separated)", cls="block text-sm font-medium mb-2"), Input(type="text", name="default_roles", value=default_roles, cls=field_cls), cls="mt-6"),
            Div(
                Div(Label("Role users JSON", cls="block text-sm font-medium"), Button("Focus JSON", type="button", data_json_focus_target="rbac-role-users-json", data_json_focus_title="Role users JSON", cls="text-sm underline text-slate-600 dark:text-slate-300"), cls="mb-2 flex items-center justify-between gap-3"),
                Textarea(role_users_json, id="rbac-role-users-json", name="role_users_json", rows="12", cls=json_cls),
                cls="mt-6",
            ),
            Div(
                Div(Label("User roles JSON", cls="block text-sm font-medium"), Button("Focus JSON", type="button", data_json_focus_target="rbac-user-roles-json", data_json_focus_title="User roles JSON", cls="text-sm underline text-slate-600 dark:text-slate-300"), cls="mb-2 flex items-center justify-between gap-3"),
                Textarea(user_roles_json, id="rbac-user-roles-json", name="user_roles_json", rows="12", cls=json_cls),
                cls="mt-6",
            ),
            Div(
                Div(Label("Rules JSON", cls="block text-sm font-medium"), Button("Focus JSON", type="button", data_json_focus_target="rbac-rules-json", data_json_focus_title="Rules JSON", cls="text-sm underline text-slate-600 dark:text-slate-300"), cls="mb-2 flex items-center justify-between gap-3"),
                Textarea(rules_json, id="rbac-rules-json", name="rules_json", rows="16", cls=json_cls),
                cls="mt-6",
            ),
            Button("Save RBAC", type="submit", cls="mt-6 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"),
            method="post", cls="mt-4",
        ),
        Div(H2("Preview (.vyasa)", cls="text-xl font-semibold mt-10"), Pre(preview_text, cls="vyasa-admin-json mt-3 p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 overflow-x-auto")),
        cls="max-w-3xl mx-auto py-10 px-6",
    )
