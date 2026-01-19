---
title: Advanced Behavior
description: Smaller details that are useful once you’re past the basics. The blog covers index/README behavior, smart 404 page, performance logging, and technical implementation details.
---
# Advanced Behavior

Smaller details that are useful once you’re past the basics.

## Index/README behavior

`index.md` or `README.md` in a folder can act as the folder landing page.

## Smart 404

Missing posts render a friendly 404 page with links back into the sidebar.

## Performance

Bloggy logs render timings to `/tmp/bloggy_core.log` for profiling.

### 🚀 Technical Highlights
- Built on **FastHTML** for modern Python web development with integrated HTMX
- Uses **Mistletoe** for extensible Markdown parsing with custom token renderers
- **TailwindCSS** + **MonsterUI** for utility-first styling and UI components
- **Hyperscript** for declarative interactive behaviors (theme toggle, sidenote interactions)
- **Mermaid.js v11** for diagram rendering with custom zoom/pan/fullscreen controls via ES modules
- **KaTeX** for mathematical notation rendering with auto-render on content swaps
- **Smart Link Resolution**: Automatically converts relative links to proper routes with HTMX attributes
- **Frontmatter Caching**: LRU cache for parsed frontmatter based on file modification time
- **Lazy Sidebar Loading**: Posts sidebar loaded progressively via HTMX endpoint for faster initial load
- **Performance Logging**: Debug-level logging tracks render times and bottlenecks to `/tmp/bloggy_core.log`
- **Custom 404 Page**: Elegant error page with navigation options and helpful tips
- **Static File Serving**: Serves images and assets from blog directories via `/posts/{path}.{ext}` routes
- **Raw Markdown Access**: Append `.md` to any post URL (e.g. `/posts/demo.md`) to fetch source content
- **Optional Authentication**: Session-based auth with Beforeware when username/password configured

### Quick Usage Examples
- Sidebar search: type a filename fragment like `write up` or `write-up` to filter results without collapsing the tree
- Raw markdown: fetch a post's source via `/posts/demo.md`

## Technical Implementation Details

### Markdown Processing Pipeline
1. **Frontmatter extraction**: `parse_frontmatter()` with file mtime-based caching
2. **Footnote extraction**: `extract_footnotes()` using regex to find `[^label]:` definitions
3. **Superscript/subscript preprocessing**: `preprocess_super_sub()` converts `^text^` and `~text~` to HTML
4. **Tab preprocessing**: `preprocess_tabs()` replaces `:::tabs` blocks with placeholders, stores tab data
5. **Mistletoe parsing**: Custom `ContentRenderer` with registered tokens:
   - `YoutubeEmbed` (precedence 6): `[yt:VIDEO_ID|caption]` syntax
   - `FootnoteRef`: `[^label]` references
   - `InlineCodeAttr` (precedence 8): `` `code`{.class} `` syntax
   - `Superscript` (precedence 7): `^text^` (if not preprocessed)
   - `Subscript` (precedence 7): `~text~` (if not preprocessed)
   - `Strikethrough` (precedence 7): `~~text~~`
6. **Token rendering**: Each token has custom `render_*` method in `ContentRenderer`
7. **Tab postprocessing**: `postprocess_tabs()` replaces placeholders with rendered tab HTML
8. **CSS class application**: `apply_classes()` adds Tailwind classes to HTML elements

### Custom Renderers
- **`render_list_item`**: Detects `[ ]` / `[x]` patterns, renders custom checkboxes
- **`render_youtube_embed`**: Creates responsive iframe with aspect-video container
- **`render_footnote_ref`**: Generates sidenote with hyperscript toggle behavior
- **`render_heading`**: Adds anchor ID using `text_to_anchor()` function
- **`render_block_code`**: Special handling for `mermaid` language, parses frontmatter
- **`render_link`**: Resolves relative paths, adds HTMX attributes or `target="_blank"`
- **`render_inline_code_attr`**: Parses Pandoc attributes, renders as `<span>` with classes
- **`render_image`**: Resolves relative image paths using `img_dir`

