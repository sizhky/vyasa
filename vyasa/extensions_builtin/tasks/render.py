from __future__ import annotations

import html
import json
import re
from itertools import count

from ...markdown_fence import normalize_items_model_hrefs, split_fence_frontmatter
from .layout import build_collapsed_graph
from .model import apply_edge_label_fallbacks, parse_tasks_text
from ..markdown.renderer import _render_markdown_fragment


_diagram_uid_counter = count(1)
_RENDERABLE_NODE_KEYS = {
    "id", "label", "kind", "__kind__", "group_id", "parent_group_id",
    "handlelayout", "highlightmode", "sourcegroupid",
    "width", "height", "position", "parentid", "color", "href", "image", "rank",
    "card_state", "__checked__", "__card_state__", "__card_state_color__", "__has_note__",
    "__rendered_attrs__",
}


def _prepare_node_attr_markdown(value) -> str:
    text = str(value).replace("\\r\\n", "\n").replace("\\n", "\n")
    stripped = text.strip()
    if (stripped.startswith('"') and stripped.endswith('"')) or (stripped.startswith("'") and stripped.endswith("'")):
        text = stripped[1:-1]
    return re.sub(r"(?<!\n)\n(?!\n)", "<br>\n", text)


def _attach_rendered_node_attrs(model: dict, current_path: str | None) -> None:
    for bucket in ("groups", "tasks"):
        for node in model.get(bucket, []):
            rendered_attrs = {}
            for key, value in node.items():
                lowered = str(key).lower()
                if lowered in _RENDERABLE_NODE_KEYS:
                    continue
                if value is None or value == "":
                    continue
                if not isinstance(value, (str, int, float, bool)):
                    continue
                rendered_attrs[key] = _render_markdown_fragment(
                    _prepare_node_attr_markdown(value),
                    current_path=current_path,
                )
            if rendered_attrs:
                node["__rendered_attrs__"] = rendered_attrs


def _should_open_filters_by_default(width_value) -> bool:
    width_text = str(width_value or "").strip().lower()
    match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)vw", width_text)
    if not match:
        return False
    try:
        return float(match.group(1)) >= 90.0
    except ValueError:
        return False


