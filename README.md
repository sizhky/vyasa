---
title: Bloggy - A FastHTML Blogging Platform
---
# Bloggy

A lightweight, elegant blogging platform built with FastHTML that renders Markdown files into beautiful web pages with advanced features.

## Architecture Overview

```mermaid
---
width: 80vw
---
graph TB
    subgraph "User Interface"
        Browser[Web Browser]
        Theme[Light/Dark Theme Toggle]
    end
    
    subgraph "FastHTML Application"
        App[FastHTML App<br/>core.py]
        Router[URL Router]
        Layout[Layout Engine]
        
        subgraph "Route Handlers"
            Index[Index Route<br/>/]
            PostDetail[Post Detail Route<br/>/posts/path]
        end
    end
    
    subgraph "Markdown Processing"
        MDParser[Mistletoe Parser]
        Renderer[ContentRenderer]
        
        subgraph "Custom Renderers"
            Footnotes[Footnote Renderer<br/>Sidenotes]
            Mermaid[Mermaid Diagram Renderer<br/>Zoom/Pan Controls]
            Links[Link Renderer<br/>HTMX Integration]
        end
    end
    
    subgraph "File System"
        MDFiles[Markdown Files<br/>.md]
        Tree[Folder Tree Builder<br/>build_post_tree]
    end
    
    subgraph "Frontend Assets"
        Static[Static Files]
        JS[scripts.js<br/>Mermaid + Interactions]
        CSS[Styles<br/>TailwindCSS + MonsterUI]
    end
    
    Browser -->|HTTP Request| Router
    Theme -->|Toggle Dark Mode| JS
    
    Router --> Index
    Router --> PostDetail
    
    Index --> Tree
    Tree --> MDFiles
    Index --> Layout
    
    PostDetail --> MDFiles
    PostDetail --> MDParser
    
    MDParser --> Renderer
    Renderer --> Footnotes
    Renderer --> Mermaid
    Renderer --> Links
    
    Footnotes -->|Marginal Notes| Layout
    Mermaid -->|Interactive Diagrams| Layout
    Links -->|HTMX Navigation| Layout
    
    Layout --> Browser
    
    JS -->|Theme Change| Mermaid
    JS -->|Zoom/Pan/Reset| Mermaid
    
    Static --> CSS
    Static --> JS
    
    App -.->|Serves| Static
    
    style Browser fill:#e1f5ff
    style App fill:#fff3cd
    style MDParser fill:#d4edda
    style Static fill:#f8d7da
    style Mermaid fill:#cce5ff
    style Footnotes fill:#cce5ff
```

## How Bloggy Works

### 1. Request Flow

```mermaid
---
width: 80vw
---
sequenceDiagram
    participant User
    participant Browser
    participant FastHTML
    participant Router
    participant FileSystem
    participant Renderer
    participant HTMX
    
    User->>Browser: Visit /
    Browser->>FastHTML: GET /
    FastHTML->>Router: Route to index()
    Router->>FileSystem: Scan for .md files
    FileSystem-->>Router: Return file tree
    Router->>Browser: Render post list + layout
    
    User->>Browser: Click post link
    Browser->>HTMX: hx-get="/posts/demo"
    HTMX->>FastHTML: GET /posts/demo
    FastHTML->>Router: Route to post_detail()
    Router->>FileSystem: Read demo.md
    FileSystem-->>Router: Markdown content
    Router->>Renderer: Parse & render markdown
    
    rect rgb(200, 220, 250)
        Note over Renderer: Process custom syntax:<br/>- Footnotes [^1]<br/>- Mermaid diagrams<br/>- Internal links
    end
    
    Renderer-->>Router: Rendered HTML
    Router->>HTMX: Return HTML fragment
    HTMX->>Browser: Swap content (#main-content)
    Browser->>User: Display post
```

### 2. Markdown Processing Pipeline

```mermaid
---
width: 80vw
---
flowchart LR
    A[Raw Markdown] --> B{Extract Footnotes}
    B -->|Content| C[Preprocess Super/Sub]
    B -->|Footnote Defs| D[Store in Dict]
    
    C --> E[Preprocess Tabs]
    E -->|Content + Placeholders| F[Mistletoe Parser]
    E -->|Tab Data| G[Tab Store]
    
    F --> H[Token Stream]
    
    H --> I{ContentRenderer}
    
    I -->|BlockCode + 'mermaid'| J[Mermaid Renderer]
    I -->|Link| K[Link Renderer]
    I -->|FootnoteRef| L[Footnote Renderer]
    I -->|Other| M[Standard HTML]
    
    J --> N[Diagram with Controls]
    K --> O{Relative/Internal?}
    O -->|Relative| P[Resolve Path]
    P --> Q[Add HTMX attrs]
    O -->|Internal| Q
    O -->|External| R[Add target=_blank]
    
    L --> S[Sidenote Component]
    D --> S
    
    N --> T[Initial HTML]
    Q --> T
    R --> T
    S --> T
    M --> T
    
    T --> U[Postprocess Tabs]
    G --> U
    U -->|Render Each Tab| V[ContentRenderer]
    V --> U
    
    U --> W[Apply CSS Classes]
    W --> X[Final HTML]
    
    style J fill:#ffe6cc
    style L fill:#d1ecf1
    style O fill:#fff3cd
    style U fill:#e7d4ff
```

