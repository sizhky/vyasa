import html
import re
from functools import partial
from itertools import count
from pathlib import Path

import mistletoe as mst
from fasthtml.common import Div, Link, NotStr, Span, to_xml
from loguru import logger
from monsterui.all import UkIcon, apply_classes

from .assets import asset_url
from .config import get_config
from .helpers import (
    _plain_text_from_html,
    _unique_anchor,
    parse_frontmatter,
    resolve_heading_anchor,
    text_to_anchor,
)
from .slides import present_href_for_anchor
from .markdown_pipeline import (
    extract_footnotes,
    preprocess_callouts,
    preprocess_code_includes,
    preserve_newlines as preserve_md_newlines,
    preprocess_super_sub,
)
from .markdown_tabs import postprocess_tabs as postprocess_md_tabs
from .markdown_tabs import preprocess_tabs as preprocess_md_tabs
from .markdown_tokens import (
    DownloadEmbed,
    FootnoteRef,
    IframeEmbed,
    InlineCodeAttr,
    Strikethrough,
    Subscript,
    Superscript,
    YoutubeEmbed,
)

_diagram_uid_counter = count(1)
_CALLOUT_META = {
    "note": ("Note", "info"), "abstract": ("Abstract", "file-text"), "info": ("Info", "info"),
    "todo": ("Todo", "check"), "tip": ("Tip", "bolt"), "success": ("Success", "check"),
    "question": ("Question", "question"), "warning": ("Warning", "warning"), "failure": ("Failure", "close"),
    "danger": ("Danger", "warning"), "bug": ("Bug", "bug"), "example": ("Example", "code"), "quote": ("Quote", "quote-right"),
}
_CALLOUT_SVGS = {
    "info": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><path d="M12 7h.01"/></svg>',
    "file-text": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/><path d="M9 9h1"/></svg>',
    "check": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 5 5L20 7"/></svg>',
    "bolt": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
    "question": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.8-1.7 1.3-1.7 2.7"/><path d="M12 17h.01"/></svg>',
    "warning": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 2.8 19a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    "close": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
    "bug": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 8a4 4 0 1 1 8 0"/><path d="M9 9h6v8a3 3 0 0 1-6 0z"/><path d="M3 13h4"/><path d="M17 13h4"/><path d="m5 7 3 2"/><path d="m19 7-3 2"/><path d="m5 19 3-2"/><path d="m19 19-3-2"/></svg>',
    "code": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m8 16-4-4 4-4"/><path d="m16 8 4 4-4 4"/><path d="m14 4-4 16"/></svg>',
    "quote-right": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 11H6a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4h1"/><path d="M20 11h-4a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4h1"/></svg>',
}
_TODO_META_SVGS = {
    "owner": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></svg>',
    "deadline": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 11h18"/></svg>',
    "priority": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><path d="m5 10 7-7 7 7"/></svg>',
    "status": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/></svg>',
    "project": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18"/><path d="M6 3h12l1 4H5z"/><path d="M5 7h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/></svg>',
}
_TODO_META_ALIASES = {
    "author": "owner",
    "assignee": "owner",
    "person": "owner",
    "user": "owner",
    "who": "owner",
    "due": "deadline",
    "date": "deadline",
    "when": "deadline",
    "eta": "deadline",
    "urgency": "priority",
    "severity": "priority",
    "importance": "priority",
    "state": "status",
    "phase": "status",
    "bucket": "project",
    "area": "project",
    "team": "project",
    "stream": "project",
}


def _todo_accent(text):
    seed = 0
    for ch in text:
        seed = (seed * 33 + ord(ch)) % 360
    return f"hsl({seed} 40% 52%)"


def _callout_label(kind):
    return _CALLOUT_META.get(kind, (kind.replace("-", " ").replace("_", " ").title(), "info"))[0]


def _callout_icon(kind):
    return _CALLOUT_SVGS.get(_CALLOUT_META.get(kind, ("", "info"))[1], _CALLOUT_SVGS["info"])


