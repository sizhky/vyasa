from __future__ import annotations

import base64

from starlette.responses import Response
from ..runtime_services import get_runtime_services


def register_default_search_routes(rt, runtime) -> None:
    @rt("/search/gather")
    def gather_search_results(htmx, q: str = "", request=None):
        services = get_runtime_services()
        return services.gather_search_page(
            htmx,
            q=q,
            request=request,
            find_search_matches=services.find_search_matches,
            get_roles_from_request=services.get_roles_from_request,
            rbac_rules=services.rbac_rules(),
            rbac_cfg=services.rbac_cfg(),
            google_oauth_cfg=services.google_oauth_cfg(),
            coerce_list=services.coerce_list,
            get_root_folder=services.get_root_folder,
            is_allowed=services.is_allowed,
            gather_search_content=services.gather_search_content,
            layout=services.layout,
        )

    @rt("/search/preview")
    def search_preview_results(htmx, q: str = "", request=None):
        services = get_runtime_services()
        return services.render_search_preview_page(htmx, request, q=q)

    @rt("/search/preview/s/{query_token}")
    def search_preview_results_path(query_token: str = "", htmx=None, request=None):
        services = get_runtime_services()
        token = (query_token or "").strip()
        if not token:
            return services.render_search_preview_page(htmx, request, q="")
        padding = "=" * (-len(token) % 4)
        try:
            query = base64.urlsafe_b64decode(f"{token}{padding}".encode("ascii")).decode("utf-8")
        except Exception:
            return Response(status_code=404)
        return services.render_search_preview_page(htmx, request, q=query)

    @rt("/_sidebar/posts/search")
    def posts_sidebar_search(q: str = "", request=None):
        services = get_runtime_services()
        roles = services.get_roles_from_request(
            request,
            services.rbac_rules(),
            services.rbac_cfg(),
            services.google_oauth_cfg(),
            services.coerce_list,
        )
        return services.render_posts_search_results(q, roles=roles)