### 3. Mermaid Diagram Lifecycle

```mermaid
---
width: 60vw
---
stateDiagram-v2
    [*] --> Rendered: Page Load
    
    state Rendered {
        [*] --> Initialize
        Initialize --> AddControls: Create buttons
        AddControls --> StoreCode: Save original code
        StoreCode --> EnableInteraction: Mouse events
    }
    
    state EnableInteraction {
        [*] --> Idle
        Idle --> Panning: Mouse drag
        Idle --> Zooming: Mouse wheel
        Idle --> ButtonZoom: +/- buttons
        ButtonZoom --> Idle
        Zooming --> Idle
        Panning --> Idle
        
        state "Reset Button" as Reset
        Idle --> Reset: Click reset
        Reset --> Idle: Restore defaults
    }
    
    Rendered --> ThemeChange: Dark/Light toggle
    
    state ThemeChange {
        [*] --> DetectTheme
        DetectTheme --> GetOriginalCode: Read data attribute
        GetOriginalCode --> ClearWrapper
        ClearWrapper --> ReinitMermaid: New theme
        ReinitMermaid --> ReRender: mermaid.run()
    }
    
    ThemeChange --> Rendered: Re-rendered
    
    note right of ThemeChange
        MutationObserver watches
        HTML class changes
    end note
    
    note right of EnableInteraction
        Transform state stored
        per diagram ID
    end note
```

## Key Features

### ✨ Advanced Markdown Features
- **Footnotes as Sidenotes**: `[^1]` references become elegant margin notes on desktop, expandable on mobile
- **Mermaid Diagrams**: Full support for flowcharts, sequence diagrams, state diagrams, etc.
- **Interactive Diagrams**: Built-in zoom, pan, and reset controls for all mermaid diagrams
- **Theme-aware Rendering**: Diagrams automatically re-render when switching light/dark mode
- **Tabbed Content**: Create multi-tab sections using `:::tabs` syntax for comparing code, showing examples, etc.
- **Relative Links**: Full support for relative markdown links (`./file.md`, `../other.md`) that work seamlessly with navigation
- **Math Notation**: KaTeX support for inline `$E=mc^2$` and block `$$` math equations
- **Superscript & Subscript**: Use `^text^` for superscript and `~text~` for subscript
- **Pandoc-style Attributes**: Add classes to inline text with `` `text`{.class} `` syntax for semantic markup (renders as `<span>` tags)
- **Cascading Custom CSS**: Add `custom.css` files at multiple levels (root, folders) for flexible styling

### 🎨 Modern UI
- **Responsive Design**: Works beautifully on all screen sizes
- **Three-Panel Layout**: Posts sidebar, main content, and table of contents for easy navigation
- **Dark Mode**: Automatic theme switching with localStorage persistence
- **HTMX Navigation**: Fast, SPA-like navigation without full page reloads
- **Collapsible Folders**: Organize posts in nested directories
- **Auto-Generated TOC**: Table of contents automatically extracted from headings

### 🚀 Technical Highlights
- Built on **FastHTML** for modern Python web development
- Uses **Mistletoe** for extensible Markdown parsing with custom renderers
- **TailwindCSS** + **MonsterUI** for styling
- **Hyperscript** for interactive behaviors
- **Mermaid.js v11** for diagram rendering with custom controls
- **KaTeX** for mathematical notation rendering
- **Smart Link Resolution**: Automatically converts relative links to proper routes

## Project Structure

```mermaid
graph LR
    subgraph bloggy/
        A[__init__.py]
        B[core.py<br/>Main App Logic]
        C[main.py<br/>Entry Point]
        
        subgraph static/
            D[scripts.js<br/>Mermaid + Interactions]
            E[sidenote.css<br/>Footnote Styles]
            F[favicon.png]
        end
    end
    
    subgraph demo/
        G[*.md Files<br/>Your Blog Posts]
        
        subgraph guides/
            H[*.md Files<br/>Nested Content]
        end
    end
    
    B --> D
    B --> E
    B --> F
    B -.reads.-> G
    B -.reads.-> H
    
    style B fill:#ffe6cc
    style D fill:#d1ecf1
    style G fill:#d4edda
```

## Installation

### From PyPI (recommended)

```bash
pip install bloggy
```

### From source

```bash
git clone https://github.com/yeshwanth/bloggy.git
cd bloggy
pip install -e .
```

## Quick Start

1. Create a directory with your markdown files:
   ```bash
   mkdir my-blog
   cd my-blog
   echo "# Hello World" > hello.md
   ```