def _render_callout(kind, body, render_body, title=None, fold=None):
    theme_kind = kind if kind in _CALLOUT_META else "note"
    rendered = render_body(body).strip()
    heading = html.escape(title or _callout_label(kind))
    head_cls = "vyasa-callout-head vyasa-callout-head-with-body flex items-center gap-2" if rendered else "vyasa-callout-head flex items-center gap-2"
    chevron = '<span class="vyasa-callout-chevron" aria-hidden="true"></span>' if fold else ""
    head = f'<div class="{head_cls}"><span class="vyasa-callout-icon">{_callout_icon(theme_kind)}</span><span class="vyasa-callout-label text-sm font-semibold tracking-[0.02em]">{heading}</span>{chevron}</div>'
    body_html = f'<div class="vyasa-callout-body">{rendered}</div>' if rendered else ""
    if fold:
        open_attr = " open" if fold == "+" else ""
        return f'<details class="vyasa-callout vyasa-callout-{theme_kind} my-6 rounded-xl border px-5 py-4" data-callout="{html.escape(kind)}"{open_attr}><summary class="vyasa-callout-summary list-none cursor-pointer">{head}</summary>{body_html}</details>'
    return f'<div class="vyasa-callout vyasa-callout-{theme_kind} my-6 rounded-xl border px-5 py-4" data-callout="{html.escape(kind)}">{head}{body_html}</div>'


def _render_markdown_fragment(body, img_dir=None, current_path=None):
    rendered = to_xml(from_md(body, img_dir=img_dir, current_path=current_path))
    rendered = re.sub(r'^<div class="w-full">\s*<link[^>]+>\s*', "", rendered)
    return re.sub(r"\s*</div>\s*$", "", rendered)


def _infer_code_language(path):
    mapping = {
        ".py": "python", ".js": "javascript", ".ts": "typescript", ".tsx": "tsx",
        ".jsx": "jsx", ".json": "json", ".toml": "toml", ".md": "markdown",
        ".sh": "bash", ".html": "html", ".css": "css", ".yml": "yaml", ".yaml": "yaml",
    }
    return mapping.get(Path(path).suffix.lower(), "")


def _parse_line_spec(spec):
    match = re.search(r"ln\[(\d+):(\d+)\]", spec)
    return (int(match.group(1)), int(match.group(2))) if match else None


def _parse_highlight_spec(spec):
    match = re.search(r"hl\[([^\]]+)\]", spec)
    return match.group(1).replace(":", "-").replace(" ", "") if match else ""


def _render_code_include(snippet, lang="", start=1, highlight_spec=""):
    attrs = [f'data-code-source-start="{start}"']
    if highlight_spec:
        attrs.append(f'data-code-highlight-lines="{html.escape(highlight_spec)}"')
    lang_class = f' class="language-{lang}"' if lang else ""
    return (
        '<div class="code-block relative my-4">'
        f'<pre><code{lang_class} {" ".join(attrs)}>{html.escape(snippet)}</code></pre>'
        '</div>'
    )


def _render_todo_html(html_out):
    def _todo_accent(text):
        seed = 0
        for ch in text:
            seed = (seed * 33 + ord(ch)) % 360
        hue = seed
        return f"hsl({hue} 38% 46%)"

    def _rewrite_todo(match):
        todo_html = match.group(0)
        plain = re.sub(r"<[^>]+>", " ", todo_html)
        accent = _todo_accent(" ".join(plain.split()))
        todo_html = todo_html.replace(
            "<todo>",
            f'<todo style="--vyasa-callout-accent: {accent};">',
            1,
        )
        def _rewrite_meta(meta_match):
            kind = meta_match.group(1)
            label = re.sub(r"^[^A-Za-z0-9<]+", "", meta_match.group(2)).strip()
            return f'<span class="{kind}"><span class="vyasa-todo-meta-icon" aria-hidden="true">{_TODO_META_SVGS[kind]}</span><span>{label}</span></span>'
        return re.sub(r'<span class="(owner|deadline)">([\s\S]*?)</span>', _rewrite_meta, todo_html)
    return re.sub(r"<todo>[\s\S]*?</todo>", _rewrite_todo, html_out)


def _render_double_rules(html_out):
    pattern = re.compile(r'(<hr[^>]*>\s*){2,}', re.IGNORECASE)

    def repl(match):
        hrs = re.findall(r"<hr[^>]*>", match.group(0), flags=re.IGNORECASE)
        if len(hrs) == 2:
            return '<div class="vyasa-double-rule" aria-hidden="true"><hr><hr></div>'
        return match.group(0)

    return pattern.sub(repl, html_out)


