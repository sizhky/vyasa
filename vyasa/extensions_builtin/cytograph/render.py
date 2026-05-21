from __future__ import annotations

import html
import json

from ...markdown_fence import split_fence_frontmatter
from .source import parse_cytograph_body, resolve_fence_source


_diagram_uid = 0


def render_cytograph_block(code: str, current_path: str | None = None) -> str:
    global _diagram_uid
    config, graph_body = split_fence_frontmatter(html.unescape(code))
    graph = parse_cytograph_body(graph_body)
    nodes = graph.get("nodes", [])
    if len(nodes) >= 120:
        for node in nodes:
            label = str(node.get("label") or "")
            if "/" in label:
                node["full_label"] = label
                node["label"] = label.rsplit("/", 1)[-1]
    layout = str(config.get("layout") or "vyasa")
    initial_depth = int(config.get("initial_depth") or (1 if config.get("source") or len(nodes) >= 120 else 0))
    payload = {
        "layout": layout,
        "initial_depth": initial_depth,
        "source": resolve_fence_source(current_path, config.get("source")) if config.get("source") else "",
        "nodes": graph.get("nodes", []),
        "edges": graph.get("edges", []),
    }
    _diagram_uid += 1
    graph_id = f"cytograph-{_diagram_uid}"
    style = f'height: {html.escape(str(config.get("height") or "36vh"))};'
    escaped = html.escape(json.dumps(payload))
    return (
        f'<div class="cytograph-container relative my-6 rounded-xl border-4 border-slate-200 dark:border-slate-800" '
        f'id="{graph_id}" data-cytograph-widget="true" data-cytograph-payload="{escaped}" style="{style}">'
        f'<div class="absolute top-2 right-2 z-10 flex gap-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded">'
        f'<button onclick="resetCytograph(\'{graph_id}\')" class="px-2 py-1 text-xs border rounded">Reset</button>'
        f'<button onclick="zoomCytographIn(\'{graph_id}\')" class="px-2 py-1 text-xs border rounded">+</button>'
        f'<button onclick="zoomCytographOut(\'{graph_id}\')" class="px-2 py-1 text-xs border rounded">-</button>'
        f'</div><div class="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">Layout: {html.escape(layout)}</div>'
        f'<div class="hidden cytograph-payload">{escaped}</div></div>'
    )
