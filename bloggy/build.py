"""Static site generator for Bloggy

This module provides functionality to convert a folder of markdown files
into a standalone static website with HTML, CSS, and JavaScript files.
"""

from pathlib import Path
import shutil
from functools import partial
import mistletoe as mst
from fasthtml.common import *
from monsterui.all import *
from .core import (
    parse_frontmatter, get_post_title, slug_to_title, 
    from_md, extract_toc, build_toc_items, text_to_anchor,
    build_post_tree, ContentRenderer, extract_footnotes,
    preprocess_super_sub, preprocess_tabs
)
from .config import get_config, reload_config


def generate_static_html(title, body_content, blog_title):
    """Generate complete static HTML page"""
    
    # Static CSS (inline critical styles)
    static_css = """
    <style>
        body { font-family: 'IBM Plex Sans', sans-serif; margin: 0; padding: 0; }
        code, pre { font-family: 'IBM Plex Mono', monospace; }
        .folder-chevron { transition: transform 0.2s; display: inline-block; }
        details[open] > summary > .folder-chevron { transform: rotate(90deg); }
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
    <link rel="stylesheet" href="/static/sidenote.css">
    
    {static_css}
</head>
<body>
    {body_content}
    
    <!-- Mermaid diagrams -->
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
        mermaid.initialize({{ startOnLoad: true, theme: 'default' }});
    </script>
    <script src="/static/scripts.js" type="module"></script>
    
    {static_js}
</body>
</html>"""
    
    return html


