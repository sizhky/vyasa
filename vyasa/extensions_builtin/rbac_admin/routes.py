from __future__ import annotations


def register_rbac_admin_routes(rt, runtime) -> None:
    from ... import core

    @rt("/admin/impersonate", methods=["GET", "POST"])
    async def admin_impersonate(htmx, request):
        return await core.handle_admin_impersonate(
            htmx,
            request,
            get_auth_from_request=core.get_auth_from_request,
            rbac_rules=core._rbac_rules,
            rbac_cfg=core._rbac_cfg,
            google_oauth_cfg=core._google_oauth_cfg,
            coerce_list=core._config._coerce_list,
            apply_impersonation_action=core.apply_impersonation_action,
            resolve_roles=core.resolve_roles,
            layout=core.layout,
            impersonate_content=core.impersonate_content,
        )

    @rt("/admin/rbac", methods=["GET", "POST"])
    async def admin_rbac(htmx, request):
        return await core.handle_admin_rbac(
            htmx,
            request,
            get_auth_from_request=core.get_auth_from_request,
            rbac_rules=core._rbac_rules,
            rbac_cfg=core._rbac_cfg,
            google_oauth_cfg=core._google_oauth_cfg,
            coerce_list=core._config._coerce_list,
            parse_rbac_form=core.parse_rbac_form,
            parse_roles_text=core.parse_roles_text,
            rbac_db_write=core._rbac_db_write,
            write_rbac_to_vyasa=core._write_rbac_to_vyasa,
            set_rbac_cfg=core._set_rbac_cfg,
            cached_build_post_tree=core._cached_build_post_tree,
            cached_posts_sidebar_html=core._cached_posts_sidebar_html,
            render_rbac_toml=core._render_rbac_toml,
            rbac_admin_content=core.rbac_admin_content,
            layout=core.layout,
        )
