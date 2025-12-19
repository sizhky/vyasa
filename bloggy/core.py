import re, frontmatter, mistletoe as mst, pathlib, os
from functools import partial
from functools import lru_cache
from pathlib import Path
from fasthtml.common import *
from fasthtml.common import Beforeware
from fasthtml.jupyter import *
from monsterui.all import *
from starlette.staticfiles import StaticFiles
from .config import get_config
from loguru import logger

# disable debug level logs to stdout
logger.remove()
logger.add(sys.stdout, level="INFO")
logfile = Path("/tmp/bloggy_core.log")
logger.add(logfile, rotation="10 MB", retention="10 days", level="DEBUG")

slug_to_title = lambda s: ' '.join(word.capitalize() for word in s.replace('-', ' ').replace('_', ' ').split())
slug_to_title = lambda s: ' '.join(
    word if word.isupper() else word[0].upper() + word[1:]
    for word in s.replace('-', ' ').replace('_', ' ').split()
)

def text_to_anchor(text):
    """Convert text to anchor slug"""
    return re.sub(r'[^\w\s-]', '', text.lower()).replace(' ', '-')

# Cache for parsed frontmatter to avoid re-reading files
_frontmatter_cache = {}

def parse_frontmatter(file_path):
    """Parse frontmatter from a markdown file with caching"""
    import time
    start_time = time.time()
    
    file_path = Path(file_path)
    cache_key = str(file_path)
    mtime = file_path.stat().st_mtime
    
    if cache_key in _frontmatter_cache:
        cached_mtime, cached_data = _frontmatter_cache[cache_key]
        if cached_mtime == mtime:
            elapsed = (time.time() - start_time) * 1000
            logger.debug(f"[DEBUG] parse_frontmatter CACHE HIT for {file_path.name} ({elapsed:.2f}ms)")
            return cached_data
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            post = frontmatter.load(f)
            result = (post.metadata, post.content)
            _frontmatter_cache[cache_key] = (mtime, result)
            elapsed = (time.time() - start_time) * 1000
            logger.debug(f"[DEBUG] parse_frontmatter READ FILE {file_path.name} ({elapsed:.2f}ms)")
            return result
    except Exception as e:
        print(f"Error parsing frontmatter from {file_path}: {e}")
        return {}, open(file_path).read()

def get_post_title(file_path):
    """Get post title from frontmatter or filename"""
    metadata, _ = parse_frontmatter(file_path)
    return metadata.get('title', slug_to_title(file_path.stem))

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

def span_token(name, pat, attr, prec=5, parse_inner=False):
    class T(mst.span_token.SpanToken):
        precedence,parse_group,pattern = prec,1,re.compile(pat)
        def __init__(self, match): 
            setattr(self, attr, match.group(1))
            self.children = ()
    T.__name__ = name
    T.parse_inner = parse_inner
    return T

