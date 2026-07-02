from __future__ import annotations

import re
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

from fasthtml.common import Button, Details, Div, Li, Response, Span, Summary, Ul
from monsterui.all import UkIcon

from .config import get_config
from .helpers import content_location, content_url_for_slug, get_ref_content_mounts
from .ref_address import ref_from_current_path, sidebar_path, target_url


def clear_caches() -> None:
    _git_roots_with_refs.cache_clear()
    try:
        from . import core

        core._cached_build_ref_post_tree.cache_clear()
        core._cached_posts_sidebar_html.cache_clear()
        core._nav_entries_cache.clear()
    except Exception:
        pass


def refresh_refs_for_root(target_root: str = "", request=None):
    target_root = (target_root or "").strip()
    raw_url = str(getattr(request, "url", "")) if request is not None else ""
    from .core import logger

    logger.info("git-ref refresh requested root={} url={}", target_root or "*", raw_url or "-")
    clear_caches()
    try:
        from .git_fetcher import fetch_all, fetch_clone_mounts, specs_from_config

        specs, mirror_root = specs_from_config()
        if specs and not target_root:
            logger.info("git-ref refreshing configured mirrors count={} root={}", len(specs), mirror_root)
            fetch_all(specs, mirror_root)
        clones = fetch_clone_mounts(target_root)
        if clones:
            logger.info("git-ref refreshing clone mounts count={} root={}", len(clones), target_root or "*")
    except Exception as exc:
        logger.warning("git-ref refresh failed: {}", exc)
    clear_caches()
    logger.info("git-ref refresh complete root={}", target_root or "*")
    return Response(status_code=204)


def refresh_ref_tree(path: str, request=None):
    from .core import logger

    parsed = ref_from_current_path(path)
    raw_url = str(getattr(request, "url", "")) if request is not None else ""
    if not parsed:
        logger.info("git-ref tree refresh skipped path={} url={} reason=no-ref", path, raw_url or "-")
        return Response(status_code=204)
    root_id, ref, active_parts = parsed
    logger.info("git-ref tree refresh root={} ref={} active_parts={} url={}", root_id, ref, active_parts, raw_url or "-")
    clear_caches()
    return Response(status_code=204)


@lru_cache(maxsize=2)
def _git_roots_with_refs(time_bucket):
    from .content_backend import classify_root, git_backend_for

    out = []
    for alias, root in get_ref_content_mounts():
        rc = classify_root(root)
        if rc.kind == "plain" or rc.git_dir is None:
            continue
        try:
            refs = git_backend_for(rc.git_dir).list_refs()
        except Exception:
            continue
        if not refs:
            continue
        refs.sort(key=lambda r: (0 if r.kind == "branch" else 1, r.name.lower()))
        default = next((r.name for r in refs if r.is_default), "")
        current_branch = rc.current_branch if rc.kind == "clone" else ""
        out.append((alias, default, current_branch or "", tuple((r.name, r.kind, r.is_default, r.remote) for r in refs)))
    return tuple(out)


def _ref_target_url(alias, name, current_path):
    return target_url(alias, name, current_path, content_location=content_location, content_url_for_slug=content_url_for_slug)


def _build_ref_tree(refs: Iterable[tuple[str, str, bool, str]]) -> dict[str, Any]:
    root: dict[str, Any] = {"_leaves": []}
    for item in refs:
        node: dict[str, Any] = root
        for seg in item[0].split("/")[:-1]:
            node = node.setdefault(seg, {"_leaves": []})
        node["_leaves"].append(item)
    return root


def _ref_row_style(depth: int) -> str:
    return f"padding-left:{0.5 + depth * 0.9:.3f}rem"


def _ref_leaf(name: str, kind: str, is_default: bool, alias: str, current: str, current_path: str | None, active: bool, storage_key: str, depth: int):
    url = _ref_target_url(alias, name, current_path if active else "")
    refresh = Button(
        UkIcon("refresh-cw", cls="w-3 h-3"),
        type="button",
        title=f"Refresh file tree for {name}",
        aria_label=f"Refresh file tree for {name}",
        data_vyasa_ref_tree_refresh="true",
        data_storage_key=storage_key,
        data_ref_name=name,
        data_sidebar_path=sidebar_path(alias, name),
        cls="vyasa-ref-refresh shrink-0",
    ) if kind == "branch" and active and name == current else ""
    return Li(Div(
        Button(
            Span(Span("✓" if name == current else "", data_ref_check="true"), Span(UkIcon("loader", cls="w-3 h-3 animate-spin"), data_ref_spinner="true", style="display:none"), cls="shrink-0", style="width:0.75rem;display:inline-flex;align-items:center;justify-content:center"),
            Span(name.split("/")[-1], cls="truncate"), Span(" (default)" if is_default else "", cls="opacity-60 text-xs"),
            UkIcon("tag", cls="w-3 h-3 opacity-50 ml-auto") if kind == "tag" else "",
            type="button",
            data_vyasa_ref_select="true",
            data_storage_key=storage_key,
            data_ref_name=name,
            data_ref_url=url,
            data_sidebar_path=sidebar_path(alias, name),
            cls="vyasa-ref-select min-w-0 flex flex-1 items-center gap-2",
        ),
        refresh,
        cls="vyasa-ref-row vyasa-emphasis-control-option",
        style=_ref_row_style(depth),
    ))


def _version_sort_key(name):
    return [(0, int(p)) if p.isdigit() else (1, p.lower()) for p in re.split(r"(\d+)", name) if p]