def build_post_tree_static(folder, root_folder):
    """Build post tree with static .html links instead of HTMX"""
    items = []
    try: 
        entries = sorted(folder.iterdir(), key=lambda x: (not x.is_dir(), x.name))
    except (OSError, PermissionError): 
        return items
    
    for item in entries:
        if item.is_dir():
            if item.name.startswith('.'): 
                continue
            sub_items = build_post_tree_static(item, root_folder)
            if sub_items:
                folder_title = slug_to_title(item.name)
                items.append(Li(Details(
                    Summary(
                        Span(UkIcon("chevron-right", cls="folder-chevron w-4 h-4 text-slate-400"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
                        Span(UkIcon("folder", cls="text-blue-500 w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
                        Span(folder_title, cls="truncate min-w-0", title=folder_title),
                        cls="flex items-center font-medium cursor-pointer py-1 px-2 hover:text-blue-600 select-none list-none rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-w-0"),
                    Ul(*sub_items, cls="ml-2 pl-2 space-y-1 border-l border-slate-100 dark:border-slate-800"), open=False), cls="my-1"))
        elif item.suffix == '.md':
            # Skip the file being used for home page
            if item.parent == root_folder:
                # Check if this is index.md or readme.md (case insensitive)
                if item.stem.lower() in ['index', 'readme']:
                    continue
            
            slug = str(item.relative_to(root_folder).with_suffix(''))
            title = get_post_title(item)
            
            # Use .html extension for static links
            items.append(Li(A(
                Span(cls="w-4 mr-2 shrink-0"),
                Span(UkIcon("file-text", cls="text-slate-400 w-4 h-4"), cls="w-4 mr-2 flex items-center justify-center shrink-0"),
                Span(title, cls="truncate min-w-0", title=title),
                href=f'/posts/{slug}.html',  # Add .html extension
                cls="flex items-center py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors min-w-0")))
    return items


def static_layout(content_html, blog_title, page_title, nav_tree, toc_items=None, current_path=None):
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
    <div class="flex items-center justify-between bg-slate-900 text-white p-4 my-4 rounded-lg shadow-md dark:bg-slate-800">
        <a href="/index.html">{blog_title}</a>
        {theme_toggle}
    </div>
    '''
    
    # Build navigation sidebar
    nav_html = to_xml(Ul(*nav_tree, cls="mt-2 list-none"))
    posts_sidebar = f'''
    <aside id="posts-sidebar" class="hidden md:block w-64 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]">
        <details open>
            <summary class="flex items-center font-semibold cursor-pointer py-2 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg select-none list-none bg-white dark:bg-slate-950 z-10">
                <span uk-icon="menu" class="w-5 h-5 mr-2"></span>
                Posts
            </summary>
            <div class="mt-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[calc(100vh-16rem)]">
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
        <aside id="toc-sidebar" class="hidden md:block w-64 shrink-0 sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]">
            <details open>
                <summary class="flex items-center font-semibold cursor-pointer py-2 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg select-none list-none bg-white dark:bg-slate-950 z-10">
                    <span uk-icon="list" class="w-5 h-5 mr-2"></span>
                    Contents
                </summary>
                <div class="mt-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[calc(100vh-16rem)]">
                    {toc_list_html}
                </div>
            </details>
        </aside>
        '''
    
    # Main content area
    main_content = f'''
    <main id="main-content" class="flex-1 min-w-0 px-6 py-8 space-y-8">
        {content_html}
    </main>
    '''
    
    # Footer
    footer = '''
    <footer class="w-full max-w-7xl mx-auto px-6 mt-auto mb-6">
        <div class="bg-slate-900 text-white rounded-lg p-4 my-4 dark:bg-slate-800 text-right">
            Powered by Bloggy
        </div>
    </footer>
    '''
    
    # Complete body
    body = f'''
    <div id="page-container" class="flex flex-col min-h-screen">
        <div class="w-full max-w-7xl mx-auto px-4 sticky top-0 z-50 mt-4">
            {navbar}
        </div>
        <div class="w-full max-w-7xl mx-auto px-4 flex gap-6 flex-1">
            {posts_sidebar}
            {main_content}
            {toc_html}
        </div>
        {footer}
    </div>
    '''
    
    return generate_static_html(page_title, body, blog_title)


def build_static_site(input_dir=None, output_dir=None):
    """
    Build a complete static site from markdown files
    
    Args:
        input_dir: Path to markdown files (defaults to BLOGGY_ROOT or current dir)
        output_dir: Path to output directory (defaults to ./dist)
    """
    
    # Initialize config
    if input_dir:
        import os
        os.environ['BLOGGY_ROOT'] = str(Path(input_dir).resolve())
        reload_config()
    
    config = get_config()
    root_folder = config.get_root_folder()
    blog_title = config.get_blog_title()
    
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
    nav_tree = build_post_tree_static(root_folder, root_folder)
    
    # Find all markdown files (only in the specified root folder, not parent directories)
    md_files = []
    for md_file in root_folder.rglob('*.md'):
        # Only include files that are actually inside root_folder
        try:
            relative_path = md_file.relative_to(root_folder)
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
        post_title = metadata.get('title', get_post_title(md_file))
        
        # Render markdown to HTML
        content_div = from_md(raw_content)
        title_html = f'<h1 class="text-4xl font-bold mb-8">{post_title}</h1>'
        content_html = title_html + to_xml(content_div)
        
        # Extract TOC
        toc_headings = extract_toc(raw_content)
        toc_items = build_toc_items(toc_headings)
        
        # Generate full page
        full_html = static_layout(
            content_html=content_html,
            blog_title=blog_title,
            page_title=f"{post_title} - {blog_title}",
            nav_tree=nav_tree,
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
    
    # Generate index.html if it doesn't exist
    index_path = output_dir / 'index.html'
    if not index_path.exists():
        print("\nGenerating default index.html...")
        welcome_content = f'''
        <h1 class="text-4xl font-bold tracking-tight mb-8">Welcome to {blog_title}!</h1>
        <p class="text-lg text-slate-600 dark:text-slate-400 mb-4">Your personal blogging platform.</p>
        <p class="text-base text-slate-600 dark:text-slate-400">
            Browse your posts using the sidebar, or create an <strong>index.md</strong> or 
            <strong>README.md</strong> file in your blog directory to customize this page.
        </p>
        '''
        
        full_html = static_layout(
            content_html=welcome_content,
            blog_title=blog_title,
            page_title=f"Home - {blog_title}",
            nav_tree=nav_tree,
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