2. Run Bloggy:
   ```bash
   bloggy .
   ```

3. Open your browser at `http://127.0.0.1:5001`

## Configuration

Bloggy supports three ways to configure your blog (in priority order):

1. **`.bloggy` configuration file** (TOML format)
2. **Environment variables**
3. **Default values**

### Using a `.bloggy` Configuration File

Create a `.bloggy` file in your blog directory or current directory:

```toml
# Blog title (default: derives from root folder name)
title = "My Awesome Blog"

# Root folder containing markdown files (default: current directory)
root = "."

# Server host (default: 127.0.0.1)
# Use "0.0.0.0" to make the server accessible from network
host = "127.0.0.1"

# Server port (default: 5001)
port = 5001
```

All settings in the `.bloggy` file are optional. See `.bloggy.example` for a full example.

### Environment Variables

You can also use environment variables as a fallback:

- `BLOGGY_ROOT`: Path to your markdown files (default: current directory)
- `BLOGGY_TITLE`: Your blog's title (default: folder name)
- `BLOGGY_HOST`: Server host (default: 127.0.0.1)
- `BLOGGY_PORT`: Server port (default: 5001)

### Examples

**Using a `.bloggy` file:**

```bash
# Create a .bloggy file in your blog directory
cd /path/to/your/blog
cat > .bloggy << EOF
title = "My Tech Blog"
port = 8000
EOF

bloggy
```

**Using environment variables:**

```bash
export BLOGGY_ROOT=/path/to/your/markdown/files
export BLOGGY_TITLE="My Awesome Blog"
export BLOGGY_PORT=8000
bloggy
```

**Passing directory as argument:**

```bash
bloggy /path/to/your/markdown/files
```

**Configuration priority example:**

If you have both a `.bloggy` file with `port = 8000` and an environment variable `BLOGGY_PORT=9000`, the `.bloggy` file takes precedence and port 8000 will be used.

## Custom Styling with Cascading CSS

Bloggy supports **cascading custom CSS** at multiple levels, allowing you to style your entire blog globally or customize specific sections:

### CSS Loading Order

1. **Framework CSS** (`bloggy/static/custom.css`) - Core styling for Bloggy itself
2. **Blog-wide CSS** (`/your-blog-root/custom.css`) - Applies to all posts
3. **Folder-specific CSS** (`/your-blog-root/section/custom.css`) - Applies only to posts in that folder

Each level can override styles from previous levels, following standard CSS cascade rules.

### Pandoc-style Inline Attributes

Use backticks with attributes to add semantic classes to inline text:

```markdown
The variables `x`{.variable}, `y`{.variable}, and `z`{.variable} represent coordinates.

Use `important`{.emphasis} for highlighted terms.

The function `console.log()`{.code} prints to console.
```

Attributes support:
- **Classes**: `.variable`, `.emphasis`, `.keyword`
- **IDs**: `#unique-id`
- **Key-value pairs**: `lang=python`

Classes like `.variable`, `.emphasis`, and `.keyword` render as `<span>` tags (not `<code>`), making them perfect for semantic styling without monospace fonts.

### Example: Multi-level Custom CSS

**Root level** (`/blog/custom.css`) - Global styles:
```css
/* Base variable styling for all posts */
span.variable {
    color: #e06c75;
    font-weight: 500;
}

span.emphasis {
    background: linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%);
    padding: 2px 6px;
    border-radius: 3px;
}
```

**Section level** (`/blog/tutorials/custom.css`) - Tutorial-specific:
```css
/* Override for tutorial section - use blue variables */
span.variable {
    color: #61afef;
    position: relative;
}

/* Add overline to variables in tutorials */
span.variable::before {
    content: '';
    position: absolute;
    top: -3px;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    height: 2px;
    background-color: currentColor;
}

span.emphasis {
    background: #ffd93d;
    color: #333;
    font-weight: bold;
}
```

**Chapter level** (`/blog/tutorials/advanced/custom.css`) - Advanced chapter styling:
```css
/* Different style for advanced tutorials */
span.variable {
    color: #c678dd;
    font-style: italic;
}

/* Add special marker for keywords */
span.keyword {
    color: #e5c07b;
    text-transform: uppercase;
    font-size: 0.85em;
    letter-spacing: 1px;
}
```

### Real Example from Demo

See the `demo/flat-land/` folder for a working example:

**Markdown** (`demo/flat-land/chapter-02.md`):
```markdown
The two Northern sides `RO`{.variable}, `OF`{.variable}, constitute the roof.
```

**CSS** (`demo/flat-land/custom.css`):
```css
span.variable {
    color: #e06c75;
    position: relative;
}

span.variable::before {
    content: '';
    position: absolute;
    top: -3px;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    height: 2px;
    background-color: currentColor;
}
```

This renders `RO` and `OF` in red with a line above them, perfect for mathematical or geometric notation!