def _render_tags_group(tags, alias, current, current_path, active, storage_key, depth=1):
    tags = sorted(tags, key=lambda t: _version_sort_key(t[0]), reverse=True)
    is_open = active and any(t[0] == current for t in tags)
    items = [_ref_leaf(t[0], t[1], t[2], alias, current, current_path, active, storage_key, depth + 1) for t in tags]
    return Li(Details(
        Summary(UkIcon("tags", cls="w-3.5 h-3.5 opacity-60 shrink-0"), Span("Tags", cls="truncate"), Span(str(len(tags)), cls="opacity-50 text-xs ml-auto"), cls="vyasa-ref-row vyasa-emphasis-control-option", style=_ref_row_style(depth)),
        Ul(*items),
        open=is_open,
    ))


def _render_ref_nodes(node, alias, current, current_path, active, storage_key, open_parts, source_groups=frozenset(), depth=1):
    out = []
    for seg in sorted(k for k in node if k != "_leaves"):
        is_open = bool(open_parts) and open_parts[0] == seg
        is_source = depth == 1 and seg in source_groups
        icon = "hard-drive" if seg == "local" else ("radio-tower" if is_source else "folder")
        out.append(Li(Details(
            Summary(UkIcon(icon, cls="w-3.5 h-3.5 opacity-60 shrink-0"), Span(seg if is_source else f"{seg}/", cls="truncate"), cls="vyasa-ref-row vyasa-emphasis-control-option", style=_ref_row_style(depth)),
            Ul(*_render_ref_nodes(node[seg], alias, current, current_path, active, storage_key, open_parts[1:] if is_open else [], source_groups, depth + 1)),
            open=is_open,
        )))
    for item in node["_leaves"]:
        out.append(_ref_leaf(item[0], item[1], item[2], alias, current, current_path, active, storage_key, depth))
    return out


def ref_root_visible_to_roles(alias, root, roles) -> bool:
    from .auth.policy import is_allowed
    from .core import _nav_entries_for, _rbac_rules
    from .tree_rendering import folder_has_visible_descendant as tree_folder_has_visible_descendant

    if not _rbac_rules:
        return True
    if is_allowed(f"/posts/{alias}" if alias else "/posts", roles or [], _rbac_rules):
        return True
    try:
        return tree_folder_has_visible_descendant(
            Path(root), roles or [], 3,
            root=Path(root), show_hidden=get_config().get_show_hidden(),
            excluded_dirs=set(get_config().get_reload_excludes()), get_nav_entries=_nav_entries_for,
            is_allowed_fn=is_allowed, rbac_rules=_rbac_rules,
        )
    except Exception:
        return False


def navbar_ref_switcher(current_path=None, roles=None):
    roots = _git_roots_with_refs(int(time.time() // 10))
    if not roots:
        return None
    cur_root_id, cur_ref = "", ""
    if current_path:
        cur_root_id, _, cur_ref, _ = content_location(current_path)

    root_blocks = []
    root_by_alias = {alias: root for alias, root in get_ref_content_mounts()}
    for alias, default, current_branch, refs in roots:
        if not ref_root_visible_to_roles(alias, root_by_alias.get(alias), roles):
            continue
        active = alias == cur_root_id
        current = (cur_ref if active else "") or current_branch or default
        storage_key = f"vyasa-ref:{alias}"
        open_parts = current.split("/")[:-1] if active else []
        branches = [r for r in refs if r[1] == "branch"]
        tags = [r for r in refs if r[1] == "tag"]
        source_groups = frozenset(r[3] for r in branches if len(r) > 3 and r[3])
        ref_items = _render_ref_nodes(_build_ref_tree(branches), alias, current, current_path, active, storage_key, open_parts, source_groups)
        if tags:
            ref_items.append(_render_tags_group(tags, alias, current, current_path, active, storage_key))
        refresh_btn = Button(UkIcon("refresh-cw", cls="w-3.5 h-3.5"), type="button", title="Fetch & refresh branches", data_vyasa_ref_root_refresh="true", data_root=alias, cls="vyasa-ref-refresh shrink-0")
        home_btn = ""
        if current_branch:
            rel = ""
            if active and current_path:
                relp = content_location(current_path)[3].as_posix()
                rel = relp if relp and relp != "." else ""
            home_url = content_url_for_slug(f"{alias}/{rel}" if rel else alias)
            home_btn = Button(UkIcon("house", cls="w-3.5 h-3.5"), type="button", title=f"Working tree ({current_branch})", data_vyasa_ref_home="true", data_storage_key=storage_key, data_ref_url=home_url, cls="vyasa-ref-refresh shrink-0")
        root_blocks.append(Li(Details(
            Summary(UkIcon("folder-git-2", cls="w-3.5 h-3.5 opacity-60 shrink-0"), Span(alias or "(primary)", cls="truncate"), refresh_btn, home_btn, Span(current, cls="opacity-60 ml-auto truncate", style="max-width:10rem"), cls="vyasa-ref-row vyasa-emphasis-control-option", style=_ref_row_style(0)),
            Ul(*ref_items),
            open=active,
            cls="vyasa-ref-root",
        ), cls="my-0.5"))
    if not root_blocks:
        return None
    return Details(
        Summary(UkIcon("git-branch", cls="w-4 h-4 shrink-0"), Span("Branches", cls="hidden sm:inline truncate"), UkIcon("chevron-down", cls="w-4 h-4 ml-1 shrink-0 opacity-70"), cls="vyasa-emphasis-control vyasa-emphasis-control-field flex items-center gap-2 cursor-pointer select-none rounded-md px-3 py-2 text-sm"),
        Div(Ul(*root_blocks), cls="vyasa-emphasis-control-menu absolute right-0 mt-2 z-[1100] max-h-[70vh] overflow-y-auto", style="width:26rem"),
        cls="vyasa-ref-switcher relative",
    )
