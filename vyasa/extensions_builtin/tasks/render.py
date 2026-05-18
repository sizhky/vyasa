from __future__ import annotations

import html
import json
from itertools import count

from ...markdown_fence import normalize_items_model_hrefs, split_fence_frontmatter
from .layout import build_collapsed_graph
from .model import parse_tasks_text


_diagram_uid_counter = count(1)


def render_tasks_block(code: str, current_path: str | None = None, fence_name: str = "tasks") -> str:
    code = html.unescape(code)
    config, code = split_fence_frontmatter(code)
    try:
        model = parse_tasks_text(f"```tasks\n{code}\n```")
        if config.get("title") and not model.get("title"):
            model["title"] = config["title"]
        if config.get("id"):
            model["graph_id"] = config["id"]
        if "default_color_by" in config:
            model["default_color_by"] = config["default_color_by"]
        if "filter_attributes" in config:
            model["filter_attributes"] = config["filter_attributes"]
        if isinstance(config.get("color_by"), str) and config.get("color_by") and not model.get("color_by"):
            model["color_by"] = config["color_by"]
        if isinstance(config.get("color_by"), dict):
            palettes = {k: v for k, v in config["color_by"].items() if isinstance(v, dict)}
            if palettes:
                model["color_palettes"] = {**model.get("color_palettes", {}), **palettes}
                if not model.get("color_by"):
                    model["color_by"] = next(iter(palettes.keys()), "")
        if config.get("color_palette") and not model.get("color_palette"):
            model["color_palette"] = config["color_palette"]
            model["color_palettes"] = {**model.get("color_palettes", {}), model.get("color_by", ""): config["color_palette"]}
        if config.get("edge_color_by") and not model.get("edge_color_by"):
            model["edge_color_by"] = config["edge_color_by"]
        if config.get("edge_color_palette") and not model.get("edge_color_palette"):
            model["edge_color_palette"] = config["edge_color_palette"]
            model["edge_color_palettes"] = {**model.get("edge_color_palettes", {}), model.get("edge_color_by", ""): config["edge_color_palette"]}
        normalize_items_model_hrefs(model, current_path)
        graph = build_collapsed_graph(model)
    except Exception:
        model = {
            "graph_id": f"tasks-{next(_diagram_uid_counter)}",
            "title": "",
            "groups": [],
            "tasks": [],
            "dependency_edges": [],
            "group_tree": {},
            "task_children": {},
            "document_order": [],
            "frozen": {},
            "edge_color_by": "",
            "edge_color_palette": {},
            "edge_color_palettes": {},
        }
        graph = {"nodes": [], "edges": []}
    widget_id = f"tasks-{abs(hash(code)) & 0xFFFFFF}-{next(_diagram_uid_counter)}"
    payload = html.escape(json.dumps(model))
    graph_payload = html.escape(json.dumps(graph))
    title = html.escape(config.get("title") or model.get("title") or "Items")
    default_open_depth = html.escape(str(config.get("default_open_depth") or 0))
    width = config.get("width") or "65vw"
    implicit_breakout_height = fence_name == "tasks" and ("vw" in str(width).lower() or str(width).lower() == "100%")
    min_height = config.get("min_height") or ("85vh" if implicit_breakout_height else "420px")
    flow_height = html.escape(str(config.get("height") or "70vh"))
    jitter = html.escape(str(config.get("jitter") or 0))
    jitter_y = html.escape(str(config.get("jitter_y") or config.get("jitter") or 0))
    spacing = html.escape(str(config.get("spacing") or "normal"))
    optional_layout_attrs = []
    for key, data_name in (
        ("layout_direction", "data-tasks-layout-direction"),
        ("node_spacing", "data-tasks-node-spacing"),
        ("layer_spacing", "data-tasks-layer-spacing"),
        ("collision_gap", "data-tasks-collision-gap"),
        ("group_padding", "data-tasks-group-padding"),
        ("edge_label_width", "data-tasks-edge-label-width"),
    ):
        if key in config:
            optional_layout_attrs.append(f'{data_name}="{html.escape(str(config[key]))}"')
    optional_layout_attrs_str = (" " + " ".join(optional_layout_attrs)) if optional_layout_attrs else ""
    summary = f'{len(model["groups"])} groups, {len(model["tasks"])} items, {len(model["dependency_edges"])} edges'
    breakout = str(width).lower() in {"100%", "100vw"} or "vw" in str(width).lower()
    container_style_parts = [f"width: {width};"]
    if min_height:
        container_style_parts.append(f"min-height: {min_height};")
    if breakout:
        container_style_parts.append("position: relative; left: 50%; transform: translateX(-50%);")
    container_style = " ".join(container_style_parts)
    return (
        f'<div class="tasks-container relative my-6 rounded-xl border-4 border-slate-200 dark:border-slate-800" '
        f'style="{container_style}" '
        f'data-tasks-widget="true" id="{widget_id}" data-tasks-title="{title}" data-tasks-default-open-depth="{default_open_depth}" data-tasks-jitter="{jitter}" data-tasks-jitter-y="{jitter_y}" data-tasks-spacing="{spacing}"{optional_layout_attrs_str} data-tasks-payload="{payload}" data-tasks-graph="{graph_payload}">'
        f'<div class="absolute top-2 right-2 z-10 flex items-center gap-1">'
        f'<button onclick="openTasksFullscreen(\'{widget_id}\')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Fullscreen">⛶</button>'
        f'<div class="flex items-center gap-1 text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">'
        f'<button type="button" title="Fit view" onclick="runTasksHeaderAction(\'{widget_id}\', \'fit\')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">F</button>'
        f'<button type="button" title="Expand next group depth" onclick="runTasksHeaderAction(\'{widget_id}\', \'expandDepth\')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">I</button>'
        f'<button type="button" title="Collapse deepest group depth" onclick="runTasksHeaderAction(\'{widget_id}\', \'collapseDepth\')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">O</button>'
        f'<button type="button" title="Unfold all groups" onclick="runTasksHeaderAction(\'{widget_id}\', \'expand\')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">U</button>'
        f'<button type="button" title="Collapse all groups" onclick="runTasksHeaderAction(\'{widget_id}\', \'collapse\')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">P</button>'
        f'</div>'
        f'</div>'
        f'<div class="px-4 py-3 pr-14 border-b border-slate-200 dark:border-slate-800 flex items-start gap-3">'
        f'<div class="min-w-0 flex-1">'
        f'<div class="text-sm font-semibold">{title}</div>'
        f'<div class="text-xs text-slate-500 dark:text-slate-400">{html.escape(summary)}</div>'
        f'</div>'
        f'</div>'
        f'<div class="vyasa-tasks-flow" style="height:{flow_height};min-height:420px;overflow:hidden;cursor:grab">'
        '<div class="vyasa-tasks-scene" style="position:relative;width:100%;height:100%;transform-origin:center center"></div></div>'
        f'</div>'
    )
