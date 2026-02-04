# Architecture Overview

This is a high-level view of how requests flow through Vyasa. These diagrams are here (not in the main README) to keep the README user-focused.

## Request flow

```mermaid
flowchart LR
    Browser --> Router
    Router --> Handler
    Handler --> Renderer
    Renderer --> Layout
    Layout --> Browser
```

## Markdown processing pipeline

```mermaid
flowchart LR
    RawMarkdown --> Frontmatter
    Frontmatter --> MarkdownParser
    MarkdownParser --> CustomRenderers
    CustomRenderers --> HTML
```

## Mermaid lifecycle

```mermaid
sequenceDiagram
    participant Page
    participant Mermaid
    Page->>Mermaid: mermaid.run()
    Mermaid-->>Page: SVG injected
    Page->>Mermaid: attach zoom/pan
```

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

## How Vyasa Works

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
height: 60vh
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

## Navigation & Layout Details

The `layout()` helper builds the complete page structure with intelligent HTMX optimization:

### Layout Components
- **Navbar**: Sticky header with blog title, theme toggle, and mobile menu buttons (posts/TOC toggles)
- **Three-panel layout**: 
  - Left sidebar (72 width): Posts file tree with lazy HTMX loading
  - Main content (flex-1): Swappable content area with section-specific CSS classes
  - Right sidebar (72 width): Auto-generated TOC from headings
- **Mobile panels**: Fullscreen overlays for posts and TOC with smooth slide transitions
- **Footer**: "Powered by Vyasa" right-aligned in max-width container

### HTMX Optimization
When `htmx.request` is detected, `layout()` returns only swappable fragments:
- Main content container with `id="main-content"`
- TOC sidebar with `hx_swap_oob="true"` for out-of-band swap
- CSS container with `hx_swap_oob="true"` for scoped styles
- `Title` element for browser tab title
- Skips navbar, posts sidebar, footer, mobile panels (already in DOM)

### Sidebar Features
- **Left sidebar** (`build_post_tree`): 
  - Recursive folder tree with chevron indicators
  - Folders: Blue folder icon, clickable summary, nested `<ul>` with border
  - Files: Gray file-text icon, HTMX-enhanced links with `data-path` attribute
  - Cached via `@lru_cache` based on max modification time fingerprint
  - Lazy loaded via `/_sidebar/posts` endpoint with loading spinner placeholder
- **Right sidebar** (`extract_toc`):
  - Parses headings from markdown (excludes code blocks)
  - Generates anchor slugs matching heading IDs
  - Indentation based on heading level (`ml-{(level-1)*3}`)
  - Active tracking based on scroll position

### CSS Scoping
`get_custom_css_links()` discovers and loads custom CSS:
1. **Root CSS**: Applies globally (`/posts/custom.css` or `/posts/style.css`)
2. **Folder CSS**: Automatically scoped to section via wrapper class (e.g., `#main-content.section-demo-books-flat-land`)
3. Content wrapped in `<Style>` tag with scoped selector to prevent cross-section leakage
4. All CSS changes swapped via `#scoped-css-container` for HTMX compatibility

### Performance Logging
- Debug logs track timing for each phase (section class, TOC build, CSS resolution, container build)
- Logs written to `/tmp/vyasa_core.log` with rotation (10 MB, 10 days retention)
- Request start/complete markers for easy debugging
