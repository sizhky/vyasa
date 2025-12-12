import re, frontmatter, mistletoe as mst, pathlib, os
from functools import partial
from pathlib import Path
from fasthtml.common import *
from fasthtml.jupyter import *
from monsterui.all import *
from starlette.staticfiles import StaticFiles

# Markdown rendering setup
try: FrankenRenderer
except NameError:
    class FrankenRenderer(mst.HTMLRenderer):
        def __init__(self, *args, img_dir=None, **kwargs):
            super().__init__(*args, **kwargs)
            self.img_dir = img_dir
        def render_image(self, token):
            tpl = '<img src="{}" alt="{}"{} class="max-w-full h-auto rounded-lg mb-6">'
            title = f' title="{token.title}"' if hasattr(token, 'title') else ''
            src = token.src
            if self.img_dir and not src.startswith(('http://', 'https://', '/', 'attachment:', 'blob:', 'data:')):
                src = f'{pathlib.Path(self.img_dir)}/{src}'
            return tpl.format(src, token.children[0].content if token.children else '', title)

def span_token(name, pat, attr, prec=5):
    class T(mst.span_token.SpanToken):
        precedence,parse_inner,parse_group,pattern = prec,False,1,re.compile(pat)
        def __init__(self, match): setattr(self, attr, match.group(1))
    T.__name__ = name
    return T

FootnoteRef = span_token('FootnoteRef', r'\[\^([^\]]+)\](?!:)', 'target')

def extract_footnotes(content):
    pat = re.compile(r'^\[\^([^\]]+)\]:\s*(.+?)(?=(?:^|\n)\[\^|\n\n|\Z)', re.MULTILINE | re.DOTALL)
    defs = {m.group(1): m.group(2).strip() for m in pat.finditer(content)}
    for m in pat.finditer(content): content = content.replace(m.group(0), '', 1)
    return content.strip(), defs

class ContentRenderer(FrankenRenderer):
    def __init__(self, *extras, img_dir=None, footnotes=None, **kwargs):
        super().__init__(*extras, img_dir=img_dir, **kwargs)
        self.footnotes, self.fn_counter = footnotes or {}, 0
    
    def render_footnote_ref(self, token):
        self.fn_counter += 1
        n, target = self.fn_counter, token.target
        content = self.footnotes.get(target, f"[Missing footnote: {target}]")
        rendered = mst.markdown(content, partial(ContentRenderer, img_dir=self.img_dir)).strip()
        if rendered.startswith('<p>') and rendered.endswith('</p>'): rendered = rendered[3:-4]
        style = "text-sm leading-relaxed border-l-2 border-amber-400 dark:border-blue-400 pl-3 text-neutral-500 dark:text-neutral-400 transition-all duration-500 w-full my-2 xl:my-0"
        toggle = f"on click if window.innerWidth >= 1280 then add .hl to #sn-{n} then wait 1s then remove .hl from #sn-{n} else toggle .open on me then toggle .show on #sn-{n}"
        ref = Span(id=f"snref-{n}", role="doc-noteref", aria_label=f"Sidenote {n}", cls="sidenote-ref cursor-pointer", _=toggle)
        note = Span(NotStr(rendered), id=f"sn-{n}", role="doc-footnote", aria_labelledby=f"snref-{n}", cls=f"sidenote {style}")
        hide = lambda c: to_xml(Span(c, cls="hidden", aria_hidden="true"))
        return hide(" (") + to_xml(ref) + to_xml(note) + hide(")")

    def render_block_code(self, token):
        lang = getattr(token, 'language', '')
        code = self.render_raw_text(token)
        if lang == 'mermaid':
            # Extract frontmatter from mermaid code block
            frontmatter_pattern = r'^---\s*\n(.*?)\n---\s*\n'
            frontmatter_match = re.match(frontmatter_pattern, code, re.DOTALL)
            
            height = 'auto'
            width = '100%'
            min_height = '400px'
            break_out = False
            
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
                        # If width uses viewport units, break out of container
                        if 'vw' in str(width):
                            break_out = True
                except Exception as e:
                    print(f"Error parsing mermaid frontmatter: {e}")
                
                # Use code without frontmatter for rendering
                code = code_without_frontmatter
            
            diagram_id = f"mermaid-{hash(code) & 0xFFFFFF}"
            
            # If we need to break out, use viewport-based positioning
            container_style = f"width: {width};"
            if break_out:
                container_style = f"width: {width}; position: relative; left: 50%; transform: translateX(-50%);"
            
            # Escape the code for use in data attribute
            escaped_code = code.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&#39;')
            
            return f'''<div class="mermaid-container relative border-2 rounded-md my-4" style="{container_style}">
                <div class="mermaid-controls absolute top-2 right-2 z-10 flex gap-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded">
                    <button onclick="resetMermaidZoom('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Reset zoom">Reset</button>
                    <button onclick="zoomMermaidIn('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Zoom in">+</button>
                    <button onclick="zoomMermaidOut('{diagram_id}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Zoom out">−</button>
                </div>
                <div id="{diagram_id}" class="mermaid-wrapper p-4 overflow-hidden flex justify-center items-center" style="min-height: {min_height}; height: {height};" data-mermaid-code="{escaped_code}"><pre class="mermaid" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">{code}</pre></div>
            </div>'''
        return super().render_block_code(token)
    
    def render_link(self, token):
        href, inner, title = token.target, self.render_inner(token), f' title="{token.title}"' if token.title else ''
        is_internal = href.startswith('/') and not href.startswith('//') and '.' not in href.split('/')[-1]
        hx = f' hx-get="{href}" hx-target="#main-content" hx-push-url="true" hx-swap="innerHTML show:window:top"' if is_internal else ''
        ext = '' if is_internal else ' target="_blank" rel="noopener noreferrer"'
        return f'<a href="{href}"{hx}{ext} class="text-primary underline"{title}>{inner}</a>'


