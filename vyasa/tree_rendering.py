import time
from urllib.parse import quote

from fasthtml.common import A, Details, Li, Span, Summary, Ul
from monsterui.all import UkIcon


def _folder_summary(title_node, branch_href=None):
    kwargs = {}
    if branch_href:
        kwargs = {"hx_get": branch_href, "hx_trigger": "click once", "hx_target": "next ul", "hx_swap": "innerHTML"}
    return Summary(
        Span(Span(cls="folder-chevron"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
        Span(UkIcon("folder", cls="text-blue-500 w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
        title_node,
        cls="inline-flex w-max items-center font-medium cursor-pointer py-1 px-2 hover:text-blue-600 select-none list-none rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap",
        **kwargs,
    )


def folder_has_visible_descendant(folder, roles, depth, *, root, show_hidden, excluded_dirs, get_nav_entries, is_allowed_fn, rbac_rules):
    for item in get_nav_entries(folder, root, show_hidden, excluded_dirs):
        if item.is_dir():
            if depth > 0 and folder_has_visible_descendant(item, roles, depth - 1, root=root, show_hidden=show_hidden, excluded_dirs=excluded_dirs, get_nav_entries=get_nav_entries, is_allowed_fn=is_allowed_fn, rbac_rules=rbac_rules):
                return True
            continue
        slug = str(item.relative_to(root).with_suffix(""))
        route = f"/drawings/{slug}" if item.suffix == ".excalidraw" else f"/posts/{slug}"
        if is_allowed_fn(route, roles or [], rbac_rules):
            return True
    return False


def build_post_tree_render(folder, roles=None, max_depth=None, active_parts=(), *, root, show_hidden, excluded_dirs, get_nav_entries, effective_abbreviations, should_exclude_dir_fn, slug_to_title_fn, find_folder_note_file_fn, is_allowed_fn, parse_frontmatter_fn, rbac_rules, logger):
    items, start_time = [], time.time()
    try:
        entries = get_nav_entries(folder, root, show_hidden, excluded_dirs)
        abbreviations = effective_abbreviations(root, folder)
    except (OSError, PermissionError):
        return items
    for item in entries:
        if item.is_dir():
            if should_exclude_dir_fn(item.name, excluded_dirs) or (not show_hidden and item.name.startswith(".")):
                continue
            folder_title = slug_to_title_fn(item.name, abbreviations=abbreviations)
            rel_folder = str(item.relative_to(root))
            child_active = tuple(active_parts[1:]) if active_parts and active_parts[0] == item.name else ()
            should_expand = bool(active_parts and active_parts[0] == item.name)
            if max_depth == 0:
                if should_expand:
                    sub_items = build_post_tree_render(item, roles=roles, max_depth=0 if not child_active else None, active_parts=child_active, root=root, show_hidden=show_hidden, excluded_dirs=excluded_dirs, get_nav_entries=get_nav_entries, effective_abbreviations=effective_abbreviations, should_exclude_dir_fn=should_exclude_dir_fn, slug_to_title_fn=slug_to_title_fn, find_folder_note_file_fn=find_folder_note_file_fn, is_allowed_fn=is_allowed_fn, parse_frontmatter_fn=parse_frontmatter_fn, rbac_rules=rbac_rules, logger=logger)
                    items.append(Li(Details(_folder_summary(Span(folder_title, cls="whitespace-nowrap", title=folder_title)), Ul(*sub_items, cls="ml-4 pl-2 space-y-1 border-l border-slate-100 dark:border-slate-800"), data_folder="true", open=True), cls="my-1"))
                    continue
                if not folder_has_visible_descendant(item, roles, 3, root=root, show_hidden=show_hidden, excluded_dirs=excluded_dirs, get_nav_entries=get_nav_entries, is_allowed_fn=is_allowed_fn, rbac_rules=rbac_rules):
                    continue
                branch_href = f"/_sidebar/posts/branch?path={quote(rel_folder, safe='')}"
                items.append(Li(Details(_folder_summary(Span(folder_title, cls="whitespace-nowrap", title=folder_title), branch_href=branch_href), Ul(cls="ml-4 pl-2 space-y-1 border-l border-slate-100 dark:border-slate-800"), data_folder="true"), cls="my-1"))
                continue
            sub_items = build_post_tree_render(item, roles=roles, max_depth=None if should_expand else (None if max_depth is None else max_depth - 1), active_parts=child_active, root=root, show_hidden=show_hidden, excluded_dirs=excluded_dirs, get_nav_entries=get_nav_entries, effective_abbreviations=effective_abbreviations, should_exclude_dir_fn=should_exclude_dir_fn, slug_to_title_fn=slug_to_title_fn, find_folder_note_file_fn=find_folder_note_file_fn, is_allowed_fn=is_allowed_fn, parse_frontmatter_fn=parse_frontmatter_fn, rbac_rules=rbac_rules, logger=logger)
            note_file = find_folder_note_file_fn(item)
            note_slug = str(note_file.relative_to(root).with_suffix("")) if note_file else None
            note_allowed = bool(note_slug and is_allowed_fn(f"/posts/{note_slug}", roles or [], rbac_rules))
            note_link = A(href=f"/posts/{note_slug}", hx_get=f"/posts/{note_slug}", hx_target="#main-content", hx_push_url="true", hx_swap="outerHTML show:window:top settle:0.1s", cls="folder-note-link whitespace-nowrap hover:underline", title=f"Open {folder_title}", onclick="event.stopPropagation();")(folder_title) if note_allowed else None
            if not sub_items and not note_allowed:
                continue
            if sub_items:
                items.append(Li(Details(_folder_summary(note_link or Span(folder_title, cls="whitespace-nowrap", title=folder_title)), Ul(*sub_items, cls="ml-4 pl-2 space-y-1 border-l border-slate-100 dark:border-slate-800"), data_folder="true", open=should_expand), cls="my-1"))
            elif note_slug:
                items.append(Li(A(Span(cls="w-4 mr-2 shrink-0"), Span(UkIcon("folder", cls="text-blue-500 w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"), Span(folder_title, cls="whitespace-nowrap", title=folder_title), href=f"/posts/{note_slug}", hx_get=f"/posts/{note_slug}", hx_target="#main-content", hx_push_url="true", hx_swap="outerHTML show:window:top settle:0.1s", cls="post-link inline-flex w-max items-center py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 hover:underline transition-colors whitespace-nowrap", data_path=note_slug)))
            continue
        if item.suffix not in {".md", ".pdf", ".excalidraw"}:
            continue
        slug = str(item.relative_to(root).with_suffix(""))
        route = f"/drawings/{slug}" if item.suffix == ".excalidraw" else f"/posts/{slug}"
        if not is_allowed_fn(route, roles or [], rbac_rules):
            continue
        if item.suffix == ".md":
            metadata, _ = parse_frontmatter_fn(item)
            icon = "monitor" if metadata.get("slides", False) else "file-text"
            title = metadata.get("title", slug_to_title_fn(item.stem, abbreviations=abbreviations))
            label, href = title, f"/posts/{slug}"
        elif item.suffix == ".pdf":
            icon, title, label, href = "file", slug_to_title_fn(item.stem, abbreviations=abbreviations), f"{slug_to_title_fn(item.stem, abbreviations=abbreviations)} (PDF)", f"/posts/{slug}"
        else:
            icon, title, label, href = "pencil", slug_to_title_fn(item.stem, abbreviations=abbreviations), f"{slug_to_title_fn(item.stem, abbreviations=abbreviations)} (Excalidraw)", f"/drawings/{slug}"
        items.append(Li(A(Span(cls="w-4 mr-2 shrink-0"), Span(UkIcon(icon, cls="text-slate-400 w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"), Span(label, cls="whitespace-nowrap", title=title), href=href, hx_get=href, hx_target="#main-content", hx_push_url="true", hx_swap="outerHTML show:window:top settle:0.1s", cls="post-link inline-flex items-center py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors whitespace-nowrap", data_path=slug)))
    logger.debug(f"[DEBUG] build_post_tree for {folder.relative_to(root) if folder != root else '.'} completed in {(time.time() - start_time) * 1000:.2f}ms")
    return items
