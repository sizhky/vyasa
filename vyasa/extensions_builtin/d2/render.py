from __future__ import annotations

import html
import re
from itertools import count

from ...markdown_fence import escape_attr


_diagram_uid_counter = count(1)


def render_d2_block(code: str) -> str:
    frontmatter_match = re.match(r"^---\s*\n(.*?)\n---\s*\n", code, re.DOTALL)
    height, width, min_height = "auto", "65vw", "320px"
    d2_layout, d2_theme_id, d2_dark_theme_id = "elk", None, None
    d2_sketch = d2_pad = d2_scale = d2_target = d2_animate_interval = d2_animate = d2_fullscreen_title = None
    if frontmatter_match:
        frontmatter_content = frontmatter_match.group(1)
        code = code[frontmatter_match.end():]
        try:
            config = dict(line.split(":", 1) for line in frontmatter_content.strip().split("\n") if ":" in line)
            config = {k.strip(): v.strip() for k, v in config.items()}
            height = config.get("height", height)
            min_height = height if "height" in config else min_height
            width = config.get("width", width)
            d2_layout = config.get("layout", d2_layout)
            d2_theme_id = config.get("theme_id")
            d2_dark_theme_id = config.get("dark_theme_id")
            d2_sketch = config.get("sketch")
            d2_pad = config.get("pad")
            d2_scale = config.get("scale")
            d2_target = config.get("target")
            d2_animate_interval = config.get("animate_interval", config.get("animate-interval"))
            d2_animate = config.get("animate")
            d2_fullscreen_title = config.get("title", config.get("fullscreen_title"))
        except Exception:
            pass
    diagram_id = f"d2-{abs(hash(code)) & 0xFFFFFF}-{next(_diagram_uid_counter)}"
    container_style = f"width: {width}; position: relative; left: 50%; transform: translateX(-50%);" if "vw" in str(width).lower() else f"width: {width};"
    escaped_code = code.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#39;")
    pairs = [("layout", d2_layout), ("theme-id", d2_theme_id), ("dark-theme-id", d2_dark_theme_id), ("sketch", d2_sketch), ("pad", d2_pad), ("scale", d2_scale), ("target", d2_target), ("animate-interval", d2_animate_interval), ("animate", d2_animate), ("fullscreen-title", d2_fullscreen_title)]
    d2_attr_str = "".join(f' data-d2-{k}="{escape_attr(v)}"' for k, v in pairs if v is not None)
    caption_html = f'<div class="text-xs text-slate-500 dark:text-slate-400 text-center px-3 pb-2">{html.escape(str(d2_fullscreen_title))}</div>' if d2_fullscreen_title else ""
    return f"""<div class="d2-container relative border-4 rounded-md my-4 shadow-2xl" style="{container_style}"><div class="d2-controls absolute top-2 right-2 z-10 flex gap-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded"><button onclick="openD2Fullscreen('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Fullscreen">⛶</button><button onclick="resetD2Zoom('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Reset zoom">Reset</button><button onclick="zoomD2In('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Zoom in">+</button><button onclick="zoomD2Out('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Zoom out">−</button></div><div id="{diagram_id}" class="d2-wrapper p-4 overflow-hidden flex justify-center items-center" style="min-height: {min_height}; height: {height};" data-d2-code="{escaped_code}"{d2_attr_str}><pre class="d2" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">{code}</pre></div>{caption_html}</div>"""