class FrankenRenderer(mst.HTMLRenderer):
    def __init__(self, *args, img_dir=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.img_dir = img_dir

    def render_image(self, token):
        tpl = '<img src="{}" alt="{}"{}  class="max-w-full h-auto rounded-lg mb-6">'
        title = f' title="{token.title}"' if hasattr(token, "title") else ""
        src = token.src
        if self.img_dir and not src.startswith(
            ("http://", "https://", "/", "attachment:", "blob:", "data:")
        ):
            src = f"{self.img_dir}/{src}"
        return tpl.format(src, token.children[0].content if token.children else "", title)


def _asset_url(path):
    return asset_url(path)


def get_root_folder():
    return get_config().get_root_folder()


def _resolve_raw_html_url(url, current_path):
    if not current_path or not url:
        return url
    match = re.match(r"^([^?#]*)(.*)$", url)
    base, suffix = match.groups() if match else (url, "")
    if not base or base.startswith(("/", "#", "//")) or re.match(r"^[a-zA-Z][\w+.-]*:", base):
        return url
    root = get_root_folder().resolve()
    current_dir = (root / current_path).parent
    resolved = (current_dir / base).resolve()
    try:
        rel = resolved.relative_to(root).as_posix()
    except ValueError:
        return url
    mapped = f"/posts/{rel[:-3]}" if rel.endswith(".md") else f"/{'static' if rel.startswith('static/') else 'posts'}/{rel if not rel.startswith('static/') else rel[7:]}"
    return mapped + suffix


def _rewrite_raw_html_urls(content, current_path):
    def rewrite_attr(match):
        name, quote, value = match.groups()
        if name.lower() == "srcset":
            parts = []
            for item in value.split(","):
                tokens = item.strip().split(None, 1)
                if not tokens:
                    continue
                tokens[0] = _resolve_raw_html_url(tokens[0], current_path)
                parts.append(" ".join(tokens))
            value = ", ".join(parts)
        else:
            value = _resolve_raw_html_url(value, current_path)
        return f'{name}={quote}{value}{quote}'
    return re.sub(r'\b(src|href|poster|srcset)=(["\'])(.*?)\2', rewrite_attr, content, flags=re.IGNORECASE)


def _escape_attr(value):
    if value is None:
        return None
    return (
        str(value)
        .replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _render_d2_block(code):
    frontmatter_pattern = r"^---\s*\n(.*?)\n---\s*\n"
    frontmatter_match = re.match(frontmatter_pattern, code, re.DOTALL)
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
        except Exception as e:
            print(f"Error parsing d2 frontmatter: {e}")
    diagram_id = f"d2-{abs(hash(code)) & 0xFFFFFF}-{next(_diagram_uid_counter)}"
    container_style = f"width: {width}; position: relative; left: 50%; transform: translateX(-50%);" if "vw" in str(width).lower() else f"width: {width};"
    escaped_code = code.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#39;")
    pairs = [("layout", d2_layout), ("theme-id", d2_theme_id), ("dark-theme-id", d2_dark_theme_id), ("sketch", d2_sketch), ("pad", d2_pad), ("scale", d2_scale), ("target", d2_target), ("animate-interval", d2_animate_interval), ("animate", d2_animate), ("fullscreen-title", d2_fullscreen_title)]
    d2_attr_str = "".join(f' data-d2-{k}="{_escape_attr(v)}"' for k, v in pairs if v is not None)
    caption_html = f'<div class="text-xs text-slate-500 dark:text-slate-400 text-center px-3 pb-2">{html.escape(str(d2_fullscreen_title))}</div>' if d2_fullscreen_title else ""
    return f"""<div class="d2-container relative border-4 rounded-md my-4 shadow-2xl" style="{container_style}"><div class="d2-controls absolute top-2 right-2 z-10 flex gap-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded"><button onclick="openD2Fullscreen('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Fullscreen">⛶</button><button onclick="resetD2Zoom('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Reset zoom">Reset</button><button onclick="zoomD2In('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Zoom in">+</button><button onclick="zoomD2Out('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Zoom out">−</button></div><div id="{diagram_id}" class="d2-wrapper p-4 overflow-hidden flex justify-center items-center" style="min-height: {min_height}; height: {height};" data-d2-code="{escaped_code}"{d2_attr_str}><pre class="d2" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">{code}</pre></div>{caption_html}</div>"""


def _render_mermaid_block(code):
    frontmatter_pattern = r"^---\s*\n(.*?)\n---\s*\n"
    frontmatter_match = re.match(frontmatter_pattern, code, re.DOTALL)
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
        except Exception as e:
            print(f"Error parsing mermaid frontmatter: {e}")
    diagram_id = f"mermaid-{abs(hash(code)) & 0xFFFFFF}-{next(_diagram_uid_counter)}"
    container_style = f"width: {width}; position: relative; left: 50%; transform: translateX(-50%);" if "vw" in str(width).lower() else f"width: {width};"
    escaped_code = code.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#39;")
    gantt_data_attr = f' data-gantt-width="{gantt_width}"' if gantt_width else ""
    mermaid_title_attr = f' data-mermaid-title="{html.escape(str(mermaid_title))}"' if mermaid_title else ""
    caption_html = f'<div class="text-xs text-slate-500 dark:text-slate-400 text-center px-3 pb-2">{html.escape(str(mermaid_title))}</div>' if mermaid_title else ""
    return f"""<div class="mermaid-container relative border-4 rounded-md my-4 shadow-2xl" style="{container_style}"><div class="mermaid-controls absolute top-2 right-2 z-10 flex gap-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded"><button onclick="openMermaidFullscreen('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Fullscreen">⛶</button><button onclick="resetMermaidZoom('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Reset zoom">Reset</button><button onclick="zoomMermaidIn('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Zoom in">+</button><button onclick="zoomMermaidOut('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Zoom out">−</button></div><div id="{diagram_id}" class="mermaid-wrapper p-4 overflow-hidden flex justify-center items-center" style="min-height: {min_height}; height: {height};" data-mermaid-code="{escaped_code}"{gantt_data_attr}{mermaid_title_attr}><pre class="mermaid" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">{code}</pre></div>{caption_html}</div>"""


class ContentRenderer(FrankenRenderer):
    def __init__(self, *extras, img_dir=None, footnotes=None, current_path=None, slide_mode=False, **kwargs):
        super().__init__(*extras, img_dir=img_dir, **kwargs)
        self.footnotes, self.fn_counter = footnotes or {}, 0
        self.current_path = current_path
        self.slide_mode = slide_mode
        self.heading_counts = {}
        self.mermaid_counter = 0
        self.iframe_counter = 0

    def render_list_item(self, token):
        inner = self.render_inner(token)
        task_pattern = re.match(r"^\s*\[([ xX])\]\s*(.*?)$", inner, re.DOTALL)
        if not task_pattern:
            task_pattern = re.match(r"^<p>\s*\[([ xX])\]\s*(.*?)</p>$", inner, re.DOTALL)
        if task_pattern:
            checked = task_pattern.group(1).lower() == "x"
            content = task_pattern.group(2).strip()
            parts = [part.strip() for part in content.split(" | ") if part.strip()]
            title = parts[0] if parts else content
            meta = []
            for part in parts[1:]:
                if ":" not in part:
                    continue
                key, value = [item.strip() for item in part.split(":", 1)]
                key_slug = re.sub(r"[^a-z0-9]+", "-", key.lower()).strip("-")
                key_slug = _TODO_META_ALIASES.get(key_slug, key_slug)
                icon = _TODO_META_SVGS.get(key_slug, _CALLOUT_SVGS["info"])
                value_slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
                extra_cls = ""
                if key_slug == "priority" and value_slug not in {
                    "", "normal", "medium", "default", "none", "low", "minor",
                    "routine", "standard", "usual", "backlog", "someday",
                    "later", "eventually", "whenever", "optional",
                }:
                    extra_cls = " is-elevated"
                meta.append(f'<span class="vyasa-task-meta vyasa-task-meta-{key_slug}{extra_cls}"><span class="vyasa-todo-meta-icon" aria-hidden="true">{icon}</span><span>{html.escape(value)}</span></span>')
            accent = _todo_accent(title)
            done_cls = " is-done" if checked else ""
            meta_row = f'<div class="vyasa-task-meta-row">{"".join(meta)}</div>' if meta else ""
            return f'<li class="vyasa-task-card{done_cls}" style="--vyasa-callout-accent: {accent};"><div class="vyasa-task-pill">Task</div><div class="vyasa-task-copy">{title}</div>{meta_row}</li>\n'
        return f"<li>{inner}</li>\n"

    def render_youtube_embed(self, token):
        video_id = token.video_id
        caption = getattr(token, "caption", None)
        iframe = f"""
        <div class="relative w-full aspect-video my-6 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
            <iframe
                src="https://www.youtube.com/embed/{video_id}"
                title="YouTube video"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                class="absolute inset-0 w-full h-full">
            </iframe>
        </div>
        """
        if caption:
            return iframe + f'<p class="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">{caption}</p>'
        return iframe

    def render_iframe_embed(self, token):
        src = token.src.strip()
        options_raw = getattr(token, "options", None)
        width = "65vw"
        height = "400px"
        title = "Embedded content"
        allow = "clipboard-read; clipboard-write; fullscreen"
        allowfullscreen = True
        caption = None
        popup = False
        border = "default"
        if options_raw:
            for part in options_raw.split(";"):
                if not part.strip() or "=" not in part:
                    continue
                key, value = part.split("=", 1)
                key = key.strip().lower()
                value = value.strip()
                if key == "width":
                    width = value
                elif key == "height":
                    height = value
                elif key == "title":
                    title = value
                elif key == "allow":
                    allow = value
                elif key == "fullscreen":
                    allowfullscreen = value.lower() in ("1", "true", "yes", "on")
                elif key == "caption":
                    caption = value
                elif key == "popup":
                    popup = value.lower() in ("1", "true", "yes", "on")
                elif key == "border":
                    border = value.lower()
        break_out = "vw" in str(width).lower()
        container_style = f"width: {width}; position: relative; left: 50%; transform: translateX(-50%);" if break_out else f"width: {width};"
        self.iframe_counter += 1
        iframe_id = f"iframe-{abs(hash(src)) & 0xFFFFFF}-{self.iframe_counter}"
        fullscreen_button = ""
        if popup:
            fullscreen_button = (
                '<div class="iframe-controls absolute top-2 right-2 z-10 flex gap-1 '
                'bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded">'
                f'<button data-iframe-fullscreen-toggle="true" data-iframe-src="{src}" '
                f'data-iframe-title="{title}" data-iframe-allow="{allow}" '
                f'data-iframe-allowfullscreen="{str(allowfullscreen).lower()}" '
                'class="px-2 py-1 text-xs border rounded hover:bg-slate-100 '
                'dark:hover:bg-slate-700" title="Fullscreen">⛶</button></div>'
            )
        if border in ("black", "dark"):
            border_classes = "border border-black"
        elif border in ("none", "false", "0", "off"):
            border_classes = "border border-transparent"
        else:
            border_classes = "border border-slate-200 dark:border-slate-800"
        iframe = f"""
        <div class="relative my-6 rounded-lg overflow-hidden {border_classes}" style="{container_style}">
            {fullscreen_button}
            <iframe
                id="{iframe_id}"
                src="{src}"
                title="{title}"
                frameborder="0"
                allow="{allow}"
                {'allowfullscreen' if allowfullscreen else ''}
                style="width: 100%; height: {height};">
            </iframe>
        </div>
        """
        if caption:
            return iframe + f'<p class="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">{caption}</p>'
        return iframe

    def render_download_embed(self, token):
        raw_path = token.path.strip()
        label = getattr(token, "label", None)
        if self.current_path:
            root = get_root_folder().resolve()
            current_file_full = root / self.current_path
            current_dir = current_file_full.parent
            resolved = (current_dir / raw_path).resolve()
            try:
                rel_path = resolved.relative_to(root).as_posix()
                download_path = f"/download/{rel_path}"
            except ValueError:
                download_path = raw_path
        else:
            download_path = f"/download/{raw_path}"
        if not label:
            label = Path(raw_path).name
        link_class = "underline underline-offset-2 font-medium transition-colors"
        return f'<a href="{download_path}" class="{link_class}" download hx-boost="false">{label}</a>'

    def render_footnote_ref(self, token):
        self.fn_counter += 1
        n, target = self.fn_counter, token.target
        content = self.footnotes.get(target, f"[Missing footnote: {target}]")
        if "\n" in content:
            content = content.replace("\r\n", "\n")
            placeholder = "__VYASA_PARA_BREAK__"
            content = content.replace("\n\n", f"\n{placeholder}\n")
            content = content.replace("\n", "<br>\n")
            content = content.replace(f"\n{placeholder}\n", "\n\n")
        rendered = mst.markdown(content, partial(ContentRenderer, img_dir=self.img_dir, current_path=self.current_path)).strip()
        if rendered.startswith("<p>") and rendered.endswith("</p>"):
            rendered = rendered[3:-4]
        style = "text-sm leading-relaxed border-l-2 border-amber-400 dark:border-blue-400 pl-3 text-neutral-500 dark:text-neutral-400 transition-all duration-500 w-full my-2 xl:my-0"
        toggle = f"on click if window.innerWidth >= 1280 then add .hl to #sn-{n} then wait 1s then remove .hl from #sn-{n} else toggle .open on me then toggle .show on #sn-{n}"
        ref = Span(id=f"snref-{n}", role="doc-noteref", aria_label=f"Sidenote {n}", cls="sidenote-ref cursor-pointer", _=toggle)
        note = Span(NotStr(rendered), id=f"sn-{n}", role="doc-footnote", aria_labelledby=f"snref-{n}", cls=f"sidenote {style}")
        hide = lambda c: to_xml(Span(c, cls="hidden", aria_hidden="true"))
        return hide(" (") + to_xml(ref) + to_xml(note) + hide(")")

    def render_heading(self, token):
        level = token.level
        inner = self.render_inner(token)
        plain = _plain_text_from_html(inner)
        heading_text, anchor = resolve_heading_anchor(plain, self.heading_counts)
        fold_children = ""
        present_here = ""
        if not self.slide_mode:
            fold_children = (
                f'<button type="button" class="vyasa-heading-action vyasa-heading-action-children" '
                f'data-heading-action="children" data-heading-anchor="{anchor}" '
                f'aria-label="Toggle child sections under {html.escape(heading_text)}">'
                f'<span class="vyasa-heading-icon-expand">{to_xml(UkIcon("expand"))}</span>'
                f'<span class="vyasa-heading-icon-collapse">{to_xml(UkIcon("shrink"))}</span></button>'
            )
            if self.current_path:
                md_path = get_root_folder() / f"{self.current_path}.md"
                if md_path.exists():
                    present_href = present_href_for_anchor(md_path.read_text(encoding="utf-8"), self.current_path, anchor)
                    present_here = f'<a href="{present_href}" class="vyasa-heading-action vyasa-heading-launch no-underline text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Present from here" hx-boost="false">{to_xml(UkIcon("play-circle"))}</a>'
        permalink = (
            f'<a href="#{anchor}" class="vyasa-heading-permalink no-underline '
            f'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" '
            f'aria-label="Link to {html.escape(heading_text)}">'
            f'<span class="vyasa-heading-permalink-icon">{to_xml(UkIcon("link"))}</span>'
            f'<span class="vyasa-heading-permalink-copied">'
            f'{to_xml(UkIcon("check"))}<span>URL copied</span></span>'
            '</a>'
        )
        return f'<h{level} id="{anchor}"><span class="vyasa-heading-text">{html.escape(heading_text)}</span>{fold_children}{present_here}{permalink}</h{level}>'

    def render_superscript(self, token):
        return f"<sup>{token.content}</sup>"

    def render_subscript(self, token):
        return f"<sub>{token.content}</sub>"

    def render_strikethrough(self, token):
        return f"<del>{self.render_inner(token)}</del>"

    def render_inline_code_attr(self, token):
        code = html.escape(token.code)
        attrs = token.attrs.strip()
        classes = []
        id_attr = None
        other_attrs = []
        for attr in re.findall(r"\.([^\s\.#]+)|#([^\s\.#]+)|([^\s\.#=]+)=([^\s\.#]+)", attrs):
            if attr[0]:
                classes.append(attr[0])
            elif attr[1]:
                id_attr = attr[1]
            elif attr[2]:
                other_attrs.append(f'{attr[2]}="{attr[3]}"')
        html_attrs = []
        if classes:
            html_attrs.append(f'class="{" ".join(classes)}"')
        if id_attr:
            html_attrs.append(f'id="{id_attr}"')
        html_attrs.extend(other_attrs)
        attr_str = " " + " ".join(html_attrs) if html_attrs else ""
        return f"<span{attr_str}>{code}</span>"

    def render_block_code(self, token):
        lang = getattr(token, "language", "")
        code = self.render_raw_text(token)
        if lang == "d2":
            return _render_d2_block(code)
        if lang == "mermaid":
            return _render_mermaid_block(code)
        raw_code = code
        code = html.unescape(code)
        if lang and lang.lower() != "markdown":
            code = html.escape(code)
        lang_class = f' class="language-{lang}"' if lang else ""
        icon_html = to_xml(UkIcon("copy", cls="w-4 h-4"))
        code_id = f"codeblock-{abs(hash(raw_code)) & 0xFFFFFF}"
        toast_id = f"{code_id}-toast"
        textarea_id = f"{code_id}-clipboard"
        escaped_raw = html.escape(raw_code)
        return (
            '<div class="code-block relative my-4">'
            f'<button type="button" class="code-copy-button absolute top-2 right-2 '
            "inline-flex items-center justify-center rounded border border-slate-200 "
            "dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 "
            "text-slate-600 dark:text-slate-300 hover:text-slate-900 "
            "dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500 "
            f'transition-colors" aria-label="Copy code" onclick="(function(){{const el=document.getElementById(\'{textarea_id}\');const toast=document.getElementById(\'{toast_id}\');if(!el){{return;}}el.focus();el.select();const text=el.value;const done=()=>{{if(!toast){{return;}}toast.classList.remove(\'opacity-0\');toast.classList.add(\'opacity-100\');setTimeout(()=>{{toast.classList.remove(\'opacity-100\');toast.classList.add(\'opacity-0\');}},1400);}};if(navigator.clipboard&&window.isSecureContext){{navigator.clipboard.writeText(text).then(done).catch(()=>{{document.execCommand(\'copy\');done();}});}}else{{document.execCommand(\'copy\');done();}}}})()">'
            f'{icon_html}<span class="sr-only">Copy code</span></button>'
            f'<div id="{toast_id}" class="absolute top-2 right-10 text-xs bg-slate-900 text-white px-2 py-1 rounded opacity-0 transition-opacity duration-300">Copied</div>'
            f'<textarea id="{textarea_id}" class="absolute left-[-9999px] top-0 opacity-0 pointer-events-none">{escaped_raw}</textarea>'
            f"<pre><code{lang_class}>{code}</code></pre></div>"
        )

    def render_link(self, token):
        href, inner, title = token.target, self.render_inner(token), f' title="{token.title}"' if token.title else ""
        is_hash = href.startswith("#")
        is_external = href.startswith(("http://", "https://", "mailto:", "tel:", "//"))
        is_absolute_internal = href.startswith("/") and not href.startswith("//")
        is_relative = not is_external and not is_absolute_internal
        download_flag = bool(token.title and "download=true" in token.title.lower())
        if "?download=true" in href.lower():
            href = re.sub(r"\?download=true", "", href, flags=re.IGNORECASE)
            download_flag = True
        if is_hash:
            link_class = "underline underline-offset-2 font-medium transition-colors"
            return f'<a href="{href}" class="{link_class}"{title}>{inner}</a>'
        if is_relative:
            original_href = href
            if href.endswith(".md"):
                href = href[:-3]
            if self.current_path:
                root = get_root_folder().resolve()
                current_dir = (root / self.current_path).parent
                resolved = (current_dir / href).resolve()
                logger.debug(f"DEBUG: original_href={original_href}, current_path={self.current_path}, current_dir={current_dir}, resolved={resolved}, root={root}")
                try:
                    href = f"/posts/{resolved.relative_to(root)}"
                    is_absolute_internal = True
                except ValueError as e:
                    is_external = True
                    logger.debug(f"DEBUG: FAILED - ValueError: {e}")
            else:
                is_external = True
        is_internal = is_absolute_internal and "." not in href.split("/")[-1]
        slide_internal = self.slide_mode and href.startswith("/slides/")
        doc_escape = self.slide_mode and is_absolute_internal and not href.startswith("/slides/")
        hx = f' hx-get="{href}" hx-target="#main-content" hx-push-url="true" hx-swap="innerHTML show:window:top"' if (is_internal and not doc_escape) else ""
        ext = "" if (is_internal or is_absolute_internal or is_hash) else ' target="_blank" rel="noopener noreferrer"'
        download_attr = ""
        boost_attr = ' hx-boost="false"' if doc_escape else ""
        if download_flag:
            download_attr = " download"
            boost_attr = ' hx-boost="false"'
            download_target = href[len("/posts/"):] if href.startswith("/posts/") else href.lstrip("/") if href.startswith("/") else href
            href = f"/download/{download_target}"
            hx = ""
        link_class = "underline underline-offset-2 font-medium transition-colors"
        return f'<a href="{href}"{hx}{ext}{download_attr}{boost_attr} class="{link_class}"{title}>{inner}</a>'


def from_md(content, img_dir=None, current_path=None, slide_mode=False):
    content = _rewrite_raw_html_urls(content, current_path)
    if img_dir is None and current_path:
        path_parts = Path(current_path).parts
        img_dir = "/posts/" + "/".join(path_parts[:-1]) if len(path_parts) > 1 else "/posts"

    def _protect_escaped_dollar(md):
        code_blocks = []
        def repl(m):
            code_blocks.append(m.group(0))
            return f"__VYASA_CODEBLOCK_{len(code_blocks)-1}__"
        md = re.sub(r"(```+|~~~+)[\s\S]*?\1", repl, md)
        md = re.sub(r"(`+)([^`]*?)\1", repl, md)
        md = re.sub(r"(\\+)\$", lambda m: "\\" * (len(m.group(1)) - 1) + "@@VYASA_DOLLAR@@", md)
        for i, block in enumerate(code_blocks):
            md = md.replace(f"__VYASA_CODEBLOCK_{i}__", block)
        return md

    content = _protect_escaped_dollar(content)
    content, footnotes = extract_footnotes(content)
    content = preprocess_super_sub(content)
    content, code_include_store = preprocess_code_includes(
        content, current_path=current_path, root_folder=get_root_folder()
    )
    content, callout_data_store = preprocess_callouts(content)
    content, tab_data_store = preprocess_md_tabs(content)
    content = preserve_md_newlines(content)
    mods = {
        "pre": "my-4", "p": "text-base leading-relaxed mb-6", "li": "text-base leading-relaxed",
        "ul": "uk-list uk-list-bullet space-y-2 mb-6 ml-6 text-base", "ol": "uk-list uk-list-decimal space-y-2 mb-6 ml-6 text-base",
        "hr": "vyasa-spacer-rule my-10 border-0 h-0", "h1": "vyasa-doc-heading vyasa-doc-h1 text-3xl font-bold mb-6 mt-8", "h2": "vyasa-doc-heading vyasa-doc-h2 text-2xl font-semibold mb-4 mt-6",
        "h3": "vyasa-doc-heading vyasa-doc-h3 text-xl font-semibold mb-3 mt-5", "h4": "vyasa-doc-heading vyasa-doc-h4 text-lg font-semibold mb-2 mt-4",
        "table": "uk-table uk-table-striped uk-table-hover uk-table-divider uk-table-middle my-6",
    }
    with ContentRenderer(
        YoutubeEmbed, IframeEmbed, DownloadEmbed, InlineCodeAttr, Strikethrough,
        FootnoteRef, Superscript, Subscript, img_dir=img_dir, footnotes=footnotes,
        current_path=current_path, slide_mode=slide_mode,
    ) as renderer:
        html_out = renderer.render(mst.Document(content))
    if tab_data_store:
        def _render_tab_content(tab_content):
            with ContentRenderer(
                YoutubeEmbed, IframeEmbed, DownloadEmbed, InlineCodeAttr, Strikethrough,
                FootnoteRef, Superscript, Subscript, img_dir=img_dir, footnotes=footnotes,
                current_path=current_path,
            ) as renderer:
                return renderer.render(mst.Document(tab_content))
        html_out = postprocess_md_tabs(html_out, tab_data_store, _render_tab_content)
    if callout_data_store:
        def _render_callout_body(callout_body):
            return _render_markdown_fragment(callout_body, img_dir=img_dir, current_path=current_path)
        for callout_id, callout in callout_data_store.items():
            rendered = _render_callout(callout["kind"], callout["body"], _render_callout_body, title=callout.get("title"), fold=callout.get("fold"))
            placeholder = f'<div class="vyasa-callout-placeholder" data-callout-id="{callout_id}"></div>'
            html_out = html_out.replace(placeholder, rendered)
    if code_include_store:
        for include_id, include in code_include_store.items():
            if include["file_path"].exists():
                text = include["file_path"].read_text(encoding="utf-8")
                line_spec = _parse_line_spec(include["spec"])
                start, end = line_spec if line_spec else (1, len(text.splitlines()))
                lines = text.splitlines()
                snippet = "\n".join(lines[start - 1:end])
                lang = _infer_code_language(include["path_text"])
                hl = _parse_highlight_spec(include["spec"])
                rendered = _render_code_include(snippet, lang=lang, start=start, highlight_spec=hl)
            else:
                rendered = _render_callout(
                    "warning",
                    f'Code include not found: `{include["path_text"]}`',
                    lambda body: mst.markdown(body, partial(ContentRenderer, img_dir=img_dir, current_path=current_path)).strip(),
                )
            placeholder = f'<div class="vyasa-code-include-placeholder" data-include-id="{include_id}"></div>'
            html_out = html_out.replace(placeholder, rendered)
    html_out = _render_todo_html(html_out)
    html_out = _render_double_rules(html_out)
    html_out = re.sub(r"(<table\b[\s\S]*?</table>)", r'<div class="vyasa-table-scroll">\1</div>', html_out, flags=re.IGNORECASE)
    return Div(Link(rel="stylesheet", href=_asset_url("/static/sidenote.css")), NotStr(apply_classes(html_out, class_map_mods=mods)), cls="w-full")
