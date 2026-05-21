import time
from urllib.parse import quote

from fasthtml.common import A, Details, Li, Span, Summary, Ul
from monsterui.all import UkIcon
from .helpers import content_slug_for_path, content_url_for_slug, document_icon_for_path, document_title_for_path, enabled_document_suffixes
from .nav_views import FOLDER_ROW_CLASSES, FILE_ROW_CLASSES, NavigationRow, navigation_row_view
from .runtime_context import traced


def _folder_summary(title_node, branch_href=None):
    kwargs = {}
    if branch_href:
        kwargs = {"hx_get": branch_href, "hx_trigger": "click once", "hx_target": "next ul", "hx_swap": "innerHTML"}
    return Summary(
        Span(Span(cls="folder-chevron"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
        Span(UkIcon("folder", cls="text-current w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
        title_node,
        cls=FOLDER_ROW_CLASSES,
        **kwargs,
    )


def _decorate_row(node, slug=None, title="", decorators=(), context="tree"):
    decorated = node
    for decorator in decorators or ():
        decorated = decorator(decorated, slug=slug, title=title, context=context)
    return decorated


def folder_has_visible_descendant(folder, roles, depth, *, root, show_hidden, excluded_dirs, get_nav_entries, is_allowed_fn, rbac_rules):
    if (folder / ".vyasa").exists():
        return True
    for item in get_nav_entries(folder, root, show_hidden, excluded_dirs):
        if item.is_dir():
            if depth > 0 and folder_has_visible_descendant(item, roles, depth - 1, root=root, show_hidden=show_hidden, excluded_dirs=excluded_dirs, get_nav_entries=get_nav_entries, is_allowed_fn=is_allowed_fn, rbac_rules=rbac_rules):
                return True
            continue
        slug = content_slug_for_path(item)
        if not slug:
            continue
        route = f"/posts/{slug}"
        if is_allowed_fn(route, roles or [], rbac_rules):
            return True
    return False


@traced("tree")
def build_post_tree_render(folder, roles=None, max_depth=None, active_parts=(), *, root, show_hidden, excluded_dirs, get_nav_entries, effective_abbreviations, should_exclude_dir_fn, slug_to_title_fn, find_folder_note_file_fn, is_allowed_fn, parse_frontmatter_fn, rbac_rules, logger, suppress_note_file=False, row_decorators=()):
    items, start_time = [], time.time()
    try:
        entries = get_nav_entries(folder, root, show_hidden, excluded_dirs)
        abbreviations = effective_abbreviations(root, folder)
    except (OSError, PermissionError):
        return items
    folder_note_file = find_folder_note_file_fn(folder) if suppress_note_file else None
    for item in entries:
        if item.is_dir():
            if should_exclude_dir_fn(item.name, excluded_dirs) or (not show_hidden and item.name.startswith(".")):
                continue
            folder_title = slug_to_title_fn(item.name, abbreviations=abbreviations)
            rel_folder = content_slug_for_path(item, strip_suffix=False)
            if not rel_folder:
                continue
            child_active = tuple(active_parts[1:]) if active_parts and active_parts[0] == item.name else ()
            should_expand = bool(active_parts and active_parts[0] == item.name)
            if max_depth == 0:
                note_file = find_folder_note_file_fn(item)
                note_slug = content_slug_for_path(note_file) if note_file else None
                note_allowed = bool(note_slug and is_allowed_fn(f"/posts/{note_slug}", roles or [], rbac_rules))
                note_href = content_url_for_slug(note_slug) if note_slug else ""
                note_link = navigation_row_view(
                    NavigationRow(slug=note_slug, title=f"Open {folder_title}", label=folder_title, href=note_href, icon="folder", kind="folder", folder_note=True),
                    cls="post-link folder-note-link whitespace-nowrap",
                    onclick="event.stopPropagation();",
                    show_icon=False,
                ) if note_allowed else Span(folder_title, cls="vyasa-tree-link whitespace-nowrap", title=folder_title)
                title_node = _decorate_row(note_link, note_slug, folder_title, row_decorators, context="tree-inline") if note_allowed else note_link
                if should_expand:
                    sub_items = build_post_tree_render(item, roles=roles, max_depth=0 if not child_active else None, active_parts=child_active, root=root, show_hidden=show_hidden, excluded_dirs=excluded_dirs, get_nav_entries=get_nav_entries, effective_abbreviations=effective_abbreviations, should_exclude_dir_fn=should_exclude_dir_fn, slug_to_title_fn=slug_to_title_fn, find_folder_note_file_fn=find_folder_note_file_fn, is_allowed_fn=is_allowed_fn, parse_frontmatter_fn=parse_frontmatter_fn, rbac_rules=rbac_rules, logger=logger, suppress_note_file=True, row_decorators=row_decorators)
                    items.append(Li(Details(_folder_summary(title_node), Ul(*sub_items, cls="ml-4 pl-2 space-y-1 border-l border-slate-100 dark:border-slate-800"), data_folder="true", open=True), cls="my-1"))
                    continue
                if not folder_has_visible_descendant(item, roles, 3, root=root, show_hidden=show_hidden, excluded_dirs=excluded_dirs, get_nav_entries=get_nav_entries, is_allowed_fn=is_allowed_fn, rbac_rules=rbac_rules):
                    continue
                branch_href = f"/_sidebar/posts/branch?path={quote(rel_folder, safe='')}"
                items.append(Li(Details(_folder_summary(title_node, branch_href=branch_href), Ul(cls="ml-4 pl-2 space-y-1 border-l border-slate-100 dark:border-slate-800"), data_folder="true"), cls="my-1"))
                continue
            sub_items = build_post_tree_render(item, roles=roles, max_depth=None if should_expand else (None if max_depth is None else max_depth - 1), active_parts=child_active, root=root, show_hidden=show_hidden, excluded_dirs=excluded_dirs, get_nav_entries=get_nav_entries, effective_abbreviations=effective_abbreviations, should_exclude_dir_fn=should_exclude_dir_fn, slug_to_title_fn=slug_to_title_fn, find_folder_note_file_fn=find_folder_note_file_fn, is_allowed_fn=is_allowed_fn, parse_frontmatter_fn=parse_frontmatter_fn, rbac_rules=rbac_rules, logger=logger, suppress_note_file=True, row_decorators=row_decorators)
            note_file = find_folder_note_file_fn(item)
            note_slug = content_slug_for_path(note_file) if note_file else None
            note_allowed = bool(note_slug and is_allowed_fn(f"/posts/{note_slug}", roles or [], rbac_rules))
            note_href = content_url_for_slug(note_slug) if note_slug else ""
            note_link = navigation_row_view(
                NavigationRow(slug=note_slug, title=f"Open {folder_title}", label=folder_title, href=note_href, icon="folder", kind="folder", folder_note=True),
                cls="post-link folder-note-link whitespace-nowrap",
                onclick="event.stopPropagation();",
                show_icon=False,
            ) if note_allowed else None
            if not sub_items and not note_allowed:
                continue
            title_base = note_link if note_allowed else Span(folder_title, cls="vyasa-tree-link whitespace-nowrap", title=folder_title)
            title_slug = note_slug if note_allowed else rel_folder
            title_node = _decorate_row(title_base, title_slug, folder_title, row_decorators, context="tree-inline")
            if sub_items:
                items.append(Li(Details(_folder_summary(title_node), Ul(*sub_items, cls="ml-4 pl-2 space-y-1 border-l border-slate-100 dark:border-slate-800"), data_folder="true", open=should_expand), cls="my-1"))
            elif note_slug:
                folder_link = navigation_row_view(
                    NavigationRow(slug=note_slug, title=folder_title, label=folder_title, href=note_href, icon="folder", kind="folder", folder_note=True),
                    cls=FILE_ROW_CLASSES,
                )
                items.append(Li(_decorate_row(folder_link, note_slug, folder_title, row_decorators)))
            continue
        if item.suffix not in enabled_document_suffixes():
            continue
        if folder_note_file and item.resolve() == folder_note_file.resolve():
            continue
        slug = content_slug_for_path(item)
        if not slug:
            continue
        route = f"/posts/{slug}"
        if not is_allowed_fn(route, roles or [], rbac_rules):
            continue
        if item.suffix == ".md":
            metadata, _ = parse_frontmatter_fn(item)
            icon = "monitor" if metadata.get("slides", False) else "file-text"
            title = metadata.get("title", document_title_for_path(item, abbreviations=abbreviations))
            label, href = title, content_url_for_slug(slug)
        else:
            title = document_title_for_path(item, abbreviations=abbreviations)
            icon, label, href = document_icon_for_path(item), title, content_url_for_slug(slug)
        row = NavigationRow(slug=slug, title=title, label=label, href=href, icon=icon, kind=item.suffix.lstrip("."))
        link = navigation_row_view(row, cls=FILE_ROW_CLASSES)
        items.append(Li(_decorate_row(link, slug, title, row_decorators)))
    logger.debug(f"[DEBUG] build_post_tree for {content_slug_for_path(folder, strip_suffix=False) or '.'} completed in {(time.time() - start_time) * 1000:.2f}ms")
    return items