FootnoteRef = span_token('FootnoteRef', r'\[\^([^\]]+)\](?!:)', 'target')

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
        # Pattern to match ::tab{title="..."}
        tab_pattern = re.compile(r'^::tab\{title="([^"]+)"\}\s*\n(.*?)(?=^::tab\{|\Z)', re.MULTILINE | re.DOTALL)
        
        tabs = []
        for tab_match in tab_pattern.finditer(tabs_content):
            title = tab_match.group(1)
            tab_content = tab_match.group(2).strip()
            tabs.append((title, tab_content))
        
        if not tabs:
            return match.group(0)  # Return original if no tabs found
        
        # Generate unique ID for this tab group
        tab_id = hashlib.md5(match.group(0).encode()).hexdigest()[:8]
        
        # Store tab data for later processing
        tab_data_store[tab_id] = tabs
        
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
    
    def render_footnote_ref(self, token):
        self.fn_counter += 1
        n, target = self.fn_counter, token.target
        content = self.footnotes.get(target, f"[Missing footnote: {target}]")
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
        level = token.level
        inner = self.render_inner(token)
        anchor = text_to_anchor(inner)
        return f'<h{level} id="{anchor}">{inner}</h{level}>'
    
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
                except Exception as e:
                    print(f"Error parsing mermaid frontmatter: {e}")
                
                # Use code without frontmatter for rendering
                code = code_without_frontmatter
            
            diagram_id = f"mermaid-{hash(code) & 0xFFFFFF}"
            
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
            
            return f'''<div class="mermaid-container relative border-4 rounded-md my-4 shadow-2xl" style="{container_style}">
                <div class="mermaid-controls absolute top-2 right-2 z-10 flex gap-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded">
                    <button onclick="openMermaidFullscreen('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Fullscreen">⛶</button>
                    <button onclick="resetMermaidZoom('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Reset zoom">Reset</button>
                    <button onclick="zoomMermaidIn('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Zoom in">+</button>
                    <button onclick="zoomMermaidOut('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Zoom out">−</button>
                </div>
                <div id="{diagram_id}" class="mermaid-wrapper p-4 overflow-hidden flex justify-center items-center" style="min-height: {min_height}; height: {height};" data-mermaid-code="{escaped_code}"><pre class="mermaid" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">{code}</pre></div>
            </div>'''
        
        # For other languages: escape HTML/XML for display, but NOT for markdown 
        # (markdown code blocks should show raw source)
        import html
        if lang and lang.lower() != 'markdown':
            code = html.escape(code)
        lang_class = f' class="language-{lang}"' if lang else ''
        return f'<pre><code{lang_class}>{code}</code></pre>'
    
    def render_link(self, token):
        href, inner, title = token.target, self.render_inner(token), f' title="{token.title}"' if token.title else ''
        
        # Check if it's an external link (http://, https://, mailto:, etc.)
        is_external = href.startswith(('http://', 'https://', 'mailto:', 'tel:', '//', '#'))
        
        # Check if it's an absolute internal link starting with /
        is_absolute_internal = href.startswith('/') and not href.startswith('//')
        
        # Handle relative links (e.g., ./file.md, ../other/file.md, file.md)
        is_relative = not is_external and not is_absolute_internal
        
        # Always try to resolve relative links
        if is_relative:
            # Resolve relative link based on current post path
            from pathlib import Path
            
            original_href = href
            
            # Remove .md extension if present
            if href.endswith('.md'):
                href = href[:-3]
            
            if self.current_path:
                # Get the root folder first
                root = get_root_folder().resolve()
                
                # Build the full path to current file from root
                current_file_full = root / self.current_path
                current_dir = current_file_full.parent
                
                # Resolve the relative path from current directory
                resolved = (current_dir / href).resolve()
                
                logger.debug(f"DEBUG: original_href={original_href}, current_path={self.current_path}, current_dir={current_dir}, resolved={resolved}, root={root}")
                
                try:
                    # Get relative path from root
                    rel_path = resolved.relative_to(root)
                    href = f'/posts/{rel_path}'
                    is_absolute_internal = True
                    logger.debug(f"DEBUG: SUCCESS - rel_path={rel_path}, final href={href}")
                except ValueError as e:
                    # Path is outside root folder, treat as external
                    is_external = True
                    logger.debug(f"DEBUG: FAILED - ValueError: {e}")
            else:
                # If no current_path, can't properly resolve relative links
                # Treat as external to avoid broken links
                is_external = True
                logger.debug(f"DEBUG: No current_path, treating as external")
        
        # Determine if this should have HTMX attributes (internal links without file extensions)
        is_internal = is_absolute_internal and '.' not in href.split('/')[-1]
        
        hx = f' hx-get="{href}" hx-target="#main-content" hx-push-url="true" hx-swap="innerHTML show:window:top"' if is_internal else ''
        ext = '' if (is_internal or is_absolute_internal) else ' target="_blank" rel="noopener noreferrer"'
        return f'<a href="{href}"{hx}{ext} class="text-primary underline"{title}>{inner}</a>'


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
            with ContentRenderer(InlineCodeAttr, Strikethrough, FootnoteRef, Superscript, Subscript, img_dir=img_dir, footnotes=footnotes, current_path=current_path) as renderer:
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
        # Convert current_path to URL path for images (e.g., demo/flat-land/chapter-01 -> /posts/demo/flat-land)
        from pathlib import Path
        path_parts = Path(current_path).parts
        if len(path_parts) > 1:
            img_dir = '/posts/' + '/'.join(path_parts[:-1])
        else:
            img_dir = '/posts'
    
    content, footnotes = extract_footnotes(content)
    content = preprocess_super_sub(content)  # Preprocess superscript/subscript
    content, tab_data_store = preprocess_tabs(content)  # Preprocess tabs and get tab data
    mods = {'pre': 'my-4', 'p': 'text-base leading-relaxed mb-6', 'li': 'text-base leading-relaxed',
            'ul': 'uk-list uk-list-bullet space-y-2 mb-6 ml-6 text-base', 'ol': 'uk-list uk-list-decimal space-y-2 mb-6 ml-6 text-base', 
            'hr': 'border-t border-border my-8', 'h1': 'text-3xl font-bold mb-6 mt-8', 'h2': 'text-2xl font-semibold mb-4 mt-6', 
            'h3': 'text-xl font-semibold mb-3 mt-5', 'h4': 'text-lg font-semibold mb-2 mt-4'}
    
    # Register custom tokens with renderer context manager
    with ContentRenderer(InlineCodeAttr, Strikethrough, FootnoteRef, Superscript, Subscript, img_dir=img_dir, footnotes=footnotes, current_path=current_path) as renderer:
        doc = mst.Document(content)
        html = renderer.render(doc)
    
    # Post-process: replace tab placeholders with rendered tabs
    if tab_data_store:
        html = postprocess_tabs(html, tab_data_store, img_dir, current_path, footnotes)
    
    return Div(Link(rel="stylesheet", href="/static/sidenote.css"), NotStr(apply_classes(html, class_map_mods=mods)), cls="w-full")