def render_tasks_block(code: str, current_path: str | None = None, fence_name: str = "tasks") -> str:
    raw_code = html.unescape(code)
    config, code = split_fence_frontmatter(raw_code)
    storage_suffix = abs(hash((current_path or "", raw_code))) & 0xFFFFFF
    try:
        model = parse_tasks_text(f"```tasks\n{raw_code}\n```", current_path=current_path)
        if config.get("title") and not model.get("title"):
            model["title"] = config["title"]
        if config.get("id"):
            model["graph_id"] = config["id"]
            model["persistence_id"] = config["id"]
        elif not model.get("persistence_id") and model.get("title"):
            slug = re.sub(r"[^a-z0-9]+", "-", str(model.get("title") or "").lower()).strip("-")
            model["persistence_id"] = slug or ""
        model["document_path"] = str(current_path or "")
        model["storage_id"] = f"tasks-block-{storage_suffix}"
        if "filter_attributes" in config:
            model["filter_attributes"] = config["filter_attributes"]
        if "filter_whitelist" in config:
            model["filter_whitelist"] = config["filter_whitelist"]
        if "filter_blacklist" in config:
            model["filter_blacklist"] = config["filter_blacklist"]
        if "card_states" in config:
            model["card_states"] = config["card_states"]
        if isinstance(config.get("color_by"), str) and config.get("color_by") and not model.get("color_by"):
            model["color_by"] = config["color_by"]
        if isinstance(config.get("color_by"), dict):
            palettes = {k: v for k, v in config["color_by"].items() if isinstance(v, dict)}
            if palettes:
                model["node_color_palettes"] = {**model.get("node_color_palettes", {}), **palettes}
                if not model.get("color_by"):
                    model["color_by"] = next(iter(palettes.keys()), "")
        if config.get("color_palette") and not model.get("color_palette"):
            model["color_palette"] = config["color_palette"]
            model["node_color_palettes"] = {**model.get("node_color_palettes", {}), model.get("color_by", ""): config["color_palette"]}
        if config.get("edge_color_by") and not model.get("edge_color_by"):
            model["edge_color_by"] = config["edge_color_by"]
        if config.get("edge_color_palette") and not model.get("edge_color_palette"):
            model["edge_color_palette"] = config["edge_color_palette"]
            model["edge_color_palettes"] = {**model.get("edge_color_palettes", {}), model.get("edge_color_by", ""): config["edge_color_palette"]}
        apply_edge_label_fallbacks(model)
        normalize_items_model_hrefs(model, current_path)
        _attach_rendered_node_attrs(model, current_path)
        graph = build_collapsed_graph(model)
    except Exception:
        model = {
            "graph_id": f"tasks-{next(_diagram_uid_counter)}",
            "persistence_id": (re.sub(r"[^a-z0-9]+", "-", str(config.get("id") or config.get("title") or "").lower()).strip("-") or ""),
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
            "node_color_palettes": {},
            "card_states": [],
            "document_path": str(current_path or ""),
            "storage_id": f"tasks-block-{storage_suffix}",
        }
        graph = {"nodes": [], "edges": []}
    widget_id = f"tasks-{abs(hash(code)) & 0xFFFFFF}-{next(_diagram_uid_counter)}"
    payload = html.escape(json.dumps(model))
    graph_payload = html.escape(json.dumps(graph))
    title = html.escape(config.get("title") or model.get("title") or "Items")
    default_open_depth = html.escape(str(config.get("default_open_depth") or 0))
    gantt_enabled = str(config.get("gantt") or "").strip().lower() in {"1", "true", "yes", "on"}
    default_view = str(config.get("default_view") or config.get("view") or "graph").strip().lower()
    default_view = "gantt" if gantt_enabled and default_view == "gantt" else "graph"
    width = config.get("width") or "95vw"
    open_filters_by_default = _should_open_filters_by_default(width)
    min_height = config.get("min_height") or ("420px" if fence_name != "tasks" else "")
    flow_height = html.escape(str(config.get("height") or "70vh"))
    node_card_width = html.escape(str(config.get("node-card-width") or "480px"))
    hover_font_size = html.escape(str(config.get("hover-font-size") or "12px"))
    color_mix = html.escape(str(config.get("color_mix", True)).lower())
    color_mix_intensity = html.escape(str(config.get("color_mix_intensity") or "22"))
    projection_group_opacity = html.escape(str(config.get("projection-group-opacity") or "12"))
    projection_unspecified_group_opacity = html.escape(str(config.get("projection-unspecified-group-opacity") or "7"))
    stats_label = html.escape(f"{len(model.get('groups') or []) + len(model.get('tasks') or [])} Nodes and {len(model.get('dependency_edges') or [])} Edges")
    jitter = html.escape(str(config.get("jitter") or 0))
    jitter_y = html.escape(str(config.get("jitter_y") or config.get("jitter") or 0))
    spacing = html.escape(str(config.get("spacing") or "normal"))
    if "direction" in config and "layout_direction" not in config:
        config["layout_direction"] = config["direction"]
    optional_layout_attrs = []
    for key, data_name in (
        ("layout_direction", "data-tasks-layout-direction"),
        ("node_spacing", "data-tasks-node-spacing"),
        ("layer_spacing", "data-tasks-layer-spacing"),
        ("collision_gap", "data-tasks-collision-gap"),
        ("group_padding", "data-tasks-group-padding"),
        ("edge_label_width", "data-tasks-edge-label-width"),
        ("projection-unspecified-content-opacity", "data-tasks-projection-unspecified-content-opacity"),
    ):
        if key in config:
            optional_layout_attrs.append(f'{data_name}="{html.escape(str(config[key]))}"')
    optional_layout_attrs_str = (" " + " ".join(optional_layout_attrs)) if optional_layout_attrs else ""
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
        f'data-tasks-widget="true" id="{widget_id}" data-tasks-title="{title}" data-tasks-default-open-depth="{default_open_depth}" data-tasks-gantt="{str(gantt_enabled).lower()}" data-tasks-default-view="{html.escape(default_view)}" data-tasks-open-filters-default="{str(open_filters_by_default).lower()}" data-tasks-node-card-width="{node_card_width}" data-tasks-hover-font-size="{hover_font_size}" data-tasks-color-mix="{color_mix}" data-tasks-color-mix-intensity="{color_mix_intensity}" data-tasks-projection-group-opacity="{projection_group_opacity}" data-tasks-projection-unspecified-group-opacity="{projection_unspecified_group_opacity}" data-tasks-jitter="{jitter}" data-tasks-jitter-y="{jitter_y}" data-tasks-spacing="{spacing}"{optional_layout_attrs_str} data-tasks-payload="{payload}" data-tasks-graph="{graph_payload}">'
        f'<div class="absolute top-2 right-2 z-10 flex items-center gap-1">'
        f'<button onclick="openTasksFullscreen(\'{widget_id}\')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Fullscreen (Shift+F)">⛶</button>'
        f'<div class="flex items-center gap-1 text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">'
        f'<button type="button" title="Show graph shortcuts and gestures" onclick="runTasksHeaderAction(\'{widget_id}\', \'toggleHelp\')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">?</button>'
        f'<button type="button" title="Fit view" onclick="runTasksHeaderAction(\'{widget_id}\', \'fit\')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">F</button>'
        f'<button type="button" title="Open selected ego graph (G)" onclick="runTasksHeaderAction(\'{widget_id}\', \'openEgo\')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">EG</button>'
        f'<button type="button" title="Open selected ego graph with neighbors (Shift+G)" onclick="runTasksHeaderAction(\'{widget_id}\', \'openEgoNeighbors\')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">EG+</button>'
        f'<button type="button" title="Expand next group depth" onclick="runTasksHeaderAction(\'{widget_id}\', \'expandDepth\')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">I</button>'
        f'<button type="button" title="Collapse deepest group depth" onclick="runTasksHeaderAction(\'{widget_id}\', \'collapseDepth\')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">O</button>'
        f'<button type="button" title="Unfold all groups" onclick="runTasksHeaderAction(\'{widget_id}\', \'expand\')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">U</button>'
        f'<button type="button" title="Collapse all groups" onclick="runTasksHeaderAction(\'{widget_id}\', \'collapse\')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">P</button>'
        f'<button type="button" title="Toggle edges" onclick="runTasksHeaderAction(\'{widget_id}\', \'toggleEdges\')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">E</button>'
        f'</div>'
        f'</div>'
        f'<div class="px-4 py-3 pr-14 border-b border-slate-200 dark:border-slate-800 flex items-start gap-3">'
        f'<button type="button" title="Toggle filters" aria-label="Toggle task filters" onclick="runTasksHeaderAction(\'{widget_id}\', \'toggleFilters\')" class="relative z-40 mt-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-2 py-1 font-mono text-xs leading-none text-slate-700 dark:text-slate-300">☰</button>'
        f'<div class="min-w-0 flex-1">'
        f'<div class="text-sm font-semibold">{title}</div>'
        f'<div data-tasks-stats class="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{stats_label}</div>'
        f'</div>'
        f'</div>'
        f'<div class="vyasa-tasks-flow" style="height:{flow_height};min-height:420px;overflow:hidden;cursor:grab">'
        '<div class="vyasa-tasks-scene" style="position:relative;width:100%;height:100%;transform-origin:center center"></div></div>'
        f'</div>'
    )
