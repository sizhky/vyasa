from __future__ import annotations

import html
import re
from itertools import count


_diagram_uid_counter = count(1)


def render_mermaid_block(code: str) -> str:
    frontmatter_match = re.match(r"^---\s*\n(.*?)\n---\s*\n", code, re.DOTALL)
    height, width, min_height, gantt_width, mermaid_title = "auto", "65vw", "400px", None, None
    if frontmatter_match:
        frontmatter_content = frontmatter_match.group(1)
        code = code[frontmatter_match.end():]
        try:
            config = dict(line.split(":", 1) for line in frontmatter_content.strip().split("\n") if ":" in line)
            config = {k.strip(): v.strip() for k, v in config.items()}
            height = config.get("height", height)
            min_height = height if "height" in config else min_height
            width = config.get("width", width)
            mermaid_title = config.get("title")
            if "aspect_ratio" in config:
                aspect_value = config["aspect_ratio"].strip()
                ratio = (lambda p: float(p[0]) / float(p[1]))(aspect_value.split(":")) if ":" in aspect_value else float(aspect_value)
                gantt_width = int(1200 * ratio)
        except Exception:
            pass
    diagram_id = f"mermaid-{abs(hash(code)) & 0xFFFFFF}-{next(_diagram_uid_counter)}"
    container_style = f"width: {width}; position: relative; left: 50%; transform: translateX(-50%);" if "vw" in str(width).lower() else f"width: {width};"
    escaped_code = code.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#39;")
    gantt_data_attr = f' data-gantt-width="{gantt_width}"' if gantt_width else ""
    mermaid_title_attr = f' data-mermaid-title="{html.escape(str(mermaid_title))}"' if mermaid_title else ""
    caption_html = f'<div class="text-xs text-slate-500 dark:text-slate-400 text-center px-3 pb-2">{html.escape(str(mermaid_title))}</div>' if mermaid_title else ""
    return f"""<div class="mermaid-container relative border-4 rounded-md my-4 shadow-2xl" style="{container_style}"><div class="mermaid-controls absolute top-2 right-2 z-10 flex gap-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded"><button onclick="openMermaidFullscreen('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Fullscreen">⛶</button><button onclick="resetMermaidZoom('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Reset zoom">Reset</button><button onclick="zoomMermaidIn('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Zoom in">+</button><button onclick="zoomMermaidOut('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Zoom out">−</button></div><div id="{diagram_id}" class="mermaid-wrapper p-4 overflow-hidden flex justify-center items-center" style="min-height: {min_height}; height: {height};" data-mermaid-code="{escaped_code}"{gantt_data_attr}{mermaid_title_attr}><pre class="mermaid" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">{code}</pre></div>{caption_html}</div>"""
