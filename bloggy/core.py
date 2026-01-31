import re, mistletoe as mst, pathlib, os
import json
from dataclasses import dataclass
from itertools import chain
from urllib.parse import quote_plus
from functools import partial
from functools import lru_cache
from pathlib import Path
from fasthtml.common import *
from fasthtml.common import Beforeware
from fasthtml.jupyter import *
from monsterui.all import *
from starlette.staticfiles import StaticFiles
from .config import get_config
from .helpers import (
    slug_to_title,
    _strip_inline_markdown,
    _plain_text_from_html,
    text_to_anchor,
    _unique_anchor,
    parse_frontmatter,
    get_post_title,
    get_bloggy_config,
    order_bloggy_entries,
    _effective_abbreviations,
    find_folder_note_file,
)
from .layout_helpers import (
    _resolve_layout_config,
    _width_class_and_style,
    _style_attr,
)
from loguru import logger
from fastsql import Database

# disable debug level logs to stdout
logger.remove()
logger.add(sys.stdout, level="INFO")
logfile = Path("/tmp/bloggy_core.log")
logger.add(logfile, rotation="10 MB", retention="10 days", level="DEBUG")

# Markdown rendering setup
try: FrankenRenderer
except NameError:
    class FrankenRenderer(mst.HTMLRenderer):
        def __init__(self, *args, img_dir=None, **kwargs):
            super().__init__(*args, **kwargs)
            self.img_dir = img_dir

        def render_image(self, token):
            tpl = '<img src="{}" alt="{}"{}  class="max-w-full h-auto rounded-lg mb-6">'
            title = f' title="{token.title}"' if hasattr(token, 'title') else ''
            src = token.src
            # Only prepend img_dir if src is relative and img_dir is provided
            if self.img_dir and not src.startswith(('http://', 'https://', '/', 'attachment:', 'blob:', 'data:')):
                src = f'{self.img_dir}/{src}'
            return tpl.format(src, token.children[0].content if token.children else '', title)

def span_token(name, pat, attr, prec=5):
    class T(mst.span_token.SpanToken):
        precedence, parse_inner, parse_group, pattern = prec, False, 1, re.compile(pat)
        def __init__(self, match):
            setattr(self, attr, match.group(1))
            # Optional second parameter
            if hasattr(match, 'lastindex') and match.lastindex and match.lastindex >= 2:
                if name == 'YoutubeEmbed':
                    self.caption = match.group(2) if match.group(2) else None
                elif name == 'MermaidEmbed':
                    self.option = match.group(2) if match.group(2) else None
    T.__name__ = name
    return T

FootnoteRef = span_token('FootnoteRef', r'\[\^([^\]]+)\](?!:)', 'target')
YoutubeEmbed = span_token(
    'YoutubeEmbed',
    r'\[yt:([a-zA-Z0-9_-]+)(?:\|(.+))?\]',
    'video_id',
    6
)

# Superscript and Subscript tokens with higher precedence
class Superscript(mst.span_token.SpanToken):
    pattern = re.compile(r'\^([^\^]+?)\^')
    parse_inner = False
    parse_group = 1
    precedence = 7
    def __init__(self, match):
        self.content = match.group(1)
        self.children = []

class Subscript(mst.span_token.SpanToken):
    pattern = re.compile(r'~([^~]+?)~')
    parse_inner = False
    parse_group = 1
    precedence = 7
    def __init__(self, match):
        self.content = match.group(1)
        self.children = []

# Inline code with Pandoc-style attributes: `code`{.class #id}
class InlineCodeAttr(mst.span_token.SpanToken):
    pattern = re.compile(r'`([^`]+)`\{([^\}]+)\}')
    parse_inner = False
    parse_group = 1
    precedence = 8  # Higher than other inline elements
    def __init__(self, match):
        self.code = match.group(1)
        self.attrs = match.group(2)
        self.children = []

# Strikethrough: ~~text~~
class Strikethrough(mst.span_token.SpanToken):
    pattern = re.compile(r'~~(.+?)~~')
    parse_inner = True
    parse_group = 1
    precedence = 7
    def __init__(self, match):
        self.children = []

def preprocess_super_sub(content):
    """Convert superscript and subscript syntax to HTML before markdown rendering"""
    # Handle superscript ^text^
    content = re.sub(r'\^([^\^\n]+?)\^', r'<sup>\1</sup>', content)
    # Handle subscript ~text~ (but not strikethrough ~~text~~)
    content = re.sub(r'(?<!~)~([^~\n]+?)~(?!~)', r'<sub>\1</sub>', content)
    return content

def extract_footnotes(content):
    pat = re.compile(r'^\[\^([^\]]+)\]:\s*(.+?)(?=(?:^|\n)\[\^|\n\n|\Z)', re.MULTILINE | re.DOTALL)
    defs = {m.group(1): m.group(2).strip() for m in pat.finditer(content)}
    for m in pat.finditer(content): content = content.replace(m.group(0), '', 1)
    return content.strip(), defs

def preprocess_tabs(content):
    """Convert :::tabs syntax to placeholder tokens, store tab data for later processing"""
    import hashlib
    import base64
    
    # Storage for tab data (will be processed after main markdown rendering)
    tab_data_store = {}
    
    # Pattern to match :::tabs...:::
    tabs_pattern = re.compile(r'^:::tabs\s*\n(.*?)^:::', re.MULTILINE | re.DOTALL)
    
    def replace_tabs_block(match):
        tabs_content = match.group(1)
        # Pattern to match ::tab{title="..." ...}
        tab_pattern = re.compile(r'^::tab\{([^\}]+)\}\s*\n(.*?)(?=^::tab\{|\Z)', re.MULTILINE | re.DOTALL)

        def parse_attrs(raw_attrs):
            attrs = {}
            for key, value in re.findall(r'([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)"', raw_attrs):
                attrs[key] = value
            return attrs

        tabs = []
        for tab_match in tab_pattern.finditer(tabs_content):
            raw_attrs = tab_match.group(1)
            tab_content = tab_match.group(2).strip()
            attrs = parse_attrs(raw_attrs)
            title = attrs.get('title')
            if not title:
                continue
            tabs.append({'title': title, 'content': tab_content, 'attrs': attrs})
        
        if not tabs:
            return match.group(0)  # Return original if no tabs found

        title_map = {tab['title']: tab for tab in tabs}
        index_map = {str(i): tab for i, tab in enumerate(tabs)}

        def fence_wrap(content):
            backtick_runs = re.findall(r'`+', content)
            max_run = max((len(run) for run in backtick_runs), default=0)
            fence_len = max(4, max_run + 1)
            fence = '`' * fence_len
            return f'{fence}\n{content}\n{fence}'

        def resolve_tab_content(tab, stack=None):
            stack = stack or set()
            copy_from = tab.get('attrs', {}).get('copy-from')
            if not copy_from:
                return tab['content']
            if copy_from in stack:
                return tab['content']
            source_tab = None
            if copy_from.startswith('index:'):
                index_key = copy_from.split(':', 1)[1].strip()
                source_tab = index_map.get(index_key)
            elif copy_from.isdigit():
                source_tab = index_map.get(copy_from)
            else:
                source_tab = title_map.get(copy_from)
            if not source_tab:
                return tab['content']
            stack.add(copy_from)
            resolved = resolve_tab_content(source_tab, stack)
            stack.remove(copy_from)
            return fence_wrap(resolved)

        for tab in tabs:
            tab['content'] = resolve_tab_content(tab)
        
        # Generate unique ID for this tab group
        tab_id = hashlib.md5(match.group(0).encode()).hexdigest()[:8]
        
        # Store tab data for later processing
        tab_data_store[tab_id] = [(tab['title'], tab['content']) for tab in tabs]
        
        # Return a placeholder that won't be processed by markdown
        placeholder = f'<div class="tab-placeholder" data-tab-id="{tab_id}"></div>'
        return placeholder
    
    processed_content = tabs_pattern.sub(replace_tabs_block, content)
    return processed_content, tab_data_store

