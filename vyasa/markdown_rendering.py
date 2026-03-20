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
    text_to_anchor,
)
from .markdown_pipeline import (
    extract_footnotes,
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
    def __init__(self, *extras, img_dir=None, footnotes=None, current_path=None, **kwargs):
        super().__init__(*extras, img_dir=img_dir, **kwargs)
        self.footnotes, self.fn_counter = footnotes or {}, 0
        self.current_path = current_path
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
            if checked:
                checkbox_style = "background-color: #10b981; border-color: #10b981;"
                checkmark = '<svg class="w-full h-full text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3,8 6,11 13,4"></polyline></svg>'
            else:
                checkbox_style = "background-color: #6b7280; border-color: #6b7280;"
                checkmark = ""
            checkbox = f"""<span class="inline-flex items-center justify-center mr-3 mt-0.5" style="width: 20px; height: 20px; border-radius: 6px; border: 2px solid; {checkbox_style} flex-shrink: 0;">
                {checkmark}
            </span>"""
            return f'<li class="task-list-item flex items-start" style="list-style: none; margin: 0.5rem 0;">{checkbox}<span class="flex-1">{content}</span></li>\n'
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
        link_class = "text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-200 font-medium transition-colors"
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
        anchor = _unique_anchor(text_to_anchor(plain), self.heading_counts)
        return f'<h{level} id="{anchor}">{html.escape(plain)}</h{level}>'

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
            link_class = "text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-200 font-medium transition-colors"
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
        hx = f' hx-get="{href}" hx-target="#main-content" hx-push-url="true" hx-swap="innerHTML show:window:top"' if is_internal else ""
        ext = "" if (is_internal or is_absolute_internal or is_hash) else ' target="_blank" rel="noopener noreferrer"'
        download_attr = ""
        boost_attr = ""
        if download_flag:
            download_attr = " download"
            boost_attr = ' hx-boost="false"'
            download_target = href[len("/posts/"):] if href.startswith("/posts/") else href.lstrip("/") if href.startswith("/") else href
            href = f"/download/{download_target}"
            hx = ""
        link_class = "text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-200 font-medium transition-colors"
        return f'<a href="{href}"{hx}{ext}{download_attr}{boost_attr} class="{link_class}"{title}>{inner}</a>'


def from_md(content, img_dir=None, current_path=None):
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
    content, tab_data_store = preprocess_md_tabs(content)
    content = preserve_md_newlines(content)
    mods = {
        "pre": "my-4", "p": "text-base leading-relaxed mb-6", "li": "text-base leading-relaxed",
        "ul": "uk-list uk-list-bullet space-y-2 mb-6 ml-6 text-base", "ol": "uk-list uk-list-decimal space-y-2 mb-6 ml-6 text-base",
        "hr": "border-t border-border my-8", "h1": "text-3xl font-bold mb-6 mt-8", "h2": "text-2xl font-semibold mb-4 mt-6",
        "h3": "text-xl font-semibold mb-3 mt-5", "h4": "text-lg font-semibold mb-2 mt-4",
        "table": "uk-table uk-table-striped uk-table-hover uk-table-divider uk-table-middle my-6",
    }
    with ContentRenderer(
        YoutubeEmbed, IframeEmbed, DownloadEmbed, InlineCodeAttr, Strikethrough,
        FootnoteRef, Superscript, Subscript, img_dir=img_dir, footnotes=footnotes,
        current_path=current_path,
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
    html_out = re.sub(r"(<table\b[\s\S]*?</table>)", r'<div class="vyasa-table-scroll">\1</div>', html_out, flags=re.IGNORECASE)
    return Div(Link(rel="stylesheet", href=_asset_url("/static/sidenote.css")), NotStr(apply_classes(html_out, class_map_mods=mods)), cls="w-full")