### Caching Strategy
- **Frontmatter cache**: `_frontmatter_cache` dict with `(mtime, data)` tuples
- **Posts tree cache**: `@lru_cache(maxsize=1)` on `_cached_build_post_tree(fingerprint)`
- **Sidebar HTML cache**: `@lru_cache(maxsize=1)` on `_cached_posts_sidebar_html(fingerprint)`
- **Fingerprint**: Max mtime of all `.md` files via `root.rglob("*.md")`
- Cache invalidation: Automatic when fingerprint changes (file modified)

### HTMX Integration
- **Main content swap**: `hx-get="/posts/path" hx-target="#main-content" hx-swap="innerHTML show:window:top"`
- **Out-of-band swaps**: TOC sidebar and CSS container use `hx_swap_oob="true"`
- **Push URL**: `hx-push-url="true"` updates browser history
- **Lazy loading**: Posts sidebar uses `hx-get="/_sidebar/posts" hx-trigger="load"`
- **Event handling**: JavaScript listens to `htmx:afterSwap` for re-initialization

### Logging & Debugging
- **Loguru**: Two handlers - stdout (INFO+) and file (DEBUG+)
- **Log file**: `/tmp/bloggy_core.log` with 10 MB rotation, 10 days retention
- **Performance tracking**: `time.time()` checkpoints throughout request handling
- **Debug groups**: `console.group()` in JavaScript for Mermaid operations
- **Request markers**: `########## REQUEST START/COMPLETE ##########` for easy grepping

### Responsive Breakpoints
- **Mobile**: < 768px (md breakpoint) - Shows mobile menu buttons, hides sidebars
- **Tablet**: 768px - 1279px - Shows sidebars but no sidenote margins
- **Desktop**: 1280px+ (xl breakpoint) - Full three-panel layout with sidenotes in margin

### Font Stack
- **Body text**: IBM Plex Sans (weights: 400, 500, 600, 700)
- **Code**: IBM Plex Mono (monospace)
- **Fallback**: System font stack via TailwindCSS defaults
- **Loading**: Preconnect to Google Fonts with `crossorigin` for speed

## Advanced Features

### Index/README Files
Place an `index.md` or `README.md` (case-insensitive) in your blog root directory to customize the home page. If neither exists, Bloggy shows a default welcome message. The index file:
- Takes precedence over README if both exist
- Renders with full sidebar and TOC support
- Uses the file's frontmatter `title` or blog title as page title
- Supports all markdown features (tabs, diagrams, footnotes, etc.)

### Smart 404 Page
When a route doesn't exist, Bloggy shows a custom 404 page with:
- Large "404" heading in gray
- Helpful error message explaining the situation
- Action buttons: "Go to Home" and "Go Back" with icons
- Tip section suggesting to check the sidebar
- Full sidebar included for easy navigation to correct page

### Code Highlighting
Code blocks are styled with proper language classes (`class="language-{lang}"`) for syntax highlighting. HTML/XML code is automatically escaped for display, while markdown code blocks preserve raw source. IBM Plex Mono font provides clear, readable monospace text.

### Heading Anchors
All headings (`h1` through `h6`) automatically get `id` attributes based on their text content using the `text_to_anchor()` function:
- Removes special characters
- Converts to lowercase
- Replaces spaces with hyphens
- Enables direct linking via `#anchor-slug`
- Powers TOC navigation with smooth scrolling (scroll margin 7rem for navbar offset)

### Image Handling
The `FrankenRenderer` class provides smart image handling:
- Responsive styling: `max-w-full h-auto rounded-lg mb-6`
- Relative path resolution: prepends `img_dir` based on post location
- Protocol detection: skips prepending for absolute URLs (`http://`, `https://`, `attachment:`, `blob:`, `data:`)
- Title attribute support: renders `title` if present in markdown
- Alt text: extracted from markdown image syntax

### Frontmatter Support
All markdown files support YAML frontmatter for metadata:
- `title`: Override default title (derived from filename)
- Parsed with `python-frontmatter` library
- Cached based on file modification time
- Missing frontmatter gracefully handled (empty dict + raw content)