class ContentRenderer(FrankenRenderer):
    def __init__(self, *extras, img_dir=None, footnotes=None, current_path=None, **kwargs):
        super().__init__(*extras, img_dir=img_dir, **kwargs)
        self.footnotes, self.fn_counter = footnotes or {}, 0
        self.current_path = current_path  # Current post path for resolving relative links and images
        self.heading_counts = {}
        self.mermaid_counter = 0
    
    def render_list_item(self, token):
        """Render list items with task list checkbox support"""
        inner = self.render_inner(token)
        
        # Check if this is a task list item: starts with [ ] or [x]
        # Try different patterns as the structure might vary
        task_pattern = re.match(r'^\s*\[([ xX])\]\s*(.*?)$', inner, re.DOTALL)
        if not task_pattern:
            task_pattern = re.match(r'^<p>\s*\[([ xX])\]\s*(.*?)</p>$', inner, re.DOTALL)
        
        if task_pattern:
            checked = task_pattern.group(1).lower() == 'x'
            content = task_pattern.group(2).strip()
            
            # Custom styled checkbox
            if checked:
                checkbox_style = 'background-color: #10b981; border-color: #10b981;'
                checkmark = '<svg class="w-full h-full text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3,8 6,11 13,4"></polyline></svg>'
            else:
                checkbox_style = 'background-color: #6b7280; border-color: #6b7280;'
                checkmark = ''
            
            checkbox = f'''<span class="inline-flex items-center justify-center mr-3 mt-0.5" style="width: 20px; height: 20px; border-radius: 6px; border: 2px solid; {checkbox_style} flex-shrink: 0;">
                {checkmark}
            </span>'''
            
            return f'<li class="task-list-item flex items-start" style="list-style: none; margin: 0.5rem 0;">{checkbox}<span class="flex-1">{content}</span></li>\n'
        
        return f'<li>{inner}</li>\n'

    
    def render_youtube_embed(self, token):
        video_id = token.video_id
        caption = getattr(token, 'caption', None)

        iframe = f'''
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
        '''

        if caption:
            return iframe + f'<p class="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">{caption}</p>'
        return iframe
    
    def render_footnote_ref(self, token):
        self.fn_counter += 1
        n, target = self.fn_counter, token.target
        content = self.footnotes.get(target, f"[Missing footnote: {target}]")
        if "\n" in content:
            content = content.replace("\r\n", "\n")
            placeholder = "__BLOGGY_PARA_BREAK__"
            content = content.replace("\n\n", f"\n{placeholder}\n")
            content = content.replace("\n", "<br>\n")
            content = content.replace(f"\n{placeholder}\n", "\n\n")
        rendered = mst.markdown(content, partial(ContentRenderer, img_dir=self.img_dir, current_path=self.current_path)).strip()
        if rendered.startswith('<p>') and rendered.endswith('</p>'): rendered = rendered[3:-4]
        style = "text-sm leading-relaxed border-l-2 border-amber-400 dark:border-blue-400 pl-3 text-neutral-500 dark:text-neutral-400 transition-all duration-500 w-full my-2 xl:my-0"
        toggle = f"on click if window.innerWidth >= 1280 then add .hl to #sn-{n} then wait 1s then remove .hl from #sn-{n} else toggle .open on me then toggle .show on #sn-{n}"
        ref = Span(id=f"snref-{n}", role="doc-noteref", aria_label=f"Sidenote {n}", cls="sidenote-ref cursor-pointer", _=toggle)
        note = Span(NotStr(rendered), id=f"sn-{n}", role="doc-footnote", aria_labelledby=f"snref-{n}", cls=f"sidenote {style}")
        hide = lambda c: to_xml(Span(c, cls="hidden", aria_hidden="true"))
        return hide(" (") + to_xml(ref) + to_xml(note) + hide(")")
    
    def render_heading(self, token):
        """Render headings with anchor IDs for TOC linking"""
        import html
        level = token.level
        inner = self.render_inner(token)
        plain = _plain_text_from_html(inner)
        anchor = _unique_anchor(text_to_anchor(plain), self.heading_counts)
        return f'<h{level} id="{anchor}">{html.escape(plain)}</h{level}>'
    
    def render_superscript(self, token):
        """Render superscript text"""
        return f'<sup>{token.content}</sup>'
    
    def render_subscript(self, token):
        """Render subscript text"""
        return f'<sub>{token.content}</sub>'
    
    def render_strikethrough(self, token):
        """Render strikethrough text"""
        inner = self.render_inner(token)
        return f'<del>{inner}</del>'
    
    def render_inline_code_attr(self, token):
        """Render inline code with Pandoc-style attributes"""
        import html
        code = html.escape(token.code)
        attrs = token.attrs.strip()
        
        # Parse attributes: .class, #id, key=value
        classes = []
        id_attr = None
        other_attrs = []
        
        for attr in re.findall(r'\.([^\s\.#]+)|#([^\s\.#]+)|([^\s\.#=]+)=([^\s\.#]+)', attrs):
            if attr[0]:  # .class
                classes.append(attr[0])
            elif attr[1]:  # #id
                id_attr = attr[1]
            elif attr[2]:  # key=value
                other_attrs.append(f'{attr[2]}="{attr[3]}"')
        
        # Build HTML
        html_attrs = []
        if classes:
            html_attrs.append(f'class="{" ".join(classes)}"')
        if id_attr:
            html_attrs.append(f'id="{id_attr}"')
        html_attrs.extend(other_attrs)
        
        attr_str = ' ' + ' '.join(html_attrs) if html_attrs else ''
        
        # Always use <span> for inline code with attributes - the presence of attributes
        # indicates styling/annotation intent rather than code semantics
        tag = 'span'
        return f'<{tag}{attr_str}>{code}</{tag}>'

    def render_block_code(self, token):
        lang = getattr(token, 'language', '')
        code = self.render_raw_text(token)
        if lang == 'mermaid':
            # Extract frontmatter from mermaid code block
            frontmatter_pattern = r'^---\s*\n(.*?)\n---\s*\n'
            frontmatter_match = re.match(frontmatter_pattern, code, re.DOTALL)
            
            # Default configuration for mermaid diagrams
            height = 'auto'
            width = '65vw'  # Default to viewport width for better visibility
            min_height = '400px'
            gantt_width = None  # Custom Gantt width override
            
            if frontmatter_match:
                frontmatter_content = frontmatter_match.group(1)
                code_without_frontmatter = code[frontmatter_match.end():]
                
                # Parse YAML-like frontmatter (simple key: value pairs)
                try:
                    config = {}
                    for line in frontmatter_content.strip().split('\n'):
                        if ':' in line:
                            key, value = line.split(':', 1)
                            config[key.strip()] = value.strip()
                    
                    # Extract height and width if specified
                    if 'height' in config:
                        height = config['height']
                        min_height = height
                    if 'width' in config:
                        width = config['width']
                    
                    # Handle aspect_ratio for Gantt charts
                    if 'aspect_ratio' in config:
                        aspect_value = config['aspect_ratio'].strip()
                        try:
                            # Parse ratio notation (e.g., "16:9", "21:9", "32:9")
                            if ':' in aspect_value:
                                w_ratio, h_ratio = map(float, aspect_value.split(':'))
                                ratio = w_ratio / h_ratio
                            else:
                                # Parse decimal notation (e.g., "1.78", "2.4")
                                ratio = float(aspect_value)
                            
                            # Calculate Gantt width based on aspect ratio
                            # Base width of 1200, scaled by ratio
                            gantt_width = int(1200 * ratio)
                        except (ValueError, ZeroDivisionError) as e:
                            print(f"Invalid aspect_ratio format '{aspect_value}': {e}")
                            gantt_width = None
                            
                except Exception as e:
                    print(f"Error parsing mermaid frontmatter: {e}")
                
                # Use code without frontmatter for rendering
                code = code_without_frontmatter
            
            self.mermaid_counter += 1
            diagram_id = f"mermaid-{abs(hash(code)) & 0xFFFFFF}-{self.mermaid_counter}"
            
            # Determine if we need to break out of normal content flow
            # This is required for viewport-based widths to properly center
            break_out = 'vw' in str(width).lower()
            
            # Build container style with proper positioning for viewport widths
            if break_out:
                container_style = f"width: {width}; position: relative; left: 50%; transform: translateX(-50%);"
            else:
                container_style = f"width: {width};"
            
            # Escape the code for use in data attribute
            escaped_code = code.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&#39;')
            
            # Add custom Gantt width as data attribute if specified
            gantt_data_attr = f' data-gantt-width="{gantt_width}"' if gantt_width else ''
            
            return f'''<div class="mermaid-container relative border-4 rounded-md my-4 shadow-2xl" style="{container_style}">
                <div class="mermaid-controls absolute top-2 right-2 z-10 flex gap-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded">
                    <button onclick="openMermaidFullscreen('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Fullscreen">⛶</button>
                    <button onclick="resetMermaidZoom('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Reset zoom">Reset</button>
                    <button onclick="zoomMermaidIn('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Zoom in">+</button>
                    <button onclick="zoomMermaidOut('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Zoom out">−</button>
                </div>
                <div id="{diagram_id}" class="mermaid-wrapper p-4 overflow-hidden flex justify-center items-center" style="min-height: {min_height}; height: {height};" data-mermaid-code="{escaped_code}"{gantt_data_attr}><pre class="mermaid" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">{code}</pre></div>
            </div>'''
        
        # For other languages: escape HTML/XML for display, but NOT for markdown 
        # (markdown code blocks should show raw source)
        import html
        raw_code = code
        code = html.unescape(code)
        if lang and lang.lower() != 'markdown':
            code = html.escape(code)
        lang_class = f' class="language-{lang}"' if lang else ''
        icon_html = to_xml(UkIcon("copy", cls="w-4 h-4"))
        code_id = f"codeblock-{abs(hash(raw_code)) & 0xFFFFFF}"
        toast_id = f"{code_id}-toast"
        textarea_id = f"{code_id}-clipboard"
        escaped_raw = html.escape(raw_code)
        return (
            '<div class="code-block relative my-4">'
            f'<button type="button" class="code-copy-button absolute top-2 right-2 '
            'inline-flex items-center justify-center rounded border border-slate-200 '
            'dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 '
            'text-slate-600 dark:text-slate-300 hover:text-slate-900 '
            'dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500 '
            f'transition-colors" aria-label="Copy code" '
            f'onclick="(function(){{const el=document.getElementById(\'{textarea_id}\');const toast=document.getElementById(\'{toast_id}\');if(!el){{return;}}el.focus();el.select();const text=el.value;const done=()=>{{if(!toast){{return;}}toast.classList.remove(\'opacity-0\');toast.classList.add(\'opacity-100\');setTimeout(()=>{{toast.classList.remove(\'opacity-100\');toast.classList.add(\'opacity-0\');}},1400);}};if(navigator.clipboard&&window.isSecureContext){{navigator.clipboard.writeText(text).then(done).catch(()=>{{document.execCommand(\'copy\');done();}});}}else{{document.execCommand(\'copy\');done();}}}})()"'
            '>'
            f'{icon_html}<span class="sr-only">Copy code</span></button>'
            f'<div id="{toast_id}" class="absolute top-2 right-10 text-xs bg-slate-900 text-white px-2 py-1 rounded opacity-0 transition-opacity duration-300">Copied</div>'
            f'<textarea id="{textarea_id}" class="absolute left-[-9999px] top-0 opacity-0 pointer-events-none">{escaped_raw}</textarea>'
            f'<pre><code{lang_class}>{code}</code></pre>'
            '</div>'
        )
    
    def render_link(self, token):
        href, inner, title = token.target, self.render_inner(token), f' title="{token.title}"' if token.title else ''
        # ...existing code...
        is_hash = href.startswith('#')
        is_external = href.startswith(('http://', 'https://', 'mailto:', 'tel:', '//'))
        is_absolute_internal = href.startswith('/') and not href.startswith('//')
        is_relative = not is_external and not is_absolute_internal
        if is_hash:
            link_class = (
                "text-amber-600 dark:text-amber-400 underline underline-offset-2 "
                "hover:text-amber-800 dark:hover:text-amber-200 font-medium transition-colors"
            )
            return f'<a href="{href}" class="{link_class}"{title}>{inner}</a>'
        if is_relative:
            from pathlib import Path
            original_href = href
            if href.endswith('.md'):
                href = href[:-3]
            if self.current_path:
                root = get_root_folder().resolve()
                current_file_full = root / self.current_path
                current_dir = current_file_full.parent
                resolved = (current_dir / href).resolve()
                logger.debug(f"DEBUG: original_href={original_href}, current_path={self.current_path}, current_dir={current_dir}, resolved={resolved}, root={root}")
                try:
                    rel_path = resolved.relative_to(root)
                    href = f'/posts/{rel_path}'
                    is_absolute_internal = True
                    logger.debug(f"DEBUG: SUCCESS - rel_path={rel_path}, final href={href}")
                except ValueError as e:
                    is_external = True
                    logger.debug(f"DEBUG: FAILED - ValueError: {e}")
            else:
                is_external = True
                logger.debug(f"DEBUG: No current_path, treating as external")
        is_internal = is_absolute_internal and '.' not in href.split('/')[-1]
        hx = f' hx-get="{href}" hx-target="#main-content" hx-push-url="true" hx-swap="innerHTML show:window:top"' if is_internal else ''
        ext = '' if (is_internal or is_absolute_internal or is_hash) else ' target="_blank" rel="noopener noreferrer"'
        # Amber/gold link styling, stands out and is accessible
        link_class = (
            "text-amber-600 dark:text-amber-400 underline underline-offset-2 "
            "hover:text-amber-800 dark:hover:text-amber-200 font-medium transition-colors"
        )
        return f'<a href="{href}"{hx}{ext} class="{link_class}"{title}>{inner}</a>'


def postprocess_tabs(html, tab_data_store, img_dir, current_path, footnotes):
    """Replace tab placeholders with fully rendered tab HTML"""
    import hashlib
    
    for tab_id, tabs in tab_data_store.items():
        # Build HTML for this tab group
        html_parts = [f'<div class="tabs-container" data-tabs-id="{tab_id}">']
        
        # Tab buttons
        html_parts.append('<div class="tabs-header">')
        for i, (title, _) in enumerate(tabs):
            active = 'active' if i == 0 else ''
            html_parts.append(f'<button class="tab-button {active}" onclick="switchTab(\'{tab_id}\', {i})">{title}</button>')
        html_parts.append('</div>')
        
        # Tab content panels
        html_parts.append('<div class="tabs-content">')
        for i, (_, tab_content) in enumerate(tabs):
            active = 'active' if i == 0 else ''
            # Render each tab's content as fresh markdown
            with ContentRenderer(YoutubeEmbed, InlineCodeAttr, Strikethrough, FootnoteRef, Superscript, Subscript, img_dir=img_dir, footnotes=footnotes, current_path=current_path) as renderer:
                doc = mst.Document(tab_content)
                rendered = renderer.render(doc)
            html_parts.append(f'<div class="tab-panel {active}" data-tab-index="{i}">{rendered}</div>')
        html_parts.append('</div>')
        
        html_parts.append('</div>')
        tab_html = '\n'.join(html_parts)
        
        # Replace placeholder with rendered tab HTML
        placeholder = f'<div class="tab-placeholder" data-tab-id="{tab_id}"></div>'
        html = html.replace(placeholder, tab_html)
    
    return html

def from_md(content, img_dir=None, current_path=None):
    # Resolve img_dir from current_path if not explicitly provided
    if img_dir is None and current_path:
        # Convert current_path to URL path for images (e.g., demo/books/flat-land/chapter-01 -> /posts/demo/books/flat-land)
        from pathlib import Path
        path_parts = Path(current_path).parts
        if len(path_parts) > 1:
            img_dir = '/posts/' + '/'.join(path_parts[:-1])
        else:
            img_dir = '/posts'
    
    def _protect_escaped_dollar(md):
        import re
        # Protect fenced code blocks first
        code_blocks = []
        def repl(m):
            code_blocks.append(m.group(0))
            return f"__BLOGGY_CODEBLOCK_{len(code_blocks)-1}__"
        md = re.sub(r'(```+|~~~+)[\s\S]*?\1', repl, md)
        # Protect inline code spans (including multi-backtick)
        def repl_inline(m):
            code_blocks.append(m.group(0))
            return f"__BLOGGY_CODEBLOCK_{len(code_blocks)-1}__"
        md = re.sub(r'(`+)([^`]*?)\1', repl_inline, md)
        # Replace escaped dollars with a placeholder to avoid KaTeX auto-render
        def replace_escaped_dollar(m):
            slashes = m.group(1)
            # Remove one escaping backslash, keep the rest literal
            return '\\' * (len(slashes) - 1) + '@@BLOGGY_DOLLAR@@'
        md = re.sub(r'(\\+)\$', replace_escaped_dollar, md)
        # Restore code blocks/spans
        for i, block in enumerate(code_blocks):
            md = md.replace(f"__BLOGGY_CODEBLOCK_{i}__", block)
        return md

    content = _protect_escaped_dollar(content)
    content, footnotes = extract_footnotes(content)
    content = preprocess_super_sub(content)  # Preprocess superscript/subscript
    content, tab_data_store = preprocess_tabs(content)  # Preprocess tabs and get tab data

    # Preprocess: convert single newlines within paragraphs to '  \n' (markdown softbreak)
    # This preserves double newlines (paragraphs) and code blocks
    def _preserve_newlines(md):
        import re
        # Don't touch code blocks (fenced or indented)
        code_block = re.compile(r'(```+|~~~+)[\s\S]*?\1', re.MULTILINE)
        blocks = []
        def repl(m):
            blocks.append(m.group(0))
            return f"__CODEBLOCK_{len(blocks)-1}__"
        md = code_block.sub(repl, md)
        # Replace single newlines not preceded/followed by another newline with '  \n'
        md = re.sub(r'(?<!\n)\n(?!\n)', '  \n', md)
        # Restore code blocks
        for i, block in enumerate(blocks):
            md = md.replace(f"__CODEBLOCK_{i}__", block)
        return md
    content = _preserve_newlines(content)

    mods = {'pre': 'my-4', 'p': 'text-base leading-relaxed mb-6', 'li': 'text-base leading-relaxed',
            'ul': 'uk-list uk-list-bullet space-y-2 mb-6 ml-6 text-base', 'ol': 'uk-list uk-list-decimal space-y-2 mb-6 ml-6 text-base', 
            'hr': 'border-t border-border my-8', 'h1': 'text-3xl font-bold mb-6 mt-8', 'h2': 'text-2xl font-semibold mb-4 mt-6', 
            'h3': 'text-xl font-semibold mb-3 mt-5', 'h4': 'text-lg font-semibold mb-2 mt-4',
            'table': 'uk-table uk-table-striped uk-table-hover uk-table-divider uk-table-middle my-6'}
    
    # Register custom tokens with renderer context manager
    with ContentRenderer(YoutubeEmbed, InlineCodeAttr, Strikethrough, FootnoteRef, Superscript, Subscript, img_dir=img_dir, footnotes=footnotes, current_path=current_path) as renderer:
        doc = mst.Document(content)
        html = renderer.render(doc)
    
    # Post-process: replace tab placeholders with rendered tabs
    if tab_data_store:
        html = postprocess_tabs(html, tab_data_store, img_dir, current_path, footnotes)
    
    return Div(Link(rel="stylesheet", href="/static/sidenote.css"), NotStr(apply_classes(html, class_map_mods=mods)), cls="w-full")

# App configuration
def get_root_folder(): return get_config().get_root_folder()
def get_blog_title(): return get_config().get_blog_title()
def get_favicon_href():
    root_icon = get_root_folder() / "static" / "icon.png"
    if root_icon.exists():
        return "/static/icon.png"
    return "/static/favicon.png"

