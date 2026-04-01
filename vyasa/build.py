"""Static site generator for Vyasa

This module provides functionality to convert a folder of markdown files
into a standalone static website with HTML, CSS, and JavaScript files.
"""

from pathlib import Path
import shutil
from functools import partial
import mistletoe as mst
from fasthtml.common import *
from monsterui.all import *
from .helpers import (
    _effective_abbreviations, _effective_ignore_list,
    _effective_include_list, _should_include_folder, _strip_inline_markdown,
    _unique_anchor, estimate_read_time_minutes, find_folder_note_file,
    get_adjacent_posts, get_post_title, parse_frontmatter, resolve_markdown_title, slug_to_title,
    text_to_anchor,
)
from .markdown_pipeline import extract_footnotes, preprocess_super_sub
from .markdown_rendering import ContentRenderer, from_md
from .markdown_tabs import preprocess_tabs
from .sidebar_helpers import build_toc_items, extract_toc
from .config import get_config, reload_config
from .assets import asset_url
from .favicon import favicon_href as resolve_favicon_href, write_generated_favicon
from .tree_service import get_tree_entries

_asset_url = asset_url

def generate_static_html(title, body_content, blog_title, favicon_href):
    """Generate complete static HTML page"""
    
    # Static CSS (inline critical styles)
    static_css = """
    <style>
        body { font-family: 'IBM Plex Sans', sans-serif; margin: 0; padding: 0; }
        code, pre { font-family: 'IBM Plex Mono', monospace; }
        .folder-chevron {
            display: inline-block;
            width: 0.45rem;
            height: 0.45rem;
            border-right: 2px solid rgb(148 163 184);
            border-bottom: 2px solid rgb(148 163 184);
            transform: rotate(-45deg);
            transition: transform 0.2s;
        }
        details.is-open > summary .folder-chevron { transform: rotate(45deg); }
        details { border: none !important; box-shadow: none !important; }
        h1, h2, h3, h4, h5, h6 { scroll-margin-top: 7rem; }
        
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
        :root { --vyasa-code-bg: #e1e2e7; --vyasa-code-fg: #3760bf; --vyasa-code-border: rgba(55, 96, 191, 0.16); --vyasa-code-highlight-bg: rgba(245, 42, 101, 0.16); --vyasa-code-highlight-accent: #f52a65; --vyasa-code-comment: #848cb5; --vyasa-code-keyword: #9854f1; --vyasa-code-string: #587539; --vyasa-code-title: #2e7de9; --vyasa-code-number: #b15c00; }
        .dark { --vyasa-code-bg: #1a1b26; --vyasa-code-fg: #d5d6db; --vyasa-code-border: rgba(122, 162, 247, 0.16); --vyasa-code-highlight-bg: rgba(247, 118, 142, 0.18); --vyasa-code-highlight-accent: #f7768e; --vyasa-code-comment: #848cb5; --vyasa-code-keyword: #bb9af7; --vyasa-code-string: #9ece6a; --vyasa-code-title: #7dcfff; --vyasa-code-number: #ff9e64; }
        .vyasa-callout { --vyasa-callout-accent: rgb(37 99 235); background: linear-gradient(180deg, rgba(248, 250, 252, 0.9), rgba(241, 245, 249, 0.95)); border-color: rgba(148, 163, 184, 0.35); border-left: 4px solid var(--vyasa-callout-accent); box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06); }
        .dark .vyasa-callout { background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.96)); border-color: rgba(148, 163, 184, 0.2); box-shadow: 0 14px 34px rgba(2, 6, 23, 0.35); }
        .vyasa-callout-summary { list-style: none; }
        .vyasa-callout-summary::-webkit-details-marker { display: none; }
        .vyasa-callout-summary .vyasa-callout-head { cursor: pointer; }
        .vyasa-callout-head-with-body { margin-bottom: 0.75rem; }
        .vyasa-callout-icon { color: var(--vyasa-callout-accent); display: inline-flex; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; flex: 0 0 1.25rem; overflow: visible; }
        .vyasa-callout-icon svg, .vyasa-callout-icon uk-icon { width: 1.125rem; height: 1.125rem; overflow: visible; stroke-linecap: round; stroke-linejoin: round; }
        .vyasa-callout-chevron { margin-left: auto; width: 0.55rem; height: 0.55rem; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); transition: transform 160ms ease; opacity: 0.65; }
        details[open] > .vyasa-callout-summary .vyasa-callout-chevron { transform: rotate(45deg); }
        .vyasa-callout-label { color: rgb(15 23 42); }
        .dark .vyasa-callout-label { color: rgb(226 232 240); }
        .vyasa-callout-body .vyasa-callout { position: relative; margin-top: 1rem; margin-bottom: 0; margin-left: 1.25rem; }
        .vyasa-callout-body .vyasa-callout::before { content: ""; position: absolute; left: -0.875rem; top: 0.55rem; bottom: -0.25rem; width: 2px; border-radius: 999px; background: linear-gradient(180deg, color-mix(in srgb, var(--vyasa-callout-accent) 35%, transparent), color-mix(in srgb, var(--vyasa-callout-accent) 10%, transparent)); opacity: 0.8; }
        .vyasa-callout-body .vyasa-callout:last-child::before { bottom: 0.75rem; }
        .vyasa-callout-body > *:first-child { margin-top: 0 !important; }
        .vyasa-callout-body > *:last-child { margin-bottom: 0 !important; }
        .vyasa-callout-note, .vyasa-callout-info, .vyasa-callout-abstract { --vyasa-callout-accent: rgb(37 99 235); }
        .vyasa-callout-tip, .vyasa-callout-success, .vyasa-callout-todo { --vyasa-callout-accent: rgb(22 163 74); }
        .vyasa-callout-warning, .vyasa-callout-important, .vyasa-callout-question { --vyasa-callout-accent: rgb(217 119 6); }
        .vyasa-callout-failure, .vyasa-callout-danger, .vyasa-callout-bug { --vyasa-callout-accent: rgb(220 38 38); }
        .vyasa-callout-example, .vyasa-callout-quote { --vyasa-callout-accent: rgb(124 58 237); }
        .vyasa-code-lines { display: block; white-space: normal !important; }
        .vyasa-code-line { display: block; white-space: pre; margin: 0 -1rem; padding: 0 1rem; }
        .code-block .vyasa-code-line-highlight { background: var(--vyasa-code-highlight-bg); box-shadow: inset 6px 0 0 var(--vyasa-code-highlight-accent); }
        .code-block pre, .code-block pre code, pre code.hljs { background: var(--vyasa-code-bg); color: var(--vyasa-code-fg); }
        .code-block pre code, pre code.hljs { line-height: 1.2; }
        .code-block pre { border: 1px solid var(--vyasa-code-border); border-radius: 12px; }
        .hljs-comment, .hljs-quote { color: var(--vyasa-code-comment); }
        .hljs-keyword, .hljs-selector-tag, .hljs-literal { color: var(--vyasa-code-keyword); }
        .hljs-string, .hljs-doctag, .hljs-regexp { color: var(--vyasa-code-string); }
        .hljs-title, .hljs-title.function_, .hljs-section, .hljs-attribute { color: var(--vyasa-code-title); }
        .hljs-number, .hljs-symbol, .hljs-variable, .hljs-template-variable, .hljs-type, .hljs-built_in { color: var(--vyasa-code-number); }
        .vyasa-prev-next { display:flex; justify-content:space-between; gap:1rem; margin-top:3rem; padding-top:1.5rem; border-top:1px solid rgba(148, 163, 184, 0.28); }
        .vyasa-prev-link, .vyasa-next-link { max-width:48%; text-decoration:none; color:rgb(59 130 246); font-weight:600; }
        .vyasa-next-link { text-align:right; margin-left:auto; }
        .vyasa-prev-link:hover, .vyasa-next-link:hover { text-decoration:underline; }
    </style>
    """
    
    # JavaScript for interactivity
    static_js = """
    <script>
        // Theme toggle functionality
        (function() {
            const stored = localStorage.getItem('__FRANKEN__');
            const franken = stored ? JSON.parse(stored) : {mode: 'light'};
            if (franken.mode === 'dark') {
                document.documentElement.classList.add('dark');
            }
        })();
        
        function toggleTheme() {
            const html = document.documentElement;
            html.classList.toggle('dark');
            const stored = localStorage.getItem('__FRANKEN__');
            const franken = stored ? JSON.parse(stored) : {mode: 'light'};
            franken.mode = html.classList.contains('dark') ? 'dark' : 'light';
            localStorage.setItem('__FRANKEN__', JSON.stringify(franken));
        }
        
        // Tab switching functionality
        function switchTab(tabsId, index) {
            const container = document.querySelector('.tabs-container[data-tabs-id="' + tabsId + '"]');
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
                    
                    const tabsContent = container.querySelector('.tabs-content');
                    if (tabsContent && maxHeight > 0) {
                        tabsContent.style.minHeight = maxHeight + 'px';
                    }
                });
            }, 100);
            
            function replaceEscapedDollarPlaceholders(root) {
                const placeholder = '@@VYASA_DOLLAR@@';
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

            // Initialize KaTeX rendering
            if (window.renderMathInElement) {
                renderMathInElement(document.body, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false}
                    ],
                    throwOnError: false
                });
            }
            replaceEscapedDollarPlaceholders(document.body);
        });
        
        // Sidenote interactions
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('sidenote-ref')) {
                const id = e.target.id.replace('snref-', 'sn-');
                const sidenote = document.getElementById(id);
                if (sidenote) {
                    if (window.innerWidth >= 1280) {
                        sidenote.classList.add('hl');
                        setTimeout(() => sidenote.classList.remove('hl'), 1000);
                    } else {
                        e.target.classList.toggle('open');
                        sidenote.classList.toggle('show');
                    }
                }
            }
        });
    </script>
    """
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    
    <!-- TailwindCSS and MonsterUI -->
    <script src="https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio,container-queries"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/uikit@3.16.14/dist/css/uikit.min.css" />
    <script src="https://cdn.jsdelivr.net/npm/uikit@3.16.14/dist/js/uikit.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/uikit@3.16.14/dist/js/uikit-icons.min.js"></script>
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono&display=swap" rel="stylesheet">
    
    <!-- Syntax Highlighting -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    
    <!-- Math Rendering -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
    
    <!-- Hyperscript for interactions -->
    <script src="https://unpkg.com/hyperscript.org@0.9.12"></script>
    
    <!-- Static assets -->
    <link rel="icon" href="{favicon_href}">
    <link rel="stylesheet" href="{_asset_url('/static/sidenote.css')}">
    
    {static_css}