def from_md(content, img_dir='/static/images'):
    content, footnotes = extract_footnotes(content)
    mods = {'pre': 'my-4', 'p': 'text-base leading-relaxed mb-6', 'li': 'text-base leading-relaxed',
            'ul': 'uk-list uk-list-bullet space-y-2 mb-6 ml-6 text-base', 'ol': 'uk-list uk-list-decimal space-y-2 mb-6 ml-6 text-base', 
            'hr': 'border-t border-border my-8', 'h1': 'text-3xl font-bold mb-6 mt-8', 'h2': 'text-2xl font-semibold mb-4 mt-6', 
            'h3': 'text-xl font-semibold mb-3 mt-5', 'h4': 'text-lg font-semibold mb-2 mt-4'}
    html = mst.markdown(content, partial(ContentRenderer, FootnoteRef, img_dir=img_dir, footnotes=footnotes))
    return Div(Link(rel="stylesheet", href="/static/sidenote.css"), NotStr(apply_classes(html, class_map_mods=mods)), cls="w-full")

# App configuration
def get_root_folder(): return Path(os.getenv('BLOGGY_ROOT', '.')).resolve()
hdrs = (
    *Theme.slate.headers(highlightjs=True),
    Link(rel="icon", href="/static/favicon.png"),
    Script(src="https://unpkg.com/hyperscript.org@0.9.12"),
    Script(src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs", type="module"),
    Script(src="/static/scripts.js", type='module'),
    Link(rel="preconnect", href="https://fonts.googleapis.com"), 
    Link(rel="preconnect", href="https://fonts.gstatic.com", crossorigin=""),
    Link(rel="stylesheet", href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono&display=swap"),
    Style("body { font-family: 'IBM Plex Sans', sans-serif; } code, pre { font-family: 'IBM Plex Mono', monospace; }"),
    Style(".folder-chevron { transition: transform 0.2s; display: inline-block; } details[open] > summary > .folder-chevron { transform: rotate(90deg); } details { border: none !important; box-shadow: none !important; }"),
    Script("if(!localStorage.__FRANKEN__) localStorage.__FRANKEN__ = JSON.stringify({mode: 'light'})"))

app = FastHTML(hdrs=hdrs)
static_dir = Path(__file__).parent / "static"
if static_dir.exists(): app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
rt = app.route

def theme_toggle():
    theme_script = """on load set franken to (localStorage's __FRANKEN__ or '{}') as Object
                if franken's mode is 'dark' then add .dark to <html/> end
                on click toggle .dark on <html/>
                set franken to (localStorage's __FRANKEN__ or '{}') as Object
                if the first <html/> matches .dark set franken's mode to 'dark' else set franken's mode to 'light' end
                set localStorage's __FRANKEN__ to franken as JSON"""
    return Button(UkIcon("moon", cls="dark:hidden"), UkIcon("sun", cls="hidden dark:block"), 
                  _=theme_script, cls="p-1 hover:scale-110 shadow-none", type="button")

def navbar():
    return Div(A("Bloggy", href="/"), theme_toggle(),
               cls="flex items-center justify-between bg-slate-900 text-white p-4 my-4 rounded-lg shadow-md dark:bg-slate-800")

def layout(*content, htmx, title=None):
    if htmx and htmx.request: return (Title(title), *content)
    return Title(title), Div(cls="flex flex-col min-h-screen")(
        Div(navbar(), cls="w-full max-w-2xl mx-auto px-4 sticky top-0 z-50 mt-4"),
        Main(*content, cls="w-full max-w-2xl mx-auto px-6 py-8 space-y-8", id="main-content"),
        Footer(Div("Powered by Bloggy", cls="bg-slate-900 text-white rounded-lg p-4 my-4 dark:bg-slate-800"), 
               cls="w-full max-w-2xl mx-auto px-6 mt-auto mb-6")
    )

def build_post_tree(folder):
    root = get_root_folder()
    items = []
    try: entries = sorted(folder.iterdir(), key=lambda x: (not x.is_dir(), x.name))
    except (OSError, PermissionError): return items
    
    for item in entries:
        if item.is_dir():
            if item.name.startswith('.'): continue
            sub_items = build_post_tree(item)
            if sub_items:
                items.append(Li(Details(
                    Summary(UkIcon("chevron-right", cls="folder-chevron w-4 h-4 mr-1 text-slate-400"),
                           Span(UkIcon("folder", cls="text-blue-500"), cls="w-5 flex justify-center mr-2"),
                           item.name, cls="flex items-center font-medium cursor-pointer py-1 px-2 hover:text-blue-600 select-none list-none rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"),
                    Ul(*sub_items, cls="ml-6 pl-2 space-y-1 border-l border-slate-100 dark:border-slate-800"), open=False), cls="my-1"))
        elif item.suffix == '.md':
            slug = str(item.relative_to(root).with_suffix(''))
            items.append(Li(A(Div(Span(cls="w-4 mr-1"), Span(UkIcon("file-text", cls="text-slate-400"), cls="w-5 flex justify-center mr-2"),
                item.stem, cls="flex items-center"), href=f'/posts/{slug}', 
                cls="block py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors")))
    return items

def get_posts(): return build_post_tree(get_root_folder())

@rt('/posts/{path:path}')
def post_detail(path: str, htmx):
    file_path = get_root_folder() / f'{path}.md'
    content = from_md(open(file_path).read())
    return layout(H1(f"Post: {path}", cls="text-4xl font-bold"), content, htmx=htmx, title=f"{path} - Bloggy")

@rt
def index(htmx):
    return layout(Div(
        H1("Welcome to Bloggy!", cls="text-4xl font-bold tracking-tight mb-2"),
        P("Your personal blogging platform.", cls="text-lg text-slate-600 dark:text-slate-400 mb-8"),
        Card(Div(H2("Posts", cls="text-xl font-semibold mb-2"), Hr(), cls="border-b border-slate-100 dark:border-slate-700"),
             Ul(*get_posts(), cls="mt-0 pt-0 list-none", style="margin-top:1rem;"),
             cls="p-6 shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-slate-900 rounded-lg"),
        cls="w-full"), htmx=htmx, title="Home - Bloggy")
