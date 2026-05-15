from __future__ import annotations

import base64

from starlette.responses import Response


def register_default_search_routes(rt, runtime) -> None:
    from .. import core

    @rt("/search/gather")
    def gather_search_results(htmx, q: str = "", request=None):
        return core.gather_search_page(
            htmx,
            q=q,
            request=request,
            find_search_matches=core._find_search_matches,
            get_roles_from_request=core.get_roles_from_request,
            rbac_rules=core._rbac_rules,
            rbac_cfg=core._rbac_cfg,
            google_oauth_cfg=core._google_oauth_cfg,
            coerce_list=core._config._coerce_list,
            get_root_folder=core.get_root_folder,
            is_allowed=core.is_allowed,
            gather_search_content=core.gather_search_content,
            layout=core.layout,
        )

    @rt("/search/preview")
    def search_preview_results(htmx, q: str = "", request=None):
        return core.render_search_preview_page(htmx, request, q=q)

    @rt("/search/preview/s/{query_token}")
    def search_preview_results_path(query_token: str = "", htmx=None, request=None):
        token = (query_token or "").strip()
        if not token:
            return core.render_search_preview_page(htmx, request, q="")
        padding = "=" * (-len(token) % 4)
        try:
            query = base64.urlsafe_b64decode(f"{token}{padding}".encode("ascii")).decode("utf-8")
        except Exception:
            return Response(status_code=404)
        return core.render_search_preview_page(htmx, request, q=query)

    @rt("/_sidebar/posts/search")
    def posts_sidebar_search(q: str = "", request=None):
        roles = core.get_roles_from_request(
            request,
            core._rbac_rules,
            core._rbac_cfg,
            core._google_oauth_cfg,
            core._config._coerce_list,
        )
        return core._render_posts_search_results(q, roles=roles)