</head>
<body>
    {body_content}
    
    <!-- Mermaid diagrams -->
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
        mermaid.initialize({{ startOnLoad: true, theme: 'default' }});
    </script>
    <script src="{_asset_url('/static/scripts.js')}" type="module"></script>
    
    {static_js}
</body>
</html>"""
    
    return html


def build_post_tree_static(folder, root_folder, show_hidden=False):
    """Build post tree with static .html links instead of HTMX"""
    items = []
    try:
        entries = get_tree_entries(folder, root_folder, show_hidden, set(), ('.md',))
        abbreviations = _effective_abbreviations(root_folder, folder)
    except (OSError, PermissionError): 
        return items
    
    for item in entries:
        if item.is_dir():
            if not show_hidden and item.name.startswith('.'): 
                continue
            sub_items = build_post_tree_static(item, root_folder, show_hidden=show_hidden)
            folder_title = slug_to_title(item.name, abbreviations=abbreviations)
            note_file = find_folder_note_file(item)
            note_link = None
            note_slug = None
            if note_file:
                note_slug = str(note_file.relative_to(root_folder).with_suffix(''))
                note_link = A(
                    href=f'/posts/{note_slug}.html',
                    cls="folder-note-link truncate min-w-0 hover:underline",
                    title=f"Open: {folder_title}",
                    onclick="event.stopPropagation();",
                )(folder_title)
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
            elif note_file and note_slug:
                title_text = Span(folder_title, cls="truncate min-w-0", title=folder_title)
                items.append(Li(A(
                    Span(cls="w-4 mr-2 shrink-0"),
                    Span(UkIcon("folder", cls="text-blue-500 w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
                    title_text,
                    href=f'/posts/{note_slug}.html',
                    cls="flex items-center py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors min-w-0")))
        elif item.suffix == '.md':
            slug = str(item.relative_to(root_folder).with_suffix(''))
            title = get_post_title(item, abbreviations=abbreviations)
            
            # Use .html extension for static links
            items.append(Li(A(
                Span(cls="w-4 mr-2 shrink-0"),
                Span(UkIcon("file-text", cls="text-slate-400 w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
                Span(title, cls="truncate min-w-0", title=title),
                href=f'/posts/{slug}.html',  # Add .html extension
                cls="flex items-center py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors min-w-0")))
    return items


def static_layout(content_html, blog_title, page_title, nav_tree, favicon_href, toc_items=None, current_path=None):
    """Generate complete static page layout"""
    
    # Theme toggle button
    theme_toggle = '''
    <button onclick="toggleTheme()" class="p-1 hover:scale-110 shadow-none" type="button">
        <span uk-icon="moon" class="dark:hidden"></span>
        <span uk-icon="sun" class="hidden dark:block"></span>
    </button>
    '''
    
    # Navbar
    navbar = f'''
    <div class="vyasa-navbar-card bg-slate-900 text-white p-4 my-4 rounded-lg shadow-md dark:bg-slate-800">
        <div class="flex items-center justify-between md:hidden">
            <button id="mobile-posts-toggle" title="Toggle file tree" class="p-2 rounded transition-colors hover:bg-slate-800" type="button">
                <span uk-icon="menu" class="w-5 h-5"></span>
            </button>
            <a href="/index.html" class="flex-1 px-4 text-center truncate">{blog_title}</a>
            <div class="flex items-center gap-1">
                <button id="mobile-toc-toggle" title="Toggle table of contents" class="p-2 rounded transition-colors hover:bg-slate-800" type="button">
                    <span uk-icon="list" class="w-5 h-5"></span>
                </button>
                {theme_toggle}
            </div>
        </div>
        <div class="hidden md:flex items-center justify-between">
            <a href="/index.html">{blog_title}</a>
            {theme_toggle}
        </div>
    </div>
    '''
    
    # Build navigation sidebar
    nav_html = to_xml(Ul(*nav_tree, cls="mt-2 list-none"))
    posts_sidebar = f'''
    <aside id="posts-sidebar" class="vyasa-sidebar vyasa-posts-sidebar hidden md:block w-64 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]">
        <details open class="vyasa-sidebar-card vyasa-sidebar-card-posts">
            <summary class="vyasa-sidebar-toggle vyasa-sidebar-toggle-posts flex items-center font-semibold cursor-pointer py-2 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg select-none list-none bg-white dark:bg-slate-950 z-10">
                <span uk-icon="menu" class="w-5 h-5 mr-2"></span>
                Posts
            </summary>
            <div class="vyasa-sidebar-body vyasa-sidebar-body-posts mt-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[calc(100vh-16rem)]">
                {nav_html}
            </div>
        </details>
    </aside>
    '''
    
    # Build TOC sidebar
    toc_html = ""
    if toc_items:
        toc_list_html = to_xml(Ul(*toc_items, cls="mt-2 list-none"))
        toc_html = f'''
        <aside id="toc-sidebar" class="vyasa-sidebar vyasa-toc-sidebar hidden md:block w-64 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]">
            <details open class="vyasa-sidebar-card vyasa-sidebar-card-table-of-contents">
                <summary class="vyasa-sidebar-toggle vyasa-sidebar-toggle-table-of-contents flex items-center font-semibold cursor-pointer py-2 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg select-none list-none bg-white dark:bg-slate-950 z-10">
                    <span uk-icon="list" class="w-5 h-5 mr-2"></span>
                    Table of Contents
                </summary>
                <div class="vyasa-sidebar-body vyasa-sidebar-body-table-of-contents mt-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[calc(100vh-16rem)]">
                    {toc_list_html}
                </div>
            </details>
        </aside>
        '''
    
    # Main content area
    main_content = f'''
    <main id="main-content" class="vyasa-main-shell flex-1 min-w-0 px-6 py-8 space-y-8">
        {content_html}
    </main>
    '''
    
    # Footer
    footer = '''
    <footer class="vyasa-footer-shell w-full max-w-7xl mx-auto px-6 mt-auto mb-6">
        <div class="vyasa-footer-card bg-slate-900 text-white rounded-lg p-4 my-4 dark:bg-slate-800 text-right">
            Powered by Vyasa
        </div>
    </footer>
    '''
    
    # Complete body
    body = f'''
    <div id="page-container" class="flex flex-col min-h-screen">
        <div class="vyasa-navbar-shell w-full max-w-7xl mx-auto px-4 sticky top-0 z-50 mt-4">
            {navbar}
        </div>
        <div id="content-with-sidebars" class="vyasa-content-grid w-full max-w-7xl mx-auto px-4 flex gap-6 flex-1">
            {posts_sidebar}
            {main_content}
            {toc_html}
        </div>
        {footer}
    </div>
    '''
    
    return generate_static_html(page_title, body, blog_title, favicon_href)


def build_static_site(input_dir=None, output_dir=None):
    """
    Build a complete static site from markdown files
    
    Args:
        input_dir: Path to markdown files (defaults to VYASA_ROOT or current dir)
        output_dir: Path to output directory (defaults to ./dist)
    """
    
    # Initialize config
    if input_dir:
        import os
        os.environ['VYASA_ROOT'] = str(Path(input_dir).resolve())
        reload_config()
    
    config = get_config()
    root_folder = config.get_root_folder()
    blog_title = config.get_blog_title()
    show_hidden = config.get_show_hidden()
    abbreviations = _effective_abbreviations(root_folder)
    
    # Set default output directory
    if output_dir is None:
        output_dir = Path.cwd() / 'dist'
    else:
        output_dir = Path(output_dir)
    
    print(f"Building static site...")
    print(f"  Source: {root_folder}")
    print(f"  Output: {output_dir}")
    print(f"  Blog title: {blog_title}")
    
    # Create output directory
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Build navigation tree with static .html links
    nav_tree = build_post_tree_static(root_folder, root_folder, show_hidden=show_hidden)
    root_icon = root_folder / "static" / "icon.png"
    favicon_href = resolve_favicon_href(root_folder)
    
    # Find all markdown files (only in the specified root folder, not parent directories)
    ignore_list = _effective_ignore_list(root_folder)
    include_list = _effective_include_list(root_folder)
    md_files = []
    for md_file in root_folder.rglob('*.md'):
        # Only include files that are actually inside root_folder
        try:
            relative_path = md_file.relative_to(root_folder)
            if not show_hidden and any(part.startswith('.') for part in relative_path.parts):
                continue
            # Check if any folder in path should be excluded
            path_parts = relative_path.parts[:-1]  # Exclude filename
            should_skip = False
            for part in path_parts:
                if not _should_include_folder(part, include_list, ignore_list):
                    should_skip = True
                    break
            if should_skip:
                continue
            md_files.append(md_file)
        except ValueError:
            # Skip files outside root_folder
            continue
    
    print(f"\nFound {len(md_files)} markdown files")
    
    # Process each markdown file
    for md_file in md_files:
        relative_path = md_file.relative_to(root_folder)
        print(f"  Processing: {relative_path}")
        
        # Parse frontmatter and content
        metadata, raw_content = parse_frontmatter(md_file)
        post_title, render_content = resolve_markdown_title(md_file, abbreviations=abbreviations)
        
        # Render markdown to HTML
        content_div = from_md(render_content, current_path=str(relative_path))
        read_time = estimate_read_time_minutes(render_content)
        title_html = f'<div class="mb-8"><h1 class="text-4xl font-bold">{post_title}</h1><p class="vyasa-read-time text-sm text-slate-500 dark:text-slate-400 mt-2">{read_time}-min read</p></div>'
        content_html = title_html + to_xml(content_div)
        
        # Extract TOC
        toc_headings = extract_toc(raw_content, _strip_inline_markdown, text_to_anchor, _unique_anchor)
        toc_items = build_toc_items(toc_headings)
        prev_item, next_item = get_adjacent_posts(root_folder, relative_path, abbreviations=abbreviations)
        if prev_item or next_item:
            prev_html = f'<a class="vyasa-prev-link" href="{prev_item["static_href"]}">← {prev_item["title"]}</a>' if prev_item else '<div></div>'
            next_html = f'<a class="vyasa-next-link" href="{next_item["static_href"]}">{next_item["title"]} →</a>' if next_item else '<div></div>'
            content_html += f'<div class="vyasa-prev-next">{prev_html}{next_html}</div>'

        # Generate full page
        full_html = static_layout(
            content_html=content_html,
            blog_title=blog_title,
            page_title=f"{post_title} - {blog_title}",
            nav_tree=nav_tree,
            favicon_href=favicon_href,
            toc_items=toc_items,
            current_path=str(relative_path.with_suffix(''))
        )
        
        # Determine output path
        if md_file.stem.lower() in ['index', 'readme'] and md_file.parent == root_folder:
            # Root index/readme becomes index.html
            output_path = output_dir / 'index.html'
        else:
            # Other files go in posts/ directory
            output_path = output_dir / 'posts' / relative_path.with_suffix('.html')
        
        # Create directory and write file
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(full_html, encoding='utf-8')
    
    # Copy static assets
    static_src = Path(__file__).parent / 'static'
    if static_src.exists():
        static_dst = output_dir / 'static'
        print(f"\nCopying static assets...")
        shutil.copytree(static_src, static_dst, dirs_exist_ok=True)
    if root_icon.exists():
        static_dst = output_dir / 'static'
        static_dst.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root_icon, static_dst / "icon.png")
    else:
        static_dst = output_dir / 'static'
        static_dst.mkdir(parents=True, exist_ok=True)
        write_generated_favicon(root_folder, static_dst / "icon.svg")
    
    # Generate index.html if it doesn't exist
    index_path = output_dir / 'index.html'
    if not index_path.exists():
        print("\nGenerating default index.html...")
        welcome_content = f'''
        <h1 class="text-4xl font-bold tracking-tight mb-8">Welcome to {blog_title}!</h1>
        <p class="text-lg font-medium text-slate-700 dark:text-slate-300 mb-4">Quick start tutorial</p>
        <ol class="list-decimal pl-6 space-y-2 text-base text-slate-600 dark:text-slate-400 mb-4">
            <li>Use the sidebar to browse the files and folders in your blog.</li>
            <li>Open a markdown file to preview it instantly.</li>
            <li>Create an <strong>index.md</strong> or <strong>README.md</strong> in your blog directory to replace this page with your own landing page.</li>
        </ol>
        <p class="text-base text-slate-600 dark:text-slate-400">
            More guides, examples, and documentation are available at
            <a href="https://vyasa.yeshwanth.com" class="text-slate-900 dark:text-slate-100 underline underline-offset-4">vyasa.yeshwanth.com</a>.
        </p>
        '''
        
        full_html = static_layout(
            content_html=welcome_content,
            blog_title=blog_title,
            page_title=f"Home - {blog_title}",
            nav_tree=nav_tree,
            favicon_href=favicon_href,
            toc_items=None
        )
        
        index_path.write_text(full_html, encoding='utf-8')
    
    print(f"\n✅ Static site built successfully!")
    print(f"📁 Output directory: {output_dir}")
    print(f"\nTo preview the site:")
    print(f"  cd {output_dir}")
    print(f"  python -m http.server 8000")
    print(f"  Open http://localhost:8000")
    
    return output_dir
