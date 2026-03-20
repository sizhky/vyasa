from fasthtml.common import Div, H1, P


def gather_search_page(htmx, q="", request=None, *, find_search_matches, get_roles_from_request, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list, get_root_folder, is_allowed, gather_search_content, layout):
    matches, regex_error = find_search_matches(q, limit=200)
    roles = get_roles_from_request(request, rbac_rules, rbac_cfg, google_oauth_cfg, coerce_list)
    if roles is not None:
        root = get_root_folder()
        matches = [item for item in matches if is_allowed(f"/posts/{item.relative_to(root).with_suffix('')}", roles or [], rbac_rules)]
    if not matches:
        content = Div(H1("Search Results", cls="text-3xl font-bold mb-6"), P("No matching posts found.", cls="text-slate-600 dark:text-slate-400"), P(regex_error, cls="text-amber-600 dark:text-amber-400 text-sm") if regex_error else None)
        return layout(content, htmx=htmx, title="Search Results", show_sidebar=True, auth=request.scope.get("auth") if request else None)
    return layout(gather_search_content(q, matches, regex_error, get_root_folder()), htmx=htmx, title="Search Results", show_sidebar=True, auth=request.scope.get("auth") if request else None)