hdrs = (
    *Theme.slate.headers(highlightjs=True),
    Link(rel="icon", href=get_favicon_href()),
    Script(src="https://unpkg.com/hyperscript.org@0.9.12"),
    Script(src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs", type="module"),
    Style(
        """
        .chat-row-block {
            padding: 14px 0;
        }
        .chat-panel {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 20px;
        }
        """
    ),
    Script("""
        // Tab switching functionality (global scope)
        function switchTab(tabsId, index) {
            console.log('switchTab called:', tabsId, index);
            const container = document.querySelector('.tabs-container[data-tabs-id="' + tabsId + '"]');
            console.log('container:', container);
            if (!container) return;
            
            // Update buttons
            const buttons = container.querySelectorAll('.tab-button');
            buttons.forEach(function(btn, i) {
                if (i === index) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            
            // Update panels
            const panels = container.querySelectorAll('.tab-panel');
            panels.forEach(function(panel, i) {
                if (i === index) {
                    panel.classList.add('active');
                    panel.style.position = 'relative';
                    panel.style.visibility = 'visible';
                    panel.style.opacity = '1';
                    panel.style.pointerEvents = 'auto';
                } else {
                    panel.classList.remove('active');
                    panel.style.position = 'absolute';
                    panel.style.visibility = 'hidden';
                    panel.style.opacity = '0';
                    panel.style.pointerEvents = 'none';
                }
            });
        }
        window.switchTab = switchTab;
        
        // Set tab container heights based on tallest panel
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                document.querySelectorAll('.tabs-container').forEach(container => {
                    const panels = container.querySelectorAll('.tab-panel');
                    let maxHeight = 0;
                    
                    // Temporarily show all panels to measure their heights
                    panels.forEach(panel => {
                        const wasActive = panel.classList.contains('active');
                        panel.style.position = 'relative';
                        panel.style.visibility = 'visible';
                        panel.style.opacity = '1';
                        panel.style.pointerEvents = 'auto';
                        
                        const height = panel.offsetHeight;
                        if (height > maxHeight) maxHeight = height;
                        
                        if (!wasActive) {
                            panel.style.position = 'absolute';
                            panel.style.visibility = 'hidden';
                            panel.style.opacity = '0';
                            panel.style.pointerEvents = 'none';
                        }
                    });
                    
                    // Set the content area to the max height
                    const tabsContent = container.querySelector('.tabs-content');
                    if (tabsContent && maxHeight > 0) {
                        tabsContent.style.minHeight = maxHeight + 'px';
                    }
                });
            }, 100);
        });
    """),
    Script(src="/static/scripts.js", type='module'),
    Link(rel="stylesheet", href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"),
    Script(src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"),
    Script(src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"),
    Script("""
        function replaceEscapedDollarPlaceholders(root) {
            const placeholder = '@@BLOGGY_DOLLAR@@';
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            const nodes = [];
            let node;
            while ((node = walker.nextNode())) {
                if (node.nodeValue && node.nodeValue.includes(placeholder)) {
                    nodes.push(node);
                }
            }
            nodes.forEach((textNode) => {
                textNode.nodeValue = textNode.nodeValue.split(placeholder).join('$');
            });
        }

        document.addEventListener('DOMContentLoaded', function() {
            renderMathInElement(document.body, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false
            });
            replaceEscapedDollarPlaceholders(document.body);
        });
        
        // Re-render math after HTMX swaps
        document.body.addEventListener('htmx:afterSwap', function(event) {
            renderMathInElement(document.body, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false
            });
            replaceEscapedDollarPlaceholders(event.target || document.body);
        });
    """),
    Link(rel="preconnect", href="https://fonts.googleapis.com"), 
    Link(rel="preconnect", href="https://fonts.gstatic.com", crossorigin=""),
    Link(rel="stylesheet", href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono&display=swap"),
    Style("body { font-family: 'IBM Plex Sans', sans-serif; } code, pre { font-family: 'IBM Plex Mono', monospace; }"),
    Style(".folder-chevron { display: inline-block; width: 0.45rem; height: 0.45rem; border-right: 2px solid rgb(148 163 184); border-bottom: 2px solid rgb(148 163 184); transform: rotate(-45deg); transition: transform 0.2s; } details.is-open > summary .folder-chevron { transform: rotate(45deg); } details { border: none !important; box-shadow: none !important; }"),
    Style("h1, h2, h3, h4, h5, h6 { scroll-margin-top: 7rem; }"),  # Offset for sticky navbar
    Style("""
        /* Ultra thin scrollbar styles */
        * { scrollbar-width: thin; scrollbar-color: rgb(203 213 225) transparent; }
        *::-webkit-scrollbar { width: 3px; height: 3px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background-color: rgb(203 213 225); border-radius: 2px; }
        *::-webkit-scrollbar-thumb:hover { background-color: rgb(148 163 184); }
        .dark *::-webkit-scrollbar-thumb { background-color: rgb(71 85 105); }
        .dark *::-webkit-scrollbar-thumb:hover { background-color: rgb(100 116 139); }
        .dark * { scrollbar-color: rgb(71 85 105) transparent; }

        /* Sidebar active link highlight */
        .sidebar-highlight {
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35);
            transition: box-shadow 10s ease, background-color 10s ease;
        }
        .sidebar-highlight.fade-out {
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0);
        }

        /* PDF focus mode */
        body.pdf-focus {
            overflow: hidden;
        }
        body.pdf-focus #site-navbar,
        body.pdf-focus #site-footer,
        body.pdf-focus #posts-sidebar,
        body.pdf-focus #toc-sidebar,
        body.pdf-focus #mobile-posts-panel,
        body.pdf-focus #mobile-toc-panel {
            display: none !important;
        }
        body.pdf-focus #content-with-sidebars {
            max-width: none !important;
            width: 100vw !important;
            padding: 0 !important;
            margin: 0 !important;
            gap: 0 !important;
        }
        body.pdf-focus #main-content {
            padding: 1rem !important;
        }
        body.pdf-focus .pdf-viewer {
            height: calc(100vh - 6rem) !important;
        }

        .layout-fluid {
            --layout-breakpoint: 1280px;
            --layout-blend: 240px;
            max-width: calc(
                100% - (100% - var(--layout-max-width))
                * clamp(0, (100vw - var(--layout-breakpoint)) / var(--layout-blend), 1)
            ) !important;
        }
        
        /* Tabs styles */
        .tabs-container { 
            margin: 2rem 0; 
            border: 1px solid rgb(226 232 240); 
            border-radius: 0.5rem; 
            overflow: visible; 
            box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
        }
        .dark .tabs-container { 
            border-color: rgb(51 65 85);
            box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.3);
        }
        
        .tabs-header { 
            display: flex; 
            background: rgb(248 250 252); 
            border-bottom: 1px solid rgb(226 232 240);
            gap: 0;
        }
        .dark .tabs-header { 
            background: rgb(15 23 42); 
            border-bottom-color: rgb(51 65 85);
        }
        
        .tab-button { 
            flex: 1; 
            padding: 0.875rem 1.5rem; 
            background: transparent; 
            border: none;
            border-bottom: 3px solid transparent;
            cursor: pointer; 
            font-weight: 500; 
            font-size: 0.9375rem;
            color: rgb(100 116 139); 
            transition: all 0.15s ease;
            position: relative;
            margin-bottom: -1px;
        }
        .dark .tab-button { color: rgb(148 163 184); }
        
        .tab-button:hover:not(.active) { 
            background: rgb(241 245 249); 
            color: rgb(51 65 85);
        }
        .dark .tab-button:hover:not(.active) { 
            background: rgb(30 41 59); 
            color: rgb(226 232 240);
        }
        
        .tab-button.active { 
            color: rgb(15 23 42); 
            border-bottom-color: rgb(15 23 42); 
            background: white;
            font-weight: 600;
        }
        .dark .tab-button.active { 
            color: rgb(248 250 252); 
            border-bottom-color: rgb(248 250 252); 
            background: rgb(2 6 23);
        }
        
        .tabs-content { 
            background: white;
            position: relative;
            overflow: visible;
        }
        .dark .tabs-content { 
            background: rgb(2 6 23);
        }
        
        .tab-panel { 
            padding: 1rem 1rem;
            animation: fadeIn 0.2s ease-in;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            overflow: visible;
        }
        .tab-panel.active { 
            position: relative;
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        /* Remove extra margins from first/last elements in tabs */
        .tab-panel > *:first-child { margin-top: 0 !important; }
        .tab-panel > *:last-child { margin-bottom: 0 !important; }
        
        /* Ensure code blocks in tabs look good */
        .tab-panel pre { 
            border-radius: 0.375rem;
            font-size: 0.875rem;
        }
        .tab-panel code { 
            font-family: 'IBM Plex Mono', monospace;
        }
    """),
    # Custom table stripe styling for punchier colors
    Style("""
        .uk-table-striped tbody tr:nth-of-type(odd) {
            background-color: rgba(71, 85, 105, 0.08);
        }
        .dark .uk-table-striped tbody tr:nth-of-type(odd) {
            background-color: rgba(148, 163, 184, 0.12);
        }
        .uk-table-striped tbody tr:hover {
            background-color: rgba(59, 130, 246, 0.1);
        }
        .dark .uk-table-striped tbody tr:hover {
            background-color: rgba(59, 130, 246, 0.15);
        }
        .uk-table thead {
            border-bottom: 2px solid rgba(71, 85, 105, 0.3);
        }
        .dark .uk-table thead {
            border-bottom: 2px solid rgba(148, 163, 184, 0.4);
        }
        .uk-table thead th {
            font-weight: 600;
            font-size: 1.25rem;
            color: rgb(51, 65, 85);
        }
        .dark .uk-table thead th {
            color: rgb(226, 232, 240);
        }
        .uk-table th:not(:last-child),
        .uk-table td:not(:last-child) {
            border-right: 1px solid rgba(71, 85, 105, 0.15);
        }
        .dark .uk-table th:not(:last-child),
        .dark .uk-table td:not(:last-child) {
            border-right: 1px solid rgba(148, 163, 184, 0.2);
        }
    """),
    # Script("if(!localStorage.__FRANKEN__) localStorage.__FRANKEN__ = JSON.stringify({mode: 'light'})"))
    Script("""
        (function () {
            let franken = localStorage.__FRANKEN__
                ? JSON.parse(localStorage.__FRANKEN__)
                : { mode: 'light' };

            if (franken.mode === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }

            localStorage.__FRANKEN__ = JSON.stringify(franken);
        })();
        """)
    )


# Session/cookie-based authentication using Beforeware (conditionally enabled)
_config = get_config()
_auth_creds = _config.get_auth()
_google_oauth_cfg = _config.get_google_oauth()
_auth_required = _config.get_auth_required()

@dataclass
class RbacConfigRow:
    key: str
    value: str

_rbac_db = None
_rbac_tbl = None

def _get_rbac_db():
    global _rbac_db, _rbac_tbl
    if _rbac_db is None:
        root = get_config().get_root_folder()
        db_path = root / ".bloggy-rbac.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        _rbac_db = Database(f"sqlite:///{db_path}")
        _rbac_tbl = _rbac_db.create(RbacConfigRow, pk="key", name="rbac_config")
    return _rbac_db, _rbac_tbl

def _normalize_rbac_cfg(cfg):
    cfg = cfg or {}
    if not isinstance(cfg, dict):
        cfg = {}
    default_roles = _config._coerce_list(cfg.get("default_roles", []))
    user_roles = cfg.get("user_roles", {})
    if not isinstance(user_roles, dict):
        user_roles = {}
    role_users = cfg.get("role_users", {})
    if not isinstance(role_users, dict):
        role_users = {}
    rules = cfg.get("rules", [])
    if not isinstance(rules, list):
        rules = []
    cleaned_rules = []
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        pattern = rule.get("pattern")
        roles = _config._coerce_list(rule.get("roles", []))
        if pattern and roles:
            cleaned_rules.append({"pattern": str(pattern), "roles": roles})
    return {
        "enabled": bool(cfg.get("enabled", False)),
        "default_roles": default_roles,
        "user_roles": user_roles,
        "role_users": role_users,
        "rules": cleaned_rules,
    }

def _rbac_db_load():
    try:
        _, tbl = _get_rbac_db()
    except Exception as exc:
        logger.warning(f"RBAC DB unavailable: {exc}")
        return None
    rows = tbl()
    if not rows:
        return None
    data = {}
    for row in rows:
        try:
            data[row.key] = json.loads(row.value)
        except Exception:
            data[row.key] = row.value
    return _normalize_rbac_cfg(data)

def _rbac_db_write(cfg):
    try:
        _, tbl = _get_rbac_db()
    except Exception as exc:
        logger.warning(f"RBAC DB unavailable: {exc}")
        return
    cfg = _normalize_rbac_cfg(cfg)
    existing = {row.key for row in tbl()}
    for key, value in cfg.items():
        payload = json.dumps(value, sort_keys=True)
        if key in existing:
            tbl.update(key=key, value=payload)
        else:
            tbl.insert(RbacConfigRow(key=key, value=payload))
    for key in existing - set(cfg.keys()):
        try:
            tbl.delete(key)
        except Exception:
            continue

def _load_rbac_cfg_from_store():
    cfg = _rbac_db_load()
    if cfg:
        return cfg
    cfg = _normalize_rbac_cfg(_config.get_rbac())
    if cfg.get("enabled") or cfg.get("rules") or cfg.get("role_users") or cfg.get("user_roles") or cfg.get("default_roles"):
        _rbac_db_write(cfg)
    return cfg

def _set_rbac_cfg(cfg):
    global _rbac_cfg, _rbac_rules
    _rbac_cfg = _normalize_rbac_cfg(cfg)
    if _rbac_cfg.get("enabled") and not _auth_enabled:
        logger.warning("RBAC configured without any auth provider; RBAC disabled.")
        _rbac_cfg["enabled"] = False
    _rbac_rules = []
    if _rbac_cfg.get("enabled"):
        for rule in _rbac_cfg.get("rules", []):
            pattern = rule.get("pattern")
            roles = rule.get("roles")
            if not pattern or not roles:
                continue
            try:
                compiled = re.compile(pattern)
            except re.error as exc:
                logger.warning(f"Invalid RBAC pattern {pattern!r}: {exc}")
                continue
            roles_list = _config._coerce_list(roles)
            if not roles_list:
                continue
            _rbac_rules.append((compiled, set(roles_list)))

def _resolve_bloggy_config_path():
    root_env = os.getenv("BLOGGY_ROOT")
    if root_env:
        root_path = Path(root_env) / ".bloggy"
        if root_path.exists():
            return root_path
    cwd_path = Path.cwd() / ".bloggy"
    if cwd_path.exists():
        return cwd_path
    return get_config().get_root_folder() / ".bloggy"

def _toml_string(value: str) -> str:
    return json.dumps(str(value))

def _toml_list(items):
    return "[" + ", ".join(_toml_string(item) for item in items) + "]"

def _toml_inline_table(mapping):
    if not mapping:
        return "{}"
    parts = []
    for key in sorted(mapping.keys()):
        parts.append(f"{_toml_string(key)} = {_toml_list(_config._coerce_list(mapping[key]))}")
    return "{ " + ", ".join(parts) + " }"

def _render_rbac_toml(cfg):
    cfg = _normalize_rbac_cfg(cfg)
    lines = [
        "[rbac]",
        f"enabled = {'true' if cfg.get('enabled') else 'false'}",
        f"default_roles = {_toml_list(cfg.get('default_roles', []))}",
        f"user_roles = {_toml_inline_table(cfg.get('user_roles', {}))}",
        f"role_users = {_toml_inline_table(cfg.get('role_users', {}))}",
        "",
    ]
    for rule in cfg.get("rules", []):
        lines.extend([
            "[[rbac.rules]]",
            f"pattern = {_toml_string(rule.get('pattern'))}",
            f"roles = {_toml_list(rule.get('roles', []))}",
            "",
        ])
    return "\n".join(lines).rstrip() + "\n"

def _write_rbac_to_bloggy(cfg):
    cfg = _normalize_rbac_cfg(cfg)
    path = _resolve_bloggy_config_path()
    try:
        text = path.read_text(encoding="utf-8") if path.exists() else ""
    except Exception:
        text = ""
    new_block = _render_rbac_toml(cfg)
    if re.search(r"(?m)^\[rbac\]", text):
        pattern = r"(?ms)^\[rbac\]\n.*?(?=^\[[^\[]|\Z)"
        text = re.sub(pattern, new_block + "\n", text)
    else:
        if text and not text.endswith("\n"):
            text += "\n"
        text += "\n" + new_block
    path.write_text(text, encoding="utf-8")

_google_oauth = None
_google_oauth_enabled = False
if _google_oauth_cfg.get("client_id") and _google_oauth_cfg.get("client_secret"):
    try:
        from authlib.integrations.starlette_client import OAuth
        _google_oauth = OAuth()
        _google_oauth.register(
            name="google",
            client_id=_google_oauth_cfg["client_id"],
            client_secret=_google_oauth_cfg["client_secret"],
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            userinfo_endpoint="https://openidconnect.googleapis.com/v1/userinfo",
            client_kwargs={"scope": "openid email profile"},
        )
        _google_oauth_enabled = True
    except Exception as exc:
        logger.warning(f"Google OAuth disabled: {exc}")

_local_auth_enabled = bool(_auth_creds and _auth_creds[0] and _auth_creds[1])
_auth_enabled = _local_auth_enabled or _google_oauth_enabled
if _auth_required is None:
    _auth_required = _auth_enabled

_rbac_cfg = _load_rbac_cfg_from_store()
_set_rbac_cfg(_rbac_cfg)

def _normalize_auth(auth):
    if not auth:
        return None
    if isinstance(auth, dict):
        return auth
    return {"provider": "local", "username": str(auth)}

def _get_auth_from_request(request):
    if not request:
        return None
    auth = None
    try:
        auth = request.scope.get("auth")
    except Exception:
        auth = None
    if not auth:
        try:
            auth = request.session.get("auth")
        except Exception:
            auth = None
    auth = _normalize_auth(auth) if auth else None
    if auth and _rbac_rules:
        auth["roles"] = auth.get("roles") or _resolve_roles(auth)
    return auth

def _get_roles_from_request(request):
    auth = _get_auth_from_request(request)
    return auth.get("roles") if auth else []

def _get_roles_from_auth(auth):
    auth = _normalize_auth(auth) if auth else None
    if auth and _rbac_rules:
        auth["roles"] = auth.get("roles") or _resolve_roles(auth)
    return auth.get("roles") if auth else []

def _resolve_roles(auth):
    auth = _normalize_auth(auth) or {}
    username = auth.get("username")
    email = auth.get("email")
    user_roles = _rbac_cfg.get("user_roles", {})
    roles = []
    if isinstance(user_roles, dict):
        if email and email in user_roles:
            roles.extend(_config._coerce_list(user_roles.get(email)))
        if username and username in user_roles:
            roles.extend(_config._coerce_list(user_roles.get(username)))
    role_users = _rbac_cfg.get("role_users", {})
    if isinstance(role_users, dict):
        for role, users in role_users.items():
            users_list = _config._coerce_list(users)
            if email and email in users_list:
                roles.append(role)
            if username and username in users_list:
                roles.append(role)
    if not roles:
        roles = _rbac_cfg.get("default_roles", []) or _google_oauth_cfg.get("default_roles", [])
    roles = [r for r in roles if r]
    if roles:
        return list(dict.fromkeys(roles))
    return []

def _path_requires_roles(path):
    for pattern, _roles in _rbac_rules:
        if pattern.search(path):
            return True
    return False

def _is_allowed(path, roles):
    if not _rbac_rules:
        return True
    roles_set = set(roles or [])
    matched_any = False
    allowed = False
    for pattern, allowed_roles in _rbac_rules:
        if pattern.search(path):
            matched_any = True
            if roles_set & allowed_roles:
                allowed = True
    return allowed if matched_any else True

def user_auth_before(req, sess):
    logger.info(f'Authenticating request for {req.url.path}')
    auth = sess.get('auth', None)
    if not auth:
        if _auth_required or _path_requires_roles(req.url.path):
            sess['next'] = req.url.path
            from starlette.responses import RedirectResponse
            return RedirectResponse('/login', status_code=303)
        req.scope['auth'] = None
        return None
    auth = _normalize_auth(auth)
    if _rbac_rules:
        auth["roles"] = auth.get("roles") or _resolve_roles(auth)
        if not _is_allowed(req.url.path, auth["roles"]):
            from starlette.responses import Response
            return Response("Forbidden", status_code=403)
    req.scope['auth'] = auth
    return None

logger.info(f"Authentication enabled: {_auth_enabled}")
logger.info(f"RBAC enabled: {_rbac_cfg.get('enabled')}")

if _auth_enabled or (_rbac_cfg.get("enabled") and _rbac_rules):
    beforeware = Beforeware(
        user_auth_before,
        skip=[
            r'^/login$',
            r'^/login/google$',
            r'^/auth/google/callback$',
            r'^/_sidebar/.*',
            r'^/static/.*',
            r'^/chat/.*',
            r'.*\.css',
            r'.*\.js',
        ]
    )
else:
    beforeware = None

logger.info(f'{beforeware=}')

app = (
    FastHTML(hdrs=hdrs, before=beforeware, exts="ws")
    if beforeware
    else FastHTML(hdrs=hdrs, exts="ws")
)

def _load_pylogue_routes():
    try:
        from pylogue.core import register_routes, EchoResponder
        return register_routes, EchoResponder
    except Exception:
        pylogue_path = Path("/Users/yeshwanth/Code/Personal/pylogue/src/pylogue/core.py")
        if not pylogue_path.exists():
            logger.warning(f"Pylogue not found at {pylogue_path}")
            return None, None
        try:
            import importlib.util

            spec = importlib.util.spec_from_file_location("pylogue.core", pylogue_path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                return module.register_routes, module.EchoResponder
        except Exception as load_exc:
            logger.warning(f"Failed to load pylogue from {pylogue_path}: {load_exc}")
            return None, None
    return None, None

def _favicon_icon_path():
    root_icon = get_root_folder() / "static" / "icon.png"
    if root_icon.exists():
        return root_icon
    package_favicon = Path(__file__).parent / "static" / "favicon.png"
    if package_favicon.exists():
        return package_favicon
    return None

@app.route("/static/icon.png")
async def favicon_icon():
    path = _favicon_icon_path()
    if path and path.exists():
        return FileResponse(path)
    return Response(status_code=404)

static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

rt = app.route


from starlette.requests import Request
from starlette.responses import RedirectResponse, FileResponse, Response

_pylogue_register, _PylogueResponder = _load_pylogue_routes()
if _pylogue_register:
    try:
        from .agent import PydanticAIStreamingResponder
        _chat_responder_factory = PydanticAIStreamingResponder
        logger.info("Using PydanticAIStreamingResponder for /chat")
    except Exception as exc:
        logger.warning(f"Falling back to Pylogue responder: {exc}")
        _chat_responder_factory = _PylogueResponder
    _pylogue_register(
        app,
        responder_factory=_chat_responder_factory,
        title=f"AI Chat for {get_config().get_blog_title().capitalize()} Docs",
        subtitle="Ask a question about this blog",
        tag_line="« Blog",
        tag_line_href="/",
        base_path="chat",
        inject_headers=True
    )

    @rt("/chat")
    def chat_redirect():
        return RedirectResponse("/chat/", status_code=307)

@rt("/login", methods=["GET", "POST"])
async def login(request: Request):
    config = get_config()
    user, pwd = config.get_auth()
    logger.info(f"Login attempt for user: {user}")
    error = request.query_params.get("error")
    if request.method == "POST":
        if not _local_auth_enabled:
            return RedirectResponse("/login?error=Local+login+disabled", status_code=303)
        form = await request.form()
        username = form.get("username", "")
        password = form.get("password", "")
        if username == user and password == pwd:
            roles = _resolve_roles({"provider": "local", "username": username})
            request.session["auth"] = {
                "provider": "local",
                "username": username,
                "roles": roles,
            }
            next_url = request.session.pop("next", "/")
            return RedirectResponse(next_url, status_code=303)
        else:
            error = "Invalid username or password."

    return Div(
        H2("Login", cls="uk-h2"),
        A(
            Span("Continue with Google", cls="text-sm font-semibold"),
            href="/login/google",
            cls="inline-flex items-center justify-center px-4 py-2 my-6 rounded-md border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-900 hover:border-slate-900 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-900/80 transition-colors max-w-sm mx-auto"
        ) if _google_oauth_enabled else None,
        Form(
            Div(
                Input(type="text", name="username", required=True, id="username", cls="uk-input input input-bordered w-full", placeholder="Username"),
                cls="my-4"),
            Div(
                Input(type="password", name="password", required=True, id="password", cls="uk-input input input-bordered w-full", placeholder="Password"),
                cls="my-4"),
            Button("Login", type="submit", cls="uk-btn btn btn-primary w-full"),
            enctype="multipart/form-data", method="post", cls="max-w-sm mx-auto") if _local_auth_enabled else None,
        P(error, cls="text-red-500 mt-4") if error else None,
        cls="prose mx-auto mt-24 text-center")

@rt("/login/google")
async def login_google(request: Request):
    if not _google_oauth_enabled:
        return Response(status_code=404)
    next_url = request.session.get("next") or request.query_params.get("next") or "/"
    request.session["next"] = next_url
    redirect_uri = str(request.base_url).rstrip("/") + "/auth/google/callback"
    print(f"DEBUG: redirect_uri = {redirect_uri}")
    return await _google_oauth.google.authorize_redirect(request, redirect_uri)

@rt("/auth/google/callback")
async def google_auth_callback(request: Request):
    if not _google_oauth_enabled:
        return Response(status_code=404)
    try:
        token = await _google_oauth.google.authorize_access_token(request)
        userinfo = token.get("userinfo")
        if not userinfo:
            try:
                userinfo = await _google_oauth.google.parse_id_token(request, token)
            except Exception as exc:
                logger.warning(f"Google OAuth id_token missing or invalid: {exc}")
                try:
                    userinfo = await _google_oauth.google.userinfo(token=token)
                except Exception as userinfo_exc:
                    logger.warning(f"Google OAuth userinfo fetch failed: {userinfo_exc}")
                    raise
    except Exception as exc:
        logger.warning(f"Google OAuth failed: {exc}")
        return RedirectResponse("/login?error=Google+authentication+failed", status_code=303)

    email = userinfo.get("email") if isinstance(userinfo, dict) else None
    name = userinfo.get("name") if isinstance(userinfo, dict) else None
    picture = userinfo.get("picture") if isinstance(userinfo, dict) else None

    allowed_domains = _google_oauth_cfg.get("allowed_domains", [])
    if allowed_domains:
        if not email:
            return RedirectResponse("/login?error=Google+account+not+allowed", status_code=303)
        domain = email.split("@")[-1]
        if domain not in allowed_domains:
            return RedirectResponse("/login?error=Google+account+not+allowed", status_code=303)

    allowed_emails = _google_oauth_cfg.get("allowed_emails", [])
    if allowed_emails:
        if not email or email not in allowed_emails:
            return RedirectResponse("/login?error=Google+account+not+allowed", status_code=303)

    auth = {
        "provider": "google",
        "email": email,
        "name": name,
        "picture": picture,
    }
    auth["roles"] = _resolve_roles(auth)
    request.session["auth"] = auth
    next_url = request.session.pop("next", "/")
    return RedirectResponse(next_url, status_code=303)

@rt("/logout")
async def logout(request: Request):
    request.session.pop("auth", None)
    request.session.pop("next", None)
    return RedirectResponse("/login", status_code=303)

def _parse_roles_text(text: str):
    parts = re.split(r"[,\n]+", text or "")
    return [part.strip() for part in parts if part.strip()]

@rt("/admin/impersonate", methods=["GET", "POST"])
async def admin_impersonate(htmx, request: Request):
    auth = _get_auth_from_request(request)
    roles = auth.get("roles") if auth else []
    impersonator = auth.get("impersonator") if auth else None
    impersonator_roles = impersonator.get("roles") if impersonator else []
    if (not roles or "full" not in roles) and (not impersonator_roles or "full" not in impersonator_roles):
        return Response("Forbidden", status_code=403)

    error = None
    success = None
    impersonator = request.session.get("impersonator")
    current_auth = request.session.get("auth")

    if request.method == "POST":
        form = await request.form()
        action = form.get("action", "start")
        if action == "stop":
            if impersonator:
                request.session["auth"] = impersonator
                request.session.pop("impersonator", None)
                success = "Impersonation stopped."
            else:
                error = "Not currently impersonating."
        else:
            email = (form.get("email") or "").strip()
            if not email:
                error = "Email is required."
            else:
                if not impersonator:
                    request.session["impersonator"] = current_auth
                imp_auth = {
                    "provider": "impersonate",
                    "email": email,
                    "username": email,
                }
                if request.session.get("impersonator"):
                    imp_auth["impersonator"] = request.session.get("impersonator")
                imp_auth["roles"] = _resolve_roles(imp_auth)
                request.session["auth"] = imp_auth
                success = f"Now impersonating {email}."

    impersonating_email = None
    if impersonator and current_auth and current_auth.get("provider") == "impersonate":
        impersonating_email = current_auth.get("email") or current_auth.get("username")

    content = Div(
        H1("Impersonate User", cls="text-3xl font-bold"),
        P("Switch the current session to a different user for RBAC testing.", cls="text-slate-600 dark:text-slate-400"),
        Div(
            P(error, cls="text-red-600") if error else None,
            P(success, cls="text-emerald-600") if success else None,
            cls="mt-4"
        ),
        Div(
            P(f"Currently impersonating: {impersonating_email}", cls="text-sm text-amber-600 dark:text-amber-400") if impersonating_email else None,
            cls="mt-2"
        ),
        Form(
            Div(
                Label("User email", cls="block text-sm font-medium mb-2"),
                Input(type="email", name="email", placeholder="user@domain.com", cls="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60"),
                cls="mt-6"
            ),
            Div(
                Button("Start Impersonation", type="submit", name="action", value="start", cls="mt-6 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"),
                Button("Stop Impersonation", type="submit", name="action", value="stop", cls="mt-6 ml-3 px-4 py-2 rounded-md bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"),
                cls="flex items-center"
            ),
            method="post",
            cls="mt-4"
        ),
        cls="max-w-xl mx-auto py-10 px-6"
    )
    return layout(content, htmx=htmx, title="Impersonate", show_sidebar=False, auth=auth, htmx_nav=False)

@rt("/admin/rbac", methods=["GET", "POST"])
async def admin_rbac(htmx, request: Request):
    auth = _get_auth_from_request(request)
    roles = auth.get("roles") if auth else []
    if not roles or "full" not in roles:
        return Response("Forbidden", status_code=403)

    error = None
    success = None
    cfg = _rbac_cfg

    if request.method == "POST":
        form = await request.form()
        enabled = form.get("enabled") == "on"
        default_roles = _parse_roles_text(form.get("default_roles", ""))
        role_users_raw = form.get("role_users_json", "{}")
        user_roles_raw = form.get("user_roles_json", "{}")
        rules_raw = form.get("rules_json", "[]")
        try:
            role_users = json.loads(role_users_raw) if role_users_raw.strip() else {}
            user_roles = json.loads(user_roles_raw) if user_roles_raw.strip() else {}
            rules = json.loads(rules_raw) if rules_raw.strip() else []
        except Exception as exc:
            error = f"Invalid JSON: {exc}"
        else:
            if not isinstance(role_users, dict):
                error = "Role users JSON must be an object."
            elif not isinstance(user_roles, dict):
                error = "User roles JSON must be an object."
            elif not isinstance(rules, list):
                error = "Rules JSON must be an array."
            else:
                new_cfg = {
                    "enabled": bool(enabled),
                    "default_roles": default_roles,
                    "role_users": role_users,
                    "user_roles": user_roles,
                    "rules": rules,
                }
                try:
                    _rbac_db_write(new_cfg)
                    _write_rbac_to_bloggy(new_cfg)
                    _set_rbac_cfg(new_cfg)
                    _cached_build_post_tree.cache_clear()
                    _cached_posts_sidebar_html.cache_clear()
                    success = "RBAC settings saved."
                    cfg = _rbac_cfg
                except Exception as exc:
                    error = f"Failed to save RBAC settings: {exc}"

    default_roles_text = ", ".join(cfg.get("default_roles", []))
    role_users_text = json.dumps(cfg.get("role_users", {}), indent=2, sort_keys=True)
    user_roles_text = json.dumps(cfg.get("user_roles", {}), indent=2, sort_keys=True)
    rules_text = json.dumps(cfg.get("rules", []), indent=2, sort_keys=True)
    preview_text = _render_rbac_toml(cfg)

    content = Div(
        H1("RBAC Administration", cls="text-3xl font-bold"),
        P("Edits save to SQLite immediately and also update the .bloggy file for transparency.", cls="text-slate-600 dark:text-slate-400"),
        P("Rule patterns are matched against request paths (e.g. /posts/ai/...).", cls="text-slate-500 dark:text-slate-500 text-sm"),
        Div(
            P(error, cls="text-red-600") if error else None,
            P(success, cls="text-emerald-600") if success else None,
            cls="mt-4"
        ),
        Form(
            Div(
                Label(
                    Input(type="checkbox", name="enabled", checked=cfg.get("enabled", False), cls="mr-2"),
                    Span("Enable RBAC"),
                    cls="flex items-center gap-2"
                ),
                cls="mt-6"
            ),
            Div(
                Label("Default roles (comma separated)", cls="block text-sm font-medium mb-2"),
                Input(type="text", name="default_roles", value=default_roles_text, cls="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60"),
                cls="mt-6"
            ),
            Div(
                Label("Role users JSON", cls="block text-sm font-medium mb-2"),
                Textarea(role_users_text, name="role_users_json", rows="6", cls="w-full px-3 py-2 font-mono text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60"),
                cls="mt-6"
            ),
            Div(
                Label("User roles JSON", cls="block text-sm font-medium mb-2"),
                Textarea(user_roles_text, name="user_roles_json", rows="6", cls="w-full px-3 py-2 font-mono text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60"),
                cls="mt-6"
            ),
            Div(
                Label("Rules JSON", cls="block text-sm font-medium mb-2"),
                Textarea(rules_text, name="rules_json", rows="8", cls="w-full px-3 py-2 font-mono text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60"),
                cls="mt-6"
            ),
            Button("Save RBAC", type="submit", cls="mt-6 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"),
            method="post",
            cls="mt-4"
        ),
        Div(
            H2("Preview (.bloggy)", cls="text-xl font-semibold mt-10"),
            Pre(preview_text, cls="mt-3 p-4 rounded-md bg-slate-100 dark:bg-slate-900/60 text-xs overflow-x-auto"),
        ),
        cls="max-w-3xl mx-auto py-10 px-6"
    )
    return layout(content, htmx=htmx, title="RBAC Admin", show_sidebar=False, auth=auth, htmx_nav=False)

# Progressive sidebar loading: lazy posts sidebar endpoint
@rt("/_sidebar/posts")
def posts_sidebar_lazy(request: Request = None):
    roles = _get_roles_from_request(request)
    html = _cached_posts_sidebar_html(_posts_sidebar_fingerprint(), tuple(roles or []))
    return Aside(
        NotStr(html),
        cls="hidden xl:block w-72 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]",
        id="posts-sidebar"
    )

# Route to serve raw markdown for LLM-friendly access
@rt("/posts/{path:path}.md")
def serve_post_markdown(path: str):
    from starlette.responses import FileResponse
    file_path = get_root_folder() / f'{path}.md'
    if file_path.exists():
        return FileResponse(file_path, media_type="text/markdown; charset=utf-8")
    return Response(status_code=404)

@rt("/search/gather")
def gather_search_results(htmx, q: str = "", request: Request = None):
    import html
    matches, regex_error = _find_search_matches(q, limit=200)
    roles = _get_roles_from_request(request)
    if roles is not None:
        root = get_root_folder()
        filtered = []
        for item in matches:
            slug = item.relative_to(root).with_suffix("")
            if _is_allowed(f"/posts/{slug}", roles or []):
                filtered.append(item)
        matches = filtered
    if not matches:
        content = Div(
            H1("Search Results", cls="text-3xl font-bold mb-6"),
            P("No matching posts found.", cls="text-slate-600 dark:text-slate-400"),
            P(regex_error, cls="text-amber-600 dark:text-amber-400 text-sm") if regex_error else None
        )
        return layout(content, htmx=htmx, title="Search Results", show_sidebar=True, auth=request.scope.get("auth") if request else None)

    root = get_root_folder()
    sections = []
    copy_parts = [f"# Search Results: {q.strip() or 'All'}\n"]
    if regex_error:
        copy_parts.append(f"> {regex_error}\n")
    for idx, item in enumerate(matches):
        rel = item.relative_to(root).as_posix()
        if item.suffix == ".pdf":
            slug = item.relative_to(root).with_suffix("").as_posix()
            pdf_href = f"/posts/{slug}.pdf"
            sections.extend([
                H2(rel, cls="text-xl font-semibold mb-2"),
                P(
                    "PDF file: ",
                    A(rel, href=pdf_href, cls="text-blue-600 hover:underline"),
                    cls="text-sm text-slate-600 dark:text-slate-300"
                ),
                Hr(cls="my-6 border-slate-200 dark:border-slate-800") if idx < len(matches) - 1 else None
            ])
            copy_parts.append(f"\n---\n\n## {rel}\n\n[PDF file]({pdf_href})\n")
            continue
        try:
            raw_md = item.read_text(encoding="utf-8")
        except Exception:
            raw_md = ""
        sections.extend([
            H2(rel, cls="text-xl font-semibold mb-2"),
            Pre(html.escape(raw_md), cls="text-xs font-mono whitespace-pre-wrap text-slate-700 dark:text-slate-300"),
            Hr(cls="my-6 border-slate-200 dark:border-slate-800") if idx < len(matches) - 1 else None
        ])
        copy_parts.append(f"\n---\n\n## {rel}\n\n{raw_md}\n")

    copy_text = "".join(copy_parts)
    content = Div(
        H1(f"Search Results: {q.strip() or 'All'}", cls="text-3xl font-bold mb-6"),
        P(regex_error, cls="text-amber-600 dark:text-amber-400 text-sm mb-4") if regex_error else None,
        Button(
            UkIcon("copy", cls="w-5 h-5"),
            Span("Copy all results", cls="text-sm font-semibold"),
            type="button",
            onclick="(function(){const el=document.getElementById('gather-clipboard');const toast=document.getElementById('gather-toast');if(!el){return;}el.focus();el.select();const text=el.value;const done=()=>{if(!toast){return;}toast.classList.remove('opacity-0');toast.classList.add('opacity-100');setTimeout(()=>{toast.classList.remove('opacity-100');toast.classList.add('opacity-0');},1400);};if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(done).catch(()=>{document.execCommand('copy');done();});}else{document.execCommand('copy');done();}})()",
            cls="inline-flex items-center gap-2 px-3 py-2 mb-6 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
        ),
        Div(
            "Copied!",
            id="gather-toast",
            cls="fixed top-6 right-6 bg-slate-900 text-white text-sm px-4 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300"
        ),
        Textarea(
            copy_text,
            id="gather-clipboard",
            cls="absolute left-[-9999px] top-0 opacity-0 pointer-events-none"
        ),
        *sections
    )
    return layout(content, htmx=htmx, title="Search Results", show_sidebar=True, auth=request.scope.get("auth") if request else None)

# Route to serve static files (images, SVGs, etc.) from blog posts
@rt("/posts/{path:path}.{ext:static}")
def serve_post_static(path: str, ext: str):
    from starlette.responses import FileResponse
    file_path = get_root_folder() / f'{path}.{ext}'
    if file_path.exists():
        return FileResponse(file_path)
    return Response(status_code=404)

def theme_toggle():
    theme_script = """on load set franken to (localStorage's __FRANKEN__ or '{}') as Object
                if franken's mode is 'dark' then add .dark to <html/> end
                on click toggle .dark on <html/>
                set franken to (localStorage's __FRANKEN__ or '{}') as Object
                if the first <html/> matches .dark set franken's mode to 'dark' else set franken's mode to 'light' end
                set localStorage's __FRANKEN__ to franken as JSON"""
    return Button(UkIcon("moon", cls="dark:hidden"), UkIcon("sun", cls="hidden dark:block"), 
                  _=theme_script, cls="p-1 hover:scale-110 shadow-none", type="button")

def navbar(show_mobile_menus=False, htmx_nav=True):
    """Navbar with mobile menu buttons for file tree and TOC"""
    home_link_attrs = {}
    if htmx_nav:
        home_link_attrs = {
            "hx_get": "/",
            "hx_target": "#main-content",
            "hx_push_url": "true",
            "hx_swap": "outerHTML show:window:top settle:0.1s",
        }
    left_section = Div(
        A(
            get_blog_title(),
            href="/",
            **home_link_attrs
        ),
        cls="flex items-center gap-2"
    )
    
    right_section = Div(
        theme_toggle(),
        cls="flex items-center gap-2"
    )
    
    # Add mobile menu buttons if sidebars are present
    if show_mobile_menus:
        mobile_buttons = Div(
            Button(
                UkIcon("menu", cls="w-5 h-5"),
                title="Toggle file tree",
                id="mobile-posts-toggle",
                cls="xl:hidden p-2 hover:bg-slate-800 rounded transition-colors",
                type="button"
            ),
            Button(
                UkIcon("list", cls="w-5 h-5"),
                title="Toggle table of contents",
                id="mobile-toc-toggle",
                cls="xl:hidden p-2 hover:bg-slate-800 rounded transition-colors",
                type="button"
            ),
            cls="flex items-center gap-1"
        )
        right_section = Div(
            mobile_buttons,
            theme_toggle(),
            cls="flex items-center gap-2"
        )
    
    return Div(left_section, right_section,
               cls="flex items-center justify-between bg-slate-900 text-white p-4 my-4 rounded-lg shadow-md dark:bg-slate-800")

def _posts_sidebar_fingerprint():
    root = get_root_folder()
    try:
        return max((p.stat().st_mtime for p in root.rglob("*.md")), default=0)
    except Exception:
        return 0

def _normalize_search_text(text):
    text = (text or "").lower()
    text = text.replace("-", " ").replace("_", " ")
    return " ".join(text.split())

def _parse_search_query(query):
    trimmed = (query or "").strip()
    if len(trimmed) >= 2 and trimmed.startswith("/") and trimmed.endswith("/"):
        pattern = trimmed[1:-1].strip()
        if not pattern:
            return None, ""
        try:
            return re.compile(pattern, re.IGNORECASE), ""
        except re.error:
            return None, "Invalid regex. Showing normal matches instead."
    return None, ""

@lru_cache(maxsize=256)
def _cached_search_matches(fingerprint, query, limit):
    return _find_search_matches_uncached(query, limit)

def _find_search_matches(query, limit=40):
    fingerprint = _posts_sidebar_fingerprint()
    return _cached_search_matches(fingerprint, query, limit)

def _find_search_matches_uncached(query, limit=40):
    trimmed = (query or "").strip()
    if not trimmed:
        return [], ""
    regex, regex_error = _parse_search_query(trimmed)
    query_norm = _normalize_search_text(trimmed) if not regex else ""
    root = get_root_folder()
    index_file = find_index_file()
    results = []
    for item in chain(root.rglob("*.md"), root.rglob("*.pdf")):
        if any(part.startswith('.') for part in item.relative_to(root).parts):
            continue
        if ".bloggy" in item.parts:
            continue
        if index_file and item.resolve() == index_file.resolve():
            continue
        rel = item.relative_to(root).with_suffix("")
        if regex:
            haystack = f"{item.name} {rel.as_posix()}"
            is_match = regex.search(haystack)
        else:
            haystack = _normalize_search_text(f"{item.name} {rel.as_posix()}")
            is_match = query_norm in haystack
        if is_match:
            results.append(item)
            if len(results) >= limit:
                break
    return tuple(results), regex_error

def _render_posts_search_results(query, roles=None):
    trimmed = (query or "").strip()
    if not trimmed:
        return Ul(
            Li("Type to search file names.", cls="text-[0.7rem] text-center text-slate-500 dark:text-slate-400 bg-transparent"),
            cls="posts-search-results-list space-y-1 bg-white/0 dark:bg-slate-950/0"
        )

    matches, regex_error = _find_search_matches(trimmed)
    if roles is not None:
        root = get_root_folder()
        filtered = []
        for item in matches:
            slug = item.relative_to(root).with_suffix("")
            if _is_allowed(f"/posts/{slug}", roles or []):
                filtered.append(item)
        matches = filtered
    if not matches:
        return Ul(
            Li(f'No matches for "{trimmed}".', cls="text-xs text-slate-500 dark:text-slate-400 bg-transparent"),
            Li(regex_error, cls="text-[0.7rem] text-center text-amber-600 dark:text-amber-400") if regex_error else None,
            cls="posts-search-results-list space-y-1 bg-white/0 dark:bg-slate-950/0"
        )

    root = get_root_folder()
    items = []
    gather_href = f"/search/gather?q={quote_plus(trimmed)}"
    items.append(Li(
        A(
            Span(UkIcon("layers", cls="w-4 h-4 text-slate-400"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
            Span("Gather all search results for LLM", cls="truncate min-w-0 text-xs text-slate-600 dark:text-slate-300"),
            href=gather_href,
            hx_get=gather_href,
            hx_target="#main-content",
            hx_push_url="true",
            hx_swap="outerHTML show:window:top settle:0.1s",
            cls="post-search-link flex items-center py-1 px-2 rounded bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors min-w-0"
        ),
        cls="bg-transparent"
    ))
    for item in matches:
        slug = str(item.relative_to(root).with_suffix(""))
        if item.suffix == ".pdf":
            display = item.relative_to(root).as_posix()
        else:
            display = item.relative_to(root).with_suffix("").as_posix()
        items.append(Li(
            A(
                Span(UkIcon("search", cls="w-4 h-4 text-slate-400"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
                Span(display, cls="truncate min-w-0 font-mono text-xs text-slate-600 dark:text-slate-300", title=display),
                href=f'/posts/{slug}',
                hx_get=f'/posts/{slug}', hx_target="#main-content", hx_push_url="true", hx_swap="outerHTML show:window:top settle:0.1s",
                cls="post-search-link flex items-center py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors min-w-0"
            )
        ))
    if regex_error:
        items.append(Li(regex_error, cls="text-[0.7rem] text-center text-amber-600 dark:text-amber-400 mt-1 bg-transparent"))
    return Ul(*items, cls="posts-search-results-list space-y-1 bg-white/0 dark:bg-slate-950/0")

def _posts_search_block():
    return Div(
        Div("Filter", cls="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2"),
        Div(
            Input(
                type="search",
                name="q",
                placeholder="Search file names…",
                autocomplete="off",
                data_placeholder_cycle="1",
                data_placeholder_primary="Search file names…",
                data_placeholder_alt="Search regex with /pattern/ syntax",
                data_search_key="posts",
                hx_get="/_sidebar/posts/search",
                hx_trigger="input changed delay:300ms",
                hx_target="next .posts-search-results",
                hx_swap="innerHTML",
                cls="w-full px-3 py-2 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            ),
            Button(
                "×",
                type="button",
                aria_label="Clear search",
                cls="posts-search-clear-button absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            ),
            cls="relative"
        ),
        Div(
            _render_posts_search_results(""),
            id="posts-search-results",
            cls="posts-search-results mt-4 max-h-64 overflow-y-auto bg-white/0 dark:bg-slate-950/0"
        ),
        cls="posts-search-block sticky top-0 z-10 bg-white/20 dark:bg-slate-950/70 mb-3"
    )

@lru_cache(maxsize=4)
def _cached_posts_sidebar_html(fingerprint, roles_key):
    sidebars_open = get_config().get_sidebars_open()
    sidebar = collapsible_sidebar(
        "menu",
        "Library",
        get_posts(list(roles_key) if roles_key else []),
        is_open=sidebars_open,
        data_sidebar="posts",
        shortcut_key="Z",
        extra_content=[
            _posts_search_block(),
            Div(cls="h-px w-full bg-slate-200/80 dark:bg-slate-700/70 my-2"),
            Div("Posts", cls="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1")
        ],
        scroll_target="list"
    )
    return to_xml(sidebar)

def _preload_posts_cache():
    try:
        _cached_build_post_tree(_posts_tree_fingerprint(), ())
        _cached_posts_sidebar_html(_posts_sidebar_fingerprint(), ())
        logger.info("Preloaded posts sidebar cache.")
    except Exception as exc:
        logger.warning(f"Failed to preload posts sidebar cache: {exc}")

# Warm cache on server startup to avoid first-request latency.
if hasattr(app, "add_event_handler"):
    app.add_event_handler("startup", _preload_posts_cache)
elif hasattr(app, "on_event"):
    app.on_event("startup")(_preload_posts_cache)

def collapsible_sidebar(icon, title, items_list, is_open=False, data_sidebar=None, shortcut_key=None, extra_content=None, scroll_target="container"):
    """Reusable collapsible sidebar component with sticky header"""
    # Build the summary content
    summary_content = [
        Span(
            UkIcon(icon, cls="w-5 h-5 block"),
            cls="flex items-center justify-center w-5 h-5 shrink-0 leading-none"
        ),
        Span(title, cls="flex-1 leading-none")
    ]
    
    # Add keyboard shortcut indicator if provided
    if shortcut_key:
        summary_content.append(
            Kbd(
                shortcut_key,
                cls="kbd-key px-2.5 py-1.5 text-xs font-mono font-semibold bg-gradient-to-b from-slate-50 to-slate-200 dark:from-slate-700 dark:to-slate-900 text-slate-800 dark:text-slate-200 rounded-md border-2 border-slate-300 dark:border-slate-600 shadow-[0_2px_0_0_rgba(0,0,0,0.1),inset_0_1px_0_0_rgba(255,255,255,0.5)] dark:shadow-[0_2px_0_0_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.1)]"
            )
        )
    
    # Sidebar styling configuration
    common_frost_style = "bg-white/20 dark:bg-slate-950/70 backdrop-blur-lg border border-slate-900/10 dark:border-slate-700/25 ring-1 ring-white/20 dark:ring-slate-900/30 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)] dark:shadow-[0_28px_70px_-45px_rgba(2,6,23,0.85)]"
    summary_classes = f"flex items-center gap-2 font-semibold cursor-pointer py-2.5 px-3 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 rounded-lg select-none list-none {common_frost_style} min-h-[56px]"
    if scroll_target == "list":
        content_classes = f"p-3 {common_frost_style} rounded-lg max-h-[calc(100vh-18rem)] flex flex-col overflow-hidden min-h-0"
        list_classes = "list-none pt-2 flex-1 min-h-0 overflow-y-auto sidebar-scroll-container"
    else:
        content_classes = f"p-3 {common_frost_style} rounded-lg overflow-y-auto max-h-[calc(100vh-18rem)] sidebar-scroll-container"
        list_classes = "list-none pt-4"
    
    extra_content = extra_content or []
    content_id = "sidebar-scroll-container" if scroll_target != "list" else None
    return Details(
        Summary(*summary_content, cls=summary_classes, style="margin: 0 0 0.5rem 0;"),
        Div(
            *extra_content,
            Ul(*items_list, cls=list_classes, id="sidebar-scroll-container" if scroll_target == "list" else None),
            cls=content_classes,
            id=content_id,
            style="will-change: auto;"
        ),
        open=is_open,
        data_sidebar=data_sidebar,
        style="will-change: auto;"
    )

@rt("/_sidebar/posts/search")
def posts_sidebar_search(q: str = "", request: Request = None):
    roles = _get_roles_from_request(request)
    return _render_posts_search_results(q, roles=roles)

def is_active_toc_item(anchor):
    """Check if a TOC item is currently active based on URL hash"""
    # This will be enhanced client-side with JavaScript
    return False

def extract_toc(content):
    """Extract table of contents from markdown content, excluding code blocks"""
    # Remove code blocks (both fenced and indented) to avoid false positives
    # Remove fenced code blocks (``` or ~~~)
    content_no_code = re.sub(r'^```.*?^```', '', content, flags=re.MULTILINE | re.DOTALL)
    content_no_code = re.sub(r'^~~~.*?^~~~', '', content_no_code, flags=re.MULTILINE | re.DOTALL)
    
    # Parse headings from the cleaned content
    heading_pattern = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
    headings = []
    counts = {}
    for match in heading_pattern.finditer(content_no_code):
        level = len(match.group(1))
        raw_text = match.group(2).strip()
        text = _strip_inline_markdown(raw_text)
        # Create anchor from heading text using shared function
        anchor = _unique_anchor(text_to_anchor(text), counts)
        headings.append((level, text, anchor))
    return headings

def build_toc_items(headings):
    """Build TOC items from extracted headings with active state tracking"""
    if not headings:
        return [Li("No headings found", cls="text-sm text-slate-500 dark:text-slate-400 py-1")]
    
    items = []
    for level, text, anchor in headings:
        indent = "ml-0" if level == 1 else f"ml-{(level-1)*3}"
        items.append(Li(
            A(text, href=f"#{anchor}", 
              cls=f"toc-link block py-1 px-2 text-sm rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors {indent}",
              data_anchor=anchor),
            cls="my-1"
        ))
    return items

def get_custom_css_links(current_path=None, section_class=None):
    """Check for custom.css or style.css in blog root and current post's directory
    
    Returns list of Link/Style elements for all found CSS files, ordered from root to specific
    (so more specific styles can override general ones). Folder-specific CSS is automatically
    scoped to only apply within that folder's pages.
    """
    root = get_root_folder()
    css_elements = []
    
    # First, check root directory - applies globally
    for filename in ['custom.css', 'style.css']:
        css_file = root / filename
        if css_file.exists():
            css_elements.append(Link(rel="stylesheet", href=f"/posts/{filename}"))
            break  # Only one from root
    
    # Then check current post's directory (if provided)
    # These are automatically scoped to only apply within the section
    if current_path and section_class:
        from pathlib import Path
        post_dir = Path(current_path).parent if '/' in current_path else Path('.')
        
        if str(post_dir) != '.':  # Not in root
            for filename in ['custom.css', 'style.css']:
                css_file = root / post_dir / filename
                if css_file.exists():
                    # Read CSS content and wrap all rules with section scope
                    css_content = css_file.read_text()
                    # Wrap the entire CSS in a section-specific scope
                    scoped_css = Style(f"""
                        #main-content.{section_class} {{
                            {css_content}
                        }}
                    """)
                    css_elements.append(scoped_css)
                    break  # Only one per directory
    
    return css_elements

def layout(*content, htmx, title=None, show_sidebar=False, toc_content=None, current_path=None, show_toc=True, auth=None, htmx_nav=True):
    import time
    layout_start_time = time.time()
    logger.debug("[LAYOUT] layout() start")
    # Generate section class for CSS scoping (will be used by get_custom_css_links if needed)
    section_class = f"section-{current_path.replace('/', '-')}" if current_path else ""
    t_section = time.time()
    logger.debug(f"[LAYOUT] section_class computed in {(t_section - layout_start_time)*1000:.2f}ms")
    layout_config = _resolve_layout_config(current_path)
    layout_max_class, layout_max_style = _width_class_and_style(layout_config.get("layout_max_width"), "max")
    layout_fluid_class = "layout-fluid" if layout_max_style else ""

    def _footer_node(outer_cls, outer_style):
        logout_button = None
        if auth:
            display_name = auth.get("name") or auth.get("email") or auth.get("username") or "User"
            impersonator = auth.get("impersonator")
            if impersonator:
                original = impersonator.get("name") or impersonator.get("email") or impersonator.get("username") or "User"
                display_name = f"Impersonating {display_name} (as {original})"
            logout_button = A(
                f"Logout {display_name}",
                href="/logout",
                cls="text-sm text-white/80 hover:text-white underline"
            )
        footer_inner = Div(
            Div(logout_button, cls="flex items-center") if logout_button else Div(),
            Div(NotStr('Powered by <a href="https://github.com/sizhky/bloggy" class="underline hover:text-white/80" target="_blank" rel="noopener noreferrer">Bloggy</a> and ❤️')),
            cls="flex items-center justify-between w-full"
        )
        return Footer(
            Div(footer_inner, cls="bg-slate-900 text-white rounded-lg p-4 my-4 dark:bg-slate-800"),
            cls=outer_cls,
            id="site-footer",
            **outer_style
        )


    # HTMX short-circuit: build only swappable fragments, never build full page chrome/sidebars tree
    if htmx and getattr(htmx, "request", None):
        if show_sidebar:
            toc_sidebar = None
            t_toc = t_section
            if show_toc:
                toc_items = build_toc_items(extract_toc(toc_content)) if toc_content else []
                t_toc = time.time()
                logger.debug(f"[LAYOUT] TOC built in {(t_toc - t_section)*1000:.2f}ms")

                sidebars_open = get_config().get_sidebars_open()
                toc_attrs = {
                    "cls": "hidden xl:block w-72 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]",
                    "id": "toc-sidebar",
                    "hx_swap_oob": "true",
                }
                toc_sidebar = Aside(
                    collapsible_sidebar("list", "Contents", toc_items, is_open=sidebars_open, shortcut_key="X") if toc_items else Div(),
                    **toc_attrs
                )
                mobile_toc_panel = Div(
                    Div(
                        Button(
                            UkIcon("x", cls="w-5 h-5"),
                            id="close-mobile-toc",
                            cls="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors ml-auto",
                            type="button"
                        ),
                        cls="flex justify-end p-2 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800"
                    ),
                    Div(
                        collapsible_sidebar("list", "Contents", toc_items, is_open=sidebars_open, shortcut_key="X") if toc_items else Div(P("No table of contents available.", cls="text-slate-500 dark:text-slate-400 text-sm p-4")),
                        cls="p-4 overflow-y-auto"
                    ),
                    id="mobile-toc-panel",
                    cls="fixed inset-0 bg-white dark:bg-slate-950 z-[9999] xl:hidden transform translate-x-full transition-transform duration-300",
                    hx_swap_oob="true"
                )

            custom_css_links = get_custom_css_links(current_path, section_class)
            t_css = time.time()
            logger.debug(f"[LAYOUT] Custom CSS resolved in {(t_css - t_toc)*1000:.2f}ms")

            main_content_container = Main(*content, cls=f"flex-1 min-w-0 px-6 py-8 space-y-8 {section_class}", id="main-content")
            t_main = time.time()
            logger.debug(f"[LAYOUT] Main content container built in {(t_main - t_css)*1000:.2f}ms")

            roles = _get_roles_from_auth(auth)
            roles_key = tuple(roles or [])
            posts_sidebar = Aside(
                Div(
                    UkIcon("loader", cls="w-5 h-5 animate-spin"),
                    Span("Loading posts…", cls="ml-2 text-sm"),
                    cls="flex items-center justify-center h-32 text-slate-400"
                ),
                cls="hidden xl:block w-72 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]",
                id="posts-sidebar",
                hx_get="/_sidebar/posts",
                hx_trigger="load",
                hx_swap="outerHTML",
                hx_swap_oob="true"
            )
            mobile_posts_panel = Div(
                Div(
                    Button(
                        UkIcon("x", cls="w-5 h-5"),
                        id="close-mobile-posts",
                        cls="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors ml-auto",
                        type="button"
                    ),
                    cls="flex justify-end p-2 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800"
                ),
                Div(
                    NotStr(_cached_posts_sidebar_html(_posts_sidebar_fingerprint(), roles_key)),
                    cls="p-4 overflow-y-auto"
                ),
                id="mobile-posts-panel",
                cls="fixed inset-0 bg-white dark:bg-slate-950 z-[9999] xl:hidden transform -translate-x-full transition-transform duration-300",
                hx_swap_oob="true"
            )

            result = [Title(title)]
            if custom_css_links:
                result.append(Div(*custom_css_links, id="scoped-css-container", hx_swap_oob="true"))
            else:
                result.append(Div(id="scoped-css-container", hx_swap_oob="true"))
            result.append(posts_sidebar)
            result.append(mobile_posts_panel)
            if show_toc:
                result.append(mobile_toc_panel)
            if toc_sidebar:
                result.extend([main_content_container, toc_sidebar])
            else:
                result.append(main_content_container)
                result.append(Div(id="toc-sidebar", hx_swap_oob="true"))
                result.append(Div(id="mobile-toc-panel", hx_swap_oob="true"))

            t_htmx = time.time()
            logger.debug(f"[LAYOUT] HTMX response assembled in {(t_htmx - t_main)*1000:.2f}ms")
            logger.debug(f"[LAYOUT] TOTAL layout() time {(t_htmx - layout_start_time)*1000:.2f}ms")
            return tuple(result)

        # HTMX without sidebar
        custom_css_links = get_custom_css_links(current_path, section_class) if current_path else []
        t_css = time.time()
        logger.debug(f"[LAYOUT] Custom CSS resolved in {(t_css - t_section)*1000:.2f}ms")

        result = [Title(title)]
        if custom_css_links:
            result.append(Div(*custom_css_links, id="scoped-css-container", hx_swap_oob="true"))
        else:
            result.append(Div(id="scoped-css-container", hx_swap_oob="true"))
        result.extend(content)

        t_htmx = time.time()
        logger.debug(f"[LAYOUT] HTMX response assembled in {(t_htmx - layout_start_time)*1000:.2f}ms")
        logger.debug(f"[LAYOUT] TOTAL layout() time {(t_htmx - layout_start_time)*1000:.2f}ms")
        return tuple(result)

    if show_sidebar:
        # Build TOC if content provided
        toc_sidebar = None
        t_toc = t_section
        if show_toc:
            toc_items = build_toc_items(extract_toc(toc_content)) if toc_content else []
            t_toc = time.time()
            logger.debug(f"[LAYOUT] TOC built in {(t_toc - t_section)*1000:.2f}ms")
            # Right sidebar TOC component with out-of-band swap for HTMX
            sidebars_open = get_config().get_sidebars_open()
            toc_attrs = {
                "cls": "hidden xl:block w-72 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]",
                "id": "toc-sidebar"
            }
            toc_sidebar = Aside(
                collapsible_sidebar("list", "Contents", toc_items, is_open=sidebars_open, shortcut_key="X") if toc_items else Div(),
                **toc_attrs
            )
        # Container for main content only (for HTMX swapping)
        # Add section class to identify the section for CSS scoping
        section_class = f"section-{current_path.replace('/', '-')}" if current_path else ""
        # Get custom CSS with folder-specific CSS automatically scoped
        custom_css_links = get_custom_css_links(current_path, section_class)
        t_css = time.time()
        logger.debug(f"[LAYOUT] Custom CSS resolved in {(t_css - t_toc)*1000:.2f}ms")
        main_content_container = Main(*content, cls=f"flex-1 min-w-0 px-6 py-8 space-y-8 {section_class}", id="main-content")
        t_main = time.time()
        logger.debug(f"[LAYOUT] Main content container built in {(t_main - t_css)*1000:.2f}ms")
        # Mobile overlay panels for posts and TOC
        roles = _get_roles_from_auth(auth)
        roles_key = tuple(roles or [])
        mobile_posts_panel = Div(
            Div(
                Button(
                    UkIcon("x", cls="w-5 h-5"),
                    id="close-mobile-posts",
                    cls="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors ml-auto",
                    type="button"
                ),
                cls="flex justify-end p-2 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800"
            ),
            Div(
                NotStr(_cached_posts_sidebar_html(_posts_sidebar_fingerprint(), roles_key)),
                cls="p-4 overflow-y-auto"
            ),
            id="mobile-posts-panel",
            cls="fixed inset-0 bg-white dark:bg-slate-950 z-[9999] xl:hidden transform -translate-x-full transition-transform duration-300"
        )
        mobile_toc_panel = None
        if show_toc:
            mobile_toc_panel = Div(
                Div(
                    Button(
                        UkIcon("x", cls="w-5 h-5"),
                        id="close-mobile-toc",
                        cls="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors ml-auto",
                        type="button"
                    ),
                    cls="flex justify-end p-2 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800"
                ),
                Div(
                    collapsible_sidebar("list", "Contents", toc_items, is_open=sidebars_open, shortcut_key="X") if toc_items else Div(P("No table of contents available.", cls="text-slate-500 dark:text-slate-400 text-sm p-4")),
                    cls="p-4 overflow-y-auto"
                ),
                id="mobile-toc-panel",
                cls="fixed inset-0 bg-white dark:bg-slate-950 z-[9999] xl:hidden transform translate-x-full transition-transform duration-300"
            )
        # Full layout with all sidebars
        content_with_sidebars = Div(
            cls=f"layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-4 flex gap-6 flex-1".strip(),
            id="content-with-sidebars",
            **_style_attr(layout_max_style)
        )(
            # Left sidebar - lazy load with HTMX, show loader placeholder
            Aside(
                Div(
                    UkIcon("loader", cls="w-5 h-5 animate-spin"),
                    Span("Loading posts…", cls="ml-2 text-sm"),
                    cls="flex items-center justify-center h-32 text-slate-400"
                ),
                cls="hidden xl:block w-72 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]",
                id="posts-sidebar",
                hx_get="/_sidebar/posts",
                hx_trigger="load",
                hx_swap="outerHTML"
            ),
            # Main content (swappable)
            main_content_container,
            # Right sidebar - TOC (swappable out-of-band)
            toc_sidebar if toc_sidebar else None
        )
        t_sidebars = time.time()
        logger.debug(f"[LAYOUT] Sidebars container built in {(t_sidebars - t_main)*1000:.2f}ms")
        # Layout with sidebar for blog posts
        body_content = Div(id="page-container", cls="flex flex-col min-h-screen")(
            Div(
                navbar(show_mobile_menus=True, htmx_nav=htmx_nav),
                cls=f"layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-4 sticky top-0 z-50 mt-4".strip(),
                id="site-navbar",
                **_style_attr(layout_max_style)
            ),
            mobile_posts_panel,
            mobile_toc_panel if mobile_toc_panel else None,
            content_with_sidebars,
            _footer_node(
                f"layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-6 mt-auto mb-6".strip(),
                _style_attr(layout_max_style)
            )
        )
    else:
        # Default layout without sidebar
        custom_css_links = get_custom_css_links(current_path, section_class) if current_path else []
        body_content = Div(id="page-container", cls="flex flex-col min-h-screen")(
            Div(
                navbar(htmx_nav=htmx_nav),
                cls=f"layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-4 sticky top-0 z-50 mt-4".strip(),
                id="site-navbar",
                **_style_attr(layout_max_style)
            ),
            Main(
                *content,
                cls=f"layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-6 py-8 space-y-8".strip(),
                id="main-content",
                **_style_attr(layout_max_style)
            ),
            _footer_node(
                f"layout-container {layout_fluid_class} w-full {layout_max_class} mx-auto px-6 mt-auto mb-6".strip(),
                _style_attr(layout_max_style)
            )
        )
        t_body = time.time()
        logger.debug(f"[LAYOUT] Body content (no sidebar) built in {(t_body - layout_start_time)*1000:.2f}ms")
    # For full page loads, return complete page
    result = [Title(title)]
    # Wrap custom CSS in a container so HTMX can swap it out later
    if custom_css_links:
        css_container = Div(*custom_css_links, id="scoped-css-container")
        result.append(css_container)
    else:
        # Even if no CSS now, add empty container for future swaps
        css_container = Div(id="scoped-css-container")
        result.append(css_container)
    result.append(body_content)
    t_end = time.time()
    logger.debug(f"[LAYOUT] FULL PAGE assembled in {(t_end - layout_start_time)*1000:.2f}ms")
    return tuple(result)

def build_post_tree(folder, roles=None):
    import time
    start_time = time.time()
    root = get_root_folder()
    items = []
    try:
        index_file = find_index_file() if folder == root else None
        entries = []
        folder_note = find_folder_note_file(folder)
        for item in folder.iterdir():
            if item.name == ".bloggy":
                continue
            if item.is_dir():
                if item.name.startswith('.'):
                    continue
                entries.append(item)
            elif item.suffix in ('.md', '.pdf'):
                if folder_note and item.resolve() == folder_note.resolve():
                    continue
                # Skip the file being used for home page (index.md takes precedence over readme.md)
                if index_file and item.resolve() == index_file.resolve():
                    continue
                entries.append(item)
        config = get_bloggy_config(folder)
        entries = order_bloggy_entries(entries, config)
        abbreviations = _effective_abbreviations(root, folder)
        logger.debug(
            "[DEBUG] build_post_tree entries for %s: %s",
            folder,
            [item.name for item in entries],
        )
        logger.debug(f"[DEBUG] Scanning directory: {folder.relative_to(root) if folder != root else '.'} - found {len(entries)} entries")
    except (OSError, PermissionError): 
        return items
    
    for item in entries:
        if item.is_dir():
            if item.name.startswith('.'): continue
            sub_items = build_post_tree(item, roles=roles)
            folder_title = slug_to_title(item.name, abbreviations=abbreviations)
            note_file = find_folder_note_file(item)
            note_link = None
            note_slug = None
            note_allowed = False
            if note_file:
                note_slug = str(note_file.relative_to(root).with_suffix(''))
                note_path = f"/posts/{note_slug}"
                note_allowed = _is_allowed(note_path, roles or [])
                if note_allowed:
                    note_link = A(
                        href=f'/posts/{note_slug}',
                        hx_get=f'/posts/{note_slug}', hx_target="#main-content", hx_push_url="true", hx_swap="outerHTML show:window:top settle:0.1s",
                        cls="folder-note-link truncate min-w-0 hover:underline",
                        title=f"Open {folder_title}",
                        onclick="event.stopPropagation();",
                    )(folder_title)
            if not sub_items and not note_allowed:
                continue
            title_node = note_link if note_link else Span(folder_title, cls="truncate min-w-0", title=folder_title)
            if sub_items:
                items.append(Li(Details(
                    Summary(
                        Span(Span(cls="folder-chevron"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
                        Span(UkIcon("folder", cls="text-blue-500 w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
                        title_node,
                        cls="flex items-center font-medium cursor-pointer py-1 px-2 hover:text-blue-600 select-none list-none rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-w-0"),
                    Ul(*sub_items, cls="ml-4 pl-2 space-y-1 border-l border-slate-100 dark:border-slate-800"),
                    data_folder="true"), cls="my-1"))
            elif note_allowed and note_slug:
                title_text = Span(folder_title, cls="truncate min-w-0", title=folder_title)
                items.append(Li(A(
                    Span(cls="w-4 mr-2 shrink-0"),
                    Span(UkIcon("folder", cls="text-blue-500 w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
                    title_text,
                    href=f'/posts/{note_slug}',
                    hx_get=f'/posts/{note_slug}', hx_target="#main-content", hx_push_url="true", hx_swap="outerHTML show:window:top settle:0.1s",
                    cls="post-link flex items-center py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 hover:underline transition-colors min-w-0",
                    data_path=note_slug)))
        elif item.suffix == '.md':
            slug = str(item.relative_to(root).with_suffix(''))
            if not _is_allowed(f"/posts/{slug}", roles or []):
                continue
            title_start = time.time()
            title = get_post_title(item, abbreviations=abbreviations)
            title_time = (time.time() - title_start) * 1000
            if title_time > 1:  # Only log if it takes more than 1ms
                logger.debug(f"[DEBUG] Getting title for {item.name} took {title_time:.2f}ms")
            items.append(Li(A(
                Span(cls="w-4 mr-2 shrink-0"),
                Span(UkIcon("file-text", cls="text-slate-400 w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
                Span(title, cls="truncate min-w-0", title=title),
                href=f'/posts/{slug}',
                hx_get=f'/posts/{slug}', hx_target="#main-content", hx_push_url="true", hx_swap="outerHTML show:window:top settle:0.1s",
                cls="post-link flex items-center py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors min-w-0",
                data_path=slug)))
        elif item.suffix == '.pdf':
            slug = str(item.relative_to(root).with_suffix(''))
            if not _is_allowed(f"/posts/{slug}", roles or []):
                continue
            title = slug_to_title(item.stem, abbreviations=abbreviations)
            items.append(Li(A(
                Span(cls="w-4 mr-2 shrink-0"),
                Span(UkIcon("file-text", cls="text-slate-400 w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
                Span(f"{title} (PDF)", cls="truncate min-w-0", title=title),
                href=f'/posts/{slug}',
                hx_get=f'/posts/{slug}', hx_target="#main-content", hx_push_url="true", hx_swap="outerHTML show:window:top settle:0.1s",
                cls="post-link flex items-center py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors min-w-0",
                data_path=slug)))
    
    elapsed = (time.time() - start_time) * 1000
    logger.debug(f"[DEBUG] build_post_tree for {folder.relative_to(root) if folder != root else '.'} completed in {elapsed:.2f}ms")
    return items

def _posts_tree_fingerprint():
    root = get_root_folder()
    try:
        md_mtime = max((p.stat().st_mtime for p in root.rglob("*.md")), default=0)
        pdf_mtime = max((p.stat().st_mtime for p in root.rglob("*.pdf")), default=0)
        bloggy_mtime = max((p.stat().st_mtime for p in root.rglob(".bloggy")), default=0)
        return max(md_mtime, pdf_mtime, bloggy_mtime)
    except Exception:
        return 0

@lru_cache(maxsize=4)
def _cached_build_post_tree(fingerprint, roles_key):
    roles = list(roles_key) if roles_key else []
    return build_post_tree(get_root_folder(), roles=roles)

def get_posts(roles=None):
    fingerprint = _posts_tree_fingerprint()
    roles_key = tuple(roles or [])
    return _cached_build_post_tree(fingerprint, roles_key)

def not_found(htmx=None, auth=None):
    """Custom 404 error page"""
    blog_title = get_blog_title()
    
    content = Div(
        # Large 404 heading
        Div(
            H1("404", cls="text-9xl font-bold text-slate-300 dark:text-slate-700 mb-4"),
            cls="text-center"
        ),
        
        # Main error message
        H2("Page Not Found", cls="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-4 text-center"),
        
        # Description
        P(
            "Oops! The page you're looking for doesn't exist. It might have been moved or deleted.",
            cls="text-lg text-slate-600 dark:text-slate-400 mb-8 text-center max-w-2xl mx-auto"
        ),
        
        # Action buttons
        Div(
            A(
                UkIcon("home", cls="w-5 h-5 mr-2"),
                "Go to Home",
                href="/",
                hx_get="/",
                hx_target="#main-content",
                hx_push_url="true",
                hx_swap="outerHTML show:window:top settle:0.1s",
                cls="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors mr-4"
            ),
            A(
                UkIcon("arrow-left", cls="w-5 h-5 mr-2"),
                "Go Back",
                href="javascript:history.back()",
                cls="inline-flex items-center px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg font-medium transition-colors"
            ),
            cls="flex justify-center items-center gap-4 flex-wrap"
        ),
        
        # Decorative element
        Div(
            P(
                "💡 ",
                Strong("Tip:"),
                " Check the sidebar for available posts, or use the search to find what you're looking for.",
                cls="text-sm text-slate-500 dark:text-slate-500 italic"
            ),
            cls="mt-12 text-center"
        ),
        
        cls="flex flex-col items-center justify-center py-16 px-6 min-h-[60vh]"
    )
    
    # Return with layout, including sidebar for easy navigation
    # Store the result tuple to potentially wrap with status code
    result = layout(content, htmx=htmx, title=f"404 - Page Not Found | {blog_title}", show_sidebar=True, auth=auth)
    return result

@rt('/posts/{path:path}')
def post_detail(path: str, htmx, request: Request):
    import time
    request_start = time.time()
    logger.info(f"\n[DEBUG] ########## REQUEST START: /posts/{path} ##########")
    
    root = get_root_folder()
    abbreviations = _effective_abbreviations(root)
    file_path = root / f'{path}.md'
    pdf_path = root / f'{path}.pdf'
    
    # Check if file exists
    if not file_path.exists():
        if pdf_path.exists():
            post_title = f"{slug_to_title(Path(path).name, abbreviations=abbreviations)} (PDF)"
            pdf_src = f"/posts/{path}.pdf"
            pdf_content = Div(
                Div(
                    H1(post_title, cls="text-4xl font-bold"),
                    Button(
                        "Focus PDF",
                        cls="pdf-focus-toggle inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                        type="button",
                        data_pdf_focus_toggle="true",
                        data_pdf_focus_label="Focus PDF",
                        data_pdf_exit_label="Exit focus",
                        aria_pressed="false"
                    ),
                    cls="flex items-center justify-between gap-4 flex-wrap mb-6"
                ),
                NotStr(
                    f'<object data="{pdf_src}" type="application/pdf" '
                    'class="pdf-viewer w-full h-[calc(100vh-14rem)] rounded-lg border border-slate-200 '
                    'dark:border-slate-700 bg-white dark:bg-slate-900">'
                    '<p class="p-4 text-sm text-slate-600 dark:text-slate-300">'
                    'PDF preview not available. '
                    f'<a href="{pdf_src}" class="text-blue-600 hover:underline">Download PDF</a>.'
                    '</p></object>'
                )
            )
            return layout(pdf_content, htmx=htmx, title=f"{post_title} - {get_blog_title()}",
                          show_sidebar=True, toc_content=None, current_path=path, show_toc=False, auth=request.scope.get("auth"))
        return not_found(htmx, auth=request.scope.get("auth"))
    
    metadata, raw_content = parse_frontmatter(file_path)
    
    # Get title from frontmatter or filename
    post_title = metadata.get('title', slug_to_title(path.split('/')[-1], abbreviations=abbreviations))
    
    # Render the markdown content with current path for relative link resolution
    md_start = time.time()
    content = from_md(raw_content, current_path=path)
    md_time = (time.time() - md_start) * 1000
    logger.debug(f"[DEBUG] Markdown rendering took {md_time:.2f}ms")
    
    copy_button = Button(
        UkIcon("clipboard", cls="w-4 h-4"),
        type="button",
        title="Copy raw markdown",
        onclick="(function(){const el=document.getElementById('raw-md-clipboard');const toast=document.getElementById('raw-md-toast');if(!el){return;}el.focus();el.select();const text=el.value;const done=()=>{if(!toast){return;}toast.classList.remove('opacity-0');toast.classList.add('opacity-100');setTimeout(()=>{toast.classList.remove('opacity-100');toast.classList.add('opacity-0');},1400);};if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(done).catch(()=>{document.execCommand('copy');done();});}else{document.execCommand('copy');done();}})()",
        cls="inline-flex items-center justify-center p-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
    )
    post_content = Div(
        Div(
            H1(post_title, cls="text-4xl font-bold"),
            copy_button,
            cls="flex items-center gap-2 flex-wrap mb-8"
        ),
        Div(
            "Copied Raw Markdown!",
            id="raw-md-toast",
            cls="fixed top-6 right-6 bg-slate-900 text-white text-sm px-4 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300"
        ),
        Textarea(
            raw_content,
            id="raw-md-clipboard",
            cls="absolute left-[-9999px] top-0 opacity-0 pointer-events-none"
        ),
        content
    )
    
    # Always return complete layout with sidebar and TOC
    layout_start = time.time()
    result = layout(post_content, htmx=htmx, title=f"{post_title} - {get_blog_title()}", 
                  show_sidebar=True, toc_content=raw_content, current_path=path, auth=request.scope.get("auth"))
    layout_time = (time.time() - layout_start) * 1000
    logger.debug(f"[DEBUG] Layout generation took {layout_time:.2f}ms")
    
    total_time = (time.time() - request_start) * 1000
    logger.debug(f"[DEBUG] ########## REQUEST COMPLETE: {total_time:.2f}ms TOTAL ##########\n")
    
    return result

def find_index_file():
    """Find index.md or readme.md (case insensitive) in root folder"""
    root = get_root_folder()
    
    # Try to find index.md first (case insensitive)
    for file in root.iterdir():
        if file.is_file() and file.suffix == '.md' and file.stem.lower() == 'index':
            return file
    
    # Try to find readme.md (case insensitive)
    for file in root.iterdir():
        if file.is_file() and file.suffix == '.md' and file.stem.lower() == 'readme':
            return file
    
    return None

@rt
def index(htmx, request: Request):
    import time
    request_start = time.time()
    logger.info(f"\n[DEBUG] ########## REQUEST START: / (index) ##########")
    
    blog_title = get_blog_title()
    
    # Try to find index.md or readme.md
    index_file = find_index_file()
    
    if index_file:
        # Render the index/readme file
        metadata, raw_content = parse_frontmatter(index_file)
        page_title = metadata.get('title', blog_title)
        # Use index file's relative path from root for link resolution
        index_path = str(index_file.relative_to(get_root_folder()).with_suffix(''))
        content = from_md(raw_content, current_path=index_path)
        page_content = Div(H1(page_title, cls="text-4xl font-bold mb-8"), content)
        
        layout_start = time.time()
        result = layout(page_content, htmx=htmx, title=f"{page_title} - {blog_title}", 
                      show_sidebar=True, toc_content=raw_content, current_path=index_path, auth=request.scope.get("auth"))
        layout_time = (time.time() - layout_start) * 1000
        logger.debug(f"[DEBUG] Layout generation took {layout_time:.2f}ms")
        
        total_time = (time.time() - request_start) * 1000
        logger.debug(f"[DEBUG] ########## REQUEST COMPLETE: {total_time:.2f}ms TOTAL ##########\n")
        
        return result
    else:
        # Default welcome message
        layout_start = time.time()
        result = layout(Div(
            H1(f"Welcome to {blog_title}!", cls="text-4xl font-bold tracking-tight mb-8"),
            P("Your personal blogging platform.", cls="text-lg text-slate-600 dark:text-slate-400 mb-4"),
            P("Browse your posts using the sidebar, or create an ", 
              Strong("index.md"), " or ", Strong("README.md"), 
              " file in your blog directory to customize this page.", 
              cls="text-base text-slate-600 dark:text-slate-400"),
            cls="w-full"), htmx=htmx, title=f"Home - {blog_title}", show_sidebar=True, auth=request.scope.get("auth"))
        layout_time = (time.time() - layout_start) * 1000
        logger.debug(f"[DEBUG] Layout generation took {layout_time:.2f}ms")
        
        total_time = (time.time() - request_start) * 1000
        logger.debug(f"[DEBUG] ########## REQUEST COMPLETE: {total_time:.2f}ms TOTAL ##########\n")
        
        return result

# Catch-all route for 404 pages (must be last)
@rt('/{path:path}')
def catch_all(path: str, htmx, request: Request):
    """Catch-all route for undefined URLs"""
    return not_found(htmx, auth=request.scope.get("auth"))