# App configuration
def get_root_folder(): return get_config().get_root_folder()
def get_blog_title(): return get_config().get_blog_title()

hdrs = (
    *Theme.slate.headers(highlightjs=True),
    Link(rel="icon", href="/static/favicon.png"),
    Script(src="https://unpkg.com/hyperscript.org@0.9.12"),
    Script(src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs", type="module"),
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
        document.addEventListener('DOMContentLoaded', function() {
            renderMathInElement(document.body, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false
            });
        });
        
        // Re-render math after HTMX swaps
        document.body.addEventListener('htmx:afterSwap', function() {
            renderMathInElement(document.body, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false
            });
        });
    """),
    Link(rel="preconnect", href="https://fonts.googleapis.com"), 
    Link(rel="preconnect", href="https://fonts.gstatic.com", crossorigin=""),
    Link(rel="stylesheet", href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono&display=swap"),
    Style("body { font-family: 'IBM Plex Sans', sans-serif; } code, pre { font-family: 'IBM Plex Mono', monospace; }"),
    Style(".folder-chevron { transition: transform 0.2s; display: inline-block; } details[open] > summary > .folder-chevron { transform: rotate(90deg); } details { border: none !important; box-shadow: none !important; }"),
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
        
        /* Tabs styles */
        .tabs-container { 
            margin: 2rem 0; 
            border: 1px solid rgb(226 232 240); 
            border-radius: 0.5rem; 
            overflow: hidden; 
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
def user_auth_before(req, sess):
    logger.info(f'Authenticating request for {req.url.path}')
    auth = req.scope['auth'] = sess.get('auth', None)
    if not auth:
        sess['next'] = req.url.path
        from starlette.responses import RedirectResponse
        return RedirectResponse('/login', status_code=303)

# Enable auth only if username and password are configured
_config = get_config()
_auth_creds = _config.get_auth()
logger.info(f"Authentication enabled: {_auth_creds is not None and _auth_creds[0] and _auth_creds[1]}")

if _auth_creds and _auth_creds[0] and _auth_creds[1]:
    beforeware = Beforeware(
        user_auth_before,
        skip=[
            r'^/login$',
            r'^/_sidebar/.*',
            r'^/static/.*',
            r'.*\.css',
            r'.*\.js',
        ]
    )
else:
    beforeware = None

logger.info(f'{beforeware=}')

app = FastHTML(hdrs=hdrs, before=beforeware) if beforeware else FastHTML(hdrs=hdrs)

static_dir = Path(__file__).parent / "static"

if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

rt = app.route


from starlette.requests import Request
from starlette.responses import RedirectResponse

@rt("/login", methods=["GET", "POST"])
async def login(request: Request):
    config = get_config()
    user, pwd = config.get_auth()
    logger.info(f"Login attempt for user: {user}")
    error = None
    if request.method == "POST":
        form = await request.form()
        username = form.get("username", "")
        password = form.get("password", "")
        if username == user and password == pwd:
            request.session["auth"] = username
            next_url = request.session.pop("next", "/")
            return RedirectResponse(next_url, status_code=303)
        else:
            error = "Invalid username or password."

    return Div(
        H2("Login", cls="uk-h2"),
        Form(
            Div(
                Input(type="text", name="username", required=True, id="username", cls="uk-input input input-bordered w-full", placeholder="Username"),
                cls="my-4"),
            Div(
                Input(type="password", name="password", required=True, id="password", cls="uk-input input input-bordered w-full", placeholder="Password"),
                cls="my-4"),
            Button("Login", type="submit", cls="uk-btn btn btn-primary w-full"),
            enctype="multipart/form-data", method="post", cls="max-w-sm mx-auto"),
        P(error, cls="text-red-500 mt-4") if error else None,
        cls="prose mx-auto mt-24 text-center")

# Progressive sidebar loading: lazy posts sidebar endpoint
@rt("/_sidebar/posts")
def posts_sidebar_lazy():
    html = _cached_posts_sidebar_html(_posts_sidebar_fingerprint())
    return Aside(
        NotStr(html),
        cls="hidden md:block w-72 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]",
        id="posts-sidebar"
    )

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

def navbar(show_mobile_menus=False):
    """Navbar with mobile menu buttons for file tree and TOC"""
    left_section = Div(
        A(get_blog_title(), href="/"),
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
                cls="md:hidden p-2 hover:bg-slate-800 rounded transition-colors",
                type="button"
            ),
            Button(
                UkIcon("list", cls="w-5 h-5"),
                title="Toggle table of contents",
                id="mobile-toc-toggle",
                cls="md:hidden p-2 hover:bg-slate-800 rounded transition-colors",
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

@lru_cache(maxsize=1)
def _cached_posts_sidebar_html(fingerprint):
    sidebar = collapsible_sidebar(
        "menu",
        "Posts",
        get_posts(),
        is_open=False,
        data_sidebar="posts"
    )
    return to_xml(sidebar)

def collapsible_sidebar(icon, title, items_list, is_open=False, data_sidebar=None):
    """Reusable collapsible sidebar component with sticky header"""
    # Build the summary content
    summary_content = [
        UkIcon(icon, cls="w-5 h-5 mr-2"),
        Span(title, cls="flex-1")
    ]
    
    # Sidebar styling configuration
    common_frost_style = "bg-white/10 dark:bg-slate-950/70 backdrop-blur-lg border border-slate-900/20 dark:border-slate-700/20 shadow-lg"
    summary_classes = f"flex items-center font-semibold cursor-pointer py-2 px-3 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 rounded-lg select-none list-none {common_frost_style} min-h-[56px]"
    content_classes = f"p-3 {common_frost_style} rounded-lg border border-black dark:border-black overflow-y-auto max-h-[calc(100vh-18rem)]"
    
    return Details(
        Summary(*summary_content, cls=summary_classes, style="margin: 0 0 0.5rem 0;"),
        Div(
            Ul(*items_list, cls="list-none"),
            cls=content_classes,
            id="sidebar-scroll-container"
        ),
        open=is_open,
        data_sidebar=data_sidebar
    )

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
    for match in heading_pattern.finditer(content_no_code):
        level = len(match.group(1))
        text = match.group(2).strip()
        # Create anchor from heading text using shared function
        anchor = text_to_anchor(text)
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

def layout(*content, htmx, title=None, show_sidebar=False, toc_content=None, current_path=None):
    import time
    layout_start_time = time.time()
    logger.debug("[LAYOUT] layout() start")
    # Generate section class for CSS scoping (will be used by get_custom_css_links if needed)
    section_class = f"section-{current_path.replace('/', '-')}" if current_path else ""
    t_section = time.time()
    logger.debug(f"[LAYOUT] section_class computed in {(t_section - layout_start_time)*1000:.2f}ms")

    # HTMX short-circuit: build only swappable fragments, never build full page chrome/sidebars tree
    if htmx and getattr(htmx, "request", None):
        if show_sidebar:
            toc_items = build_toc_items(extract_toc(toc_content)) if toc_content else []
            t_toc = time.time()
            logger.debug(f"[LAYOUT] TOC built in {(t_toc - t_section)*1000:.2f}ms")

            toc_attrs = {
                "cls": "hidden md:block w-72 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]",
                "id": "toc-sidebar",
                "hx_swap_oob": "true",
            }
            toc_sidebar = Aside(
                collapsible_sidebar("list", "Contents", toc_items, is_open=False) if toc_items else Div(),
                **toc_attrs
            )

            custom_css_links = get_custom_css_links(current_path, section_class)
            t_css = time.time()
            logger.debug(f"[LAYOUT] Custom CSS resolved in {(t_css - t_toc)*1000:.2f}ms")

            main_content_container = Main(*content, cls=f"flex-1 min-w-0 px-6 py-8 space-y-8 {section_class}", id="main-content")
            t_main = time.time()
            logger.debug(f"[LAYOUT] Main content container built in {(t_main - t_css)*1000:.2f}ms")

            result = [Title(title)]
            if custom_css_links:
                result.append(Div(*custom_css_links, id="scoped-css-container", hx_swap_oob="true"))
            else:
                result.append(Div(id="scoped-css-container", hx_swap_oob="true"))
            result.extend([main_content_container, toc_sidebar])

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
        toc_items = build_toc_items(extract_toc(toc_content)) if toc_content else []
        t_toc = time.time()
        logger.debug(f"[LAYOUT] TOC built in {(t_toc - t_section)*1000:.2f}ms")
        # Right sidebar TOC component with out-of-band swap for HTMX
        toc_attrs = {
            "cls": "hidden md:block w-72 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]",
            "id": "toc-sidebar"
        }
        toc_sidebar = Aside(
            collapsible_sidebar("list", "Contents", toc_items, is_open=False) if toc_items else Div(),
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
                NotStr(_cached_posts_sidebar_html(_posts_sidebar_fingerprint())),
                cls="p-4 overflow-y-auto"
            ),
            id="mobile-posts-panel",
            cls="fixed inset-0 bg-white dark:bg-slate-950 z-[9999] md:hidden transform -translate-x-full transition-transform duration-300"
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
                collapsible_sidebar("list", "Contents", toc_items, is_open=False) if toc_items else Div(P("No table of contents available.", cls="text-slate-500 dark:text-slate-400 text-sm p-4")),
                cls="p-4 overflow-y-auto"
            ),
            id="mobile-toc-panel",
            cls="fixed inset-0 bg-white dark:bg-slate-950 z-[9999] md:hidden transform translate-x-full transition-transform duration-300"
        )
        # Full layout with all sidebars
        content_with_sidebars = Div(cls="w-full max-w-7xl mx-auto px-4 flex gap-6 flex-1")(
            # Left sidebar - lazy load with HTMX, show loader placeholder
            Aside(
                Div(
                    UkIcon("loader", cls="w-5 h-5 animate-spin"),
                    Span("Loading posts…", cls="ml-2 text-sm"),
                    cls="flex items-center justify-center h-32 text-slate-400"
                ),
                cls="hidden md:block w-72 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]",
                id="posts-sidebar",
                hx_get="/_sidebar/posts",
                hx_trigger="load",
                hx_swap="outerHTML"
            ),
            # Main content (swappable)
            main_content_container,
            # Right sidebar - TOC (swappable out-of-band)
            toc_sidebar
        )
        t_sidebars = time.time()
        logger.debug(f"[LAYOUT] Sidebars container built in {(t_sidebars - t_main)*1000:.2f}ms")
        # Layout with sidebar for blog posts
        body_content = Div(id="page-container", cls="flex flex-col min-h-screen")(
            Div(navbar(show_mobile_menus=True), cls="w-full max-w-7xl mx-auto px-4 sticky top-0 z-50 mt-4"),
            mobile_posts_panel,
            mobile_toc_panel,
            content_with_sidebars,
            Footer(Div(f"Powered by Bloggy", cls="bg-slate-900 text-white rounded-lg p-4 my-4 dark:bg-slate-800 text-right"), # right justified footer
                   cls="w-full max-w-7xl mx-auto px-6 mt-auto mb-6")
        )
    else:
        # Default layout without sidebar
        custom_css_links = get_custom_css_links(current_path, section_class) if current_path else []
        body_content = Div(id="page-container", cls="flex flex-col min-h-screen")(
            Div(navbar(), cls="w-full max-w-2xl mx-auto px-4 sticky top-0 z-50 mt-4"),
            Main(*content, cls="w-full max-w-2xl mx-auto px-6 py-8 space-y-8", id="main-content"),
            Footer(Div("Powered by Bloggy", cls="bg-slate-900 text-white rounded-lg p-4 my-4 dark:bg-slate-800 text-right"), 
                   cls="w-full max-w-2xl mx-auto px-6 mt-auto mb-6")
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

def build_post_tree(folder):
    import time
    start_time = time.time()
    root = get_root_folder()
    items = []
    try: 
        entries = sorted(folder.iterdir(), key=lambda x: (not x.is_dir(), x.name))
        logger.debug(f"[DEBUG] Scanning directory: {folder.relative_to(root) if folder != root else '.'} - found {len(entries)} entries")
    except (OSError, PermissionError): 
        return items
    
    for item in entries:
        if item.is_dir():
            if item.name.startswith('.'): continue
            sub_items = build_post_tree(item)
            if sub_items:
                folder_title = slug_to_title(item.name)
                items.append(Li(Details(
                    Summary(
                        Span(UkIcon("chevron-right", cls="folder-chevron w-4 h-4 text-slate-400"), cls="w-4 mr-1 flex items-center justify-center shrink-0"),
                        Span(UkIcon("folder", cls="text-blue-500 w-4 h-4"), cls="w-4 mr-1 flex items-center justify-center shrink-0"),
                        Span(folder_title, cls="truncate min-w-0", title=folder_title),
                        cls="flex items-center font-medium cursor-pointer py-1 px-2 hover:text-blue-600 select-none list-none rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-w-0"),
                    Ul(*sub_items, cls="ml-2 pl-2 space-y-1 border-l border-slate-100 dark:border-slate-800"), open=False), cls="my-1"))
        elif item.suffix == '.md':
            # Skip the file being used for home page (index.md takes precedence over readme.md)
            if item.parent == root:
                index_file = find_index_file()
                if index_file and item.resolve() == index_file.resolve():
                    continue
            
            slug = str(item.relative_to(root).with_suffix(''))
            title_start = time.time()
            title = get_post_title(item)
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
    
    elapsed = (time.time() - start_time) * 1000
    logger.debug(f"[DEBUG] build_post_tree for {folder.relative_to(root) if folder != root else '.'} completed in {elapsed:.2f}ms")
    return items

def _posts_tree_fingerprint():
    root = get_root_folder()
    try:
        return max((p.stat().st_mtime for p in root.rglob("*.md")), default=0)
    except Exception:
        return 0

@lru_cache(maxsize=1)
def _cached_build_post_tree(fingerprint):
    return build_post_tree(get_root_folder())

def get_posts():
    fingerprint = _posts_tree_fingerprint()
    return _cached_build_post_tree(fingerprint)

def not_found(htmx=None):
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
    result = layout(content, htmx=htmx, title=f"404 - Page Not Found | {blog_title}", show_sidebar=True)
    return result

@rt('/posts/{path:path}')
def post_detail(path: str, htmx):
    import time
    request_start = time.time()
    logger.info(f"\n[DEBUG] ########## REQUEST START: /posts/{path} ##########")
    
    file_path = get_root_folder() / f'{path}.md'
    
    # Check if file exists
    if not file_path.exists():
        return not_found(htmx)
    
    metadata, raw_content = parse_frontmatter(file_path)
    
    # Get title from frontmatter or filename
    post_title = metadata.get('title', slug_to_title(path.split('/')[-1]))
    
    # Render the markdown content with current path for relative link resolution
    md_start = time.time()
    content = from_md(raw_content, current_path=path)
    md_time = (time.time() - md_start) * 1000
    logger.debug(f"[DEBUG] Markdown rendering took {md_time:.2f}ms")
    
    post_content = Div(H1(post_title, cls="text-4xl font-bold mb-8"), content)
    
    # Always return complete layout with sidebar and TOC
    layout_start = time.time()
    result = layout(post_content, htmx=htmx, title=f"{post_title} - {get_blog_title()}", 
                  show_sidebar=True, toc_content=raw_content, current_path=path)
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
def index(htmx):
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
                      show_sidebar=True, toc_content=raw_content, current_path=index_path)
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
            cls="w-full"), htmx=htmx, title=f"Home - {blog_title}", show_sidebar=True)
        layout_time = (time.time() - layout_start) * 1000
        logger.debug(f"[DEBUG] Layout generation took {layout_time:.2f}ms")
        
        total_time = (time.time() - request_start) * 1000
        logger.debug(f"[DEBUG] ########## REQUEST COMPLETE: {total_time:.2f}ms TOTAL ##########\n")
        
        return result

# Catch-all route for 404 pages (must be last)
@rt('/{path:path}')
def catch_all(path: str, htmx):
    """Catch-all route for undefined URLs"""
    return not_found(htmx)
