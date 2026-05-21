from __future__ import annotations


def register_rbac_admin_routes(rt, runtime) -> None:
    from ...runtime_services import get_runtime_services

    @rt("/admin/impersonate", methods=["GET", "POST"])
    async def admin_impersonate(htmx, request):
        services = get_runtime_services()
        return await services.handle_admin_impersonate(
            htmx,
            request,
            get_auth_from_request=services.get_auth_from_request,
            rbac_rules=services.rbac_rules(),
            rbac_cfg=services.rbac_cfg(),
            google_oauth_cfg=services.google_oauth_cfg(),
            coerce_list=services.coerce_list,
            apply_impersonation_action=services.apply_impersonation_action,
            resolve_roles=services.resolve_roles,
            layout=services.layout,
            impersonate_content=services.impersonate_content,
        )

    @rt("/admin/rbac", methods=["GET", "POST"])
    async def admin_rbac(htmx, request):
        services = get_runtime_services()
        return await services.handle_admin_rbac(
            htmx,
            request,
            get_auth_from_request=services.get_auth_from_request,
            rbac_rules=services.rbac_rules(),
            rbac_cfg=services.rbac_cfg(),
            google_oauth_cfg=services.google_oauth_cfg(),
            coerce_list=services.coerce_list,
            parse_rbac_form=services.parse_rbac_form,
            parse_roles_text=services.parse_roles_text,
            rbac_db_write=services.rbac_db_write,
            write_rbac_to_vyasa=services.write_rbac_to_vyasa,
            set_rbac_cfg=services.set_rbac_cfg,
            cached_build_post_tree=services.cached_build_post_tree,
            cached_posts_sidebar_html=services.cached_posts_sidebar_html,
            render_rbac_toml=services.render_rbac_toml,
            rbac_admin_content=services.rbac_admin_content,
            layout=services.layout,
        )
