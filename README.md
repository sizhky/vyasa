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
    B -->|Content| C[Mistletoe Parser]
    B -->|Footnote Defs| D[Store in Dict]
    
    C --> E[Token Stream]
    
    E --> F{ContentRenderer}
    
    F -->|BlockCode + 'mermaid'| G[Mermaid Renderer]
    F -->|Link| H[Link Renderer]
    F -->|FootnoteRef| I[Footnote Renderer]
    F -->|Other| J[Standard HTML]
    
    G --> K[Diagram with Controls]
    H --> L{Internal Link?}
    L -->|Yes| M[Add HTMX attrs]
    L -->|No| N[Add target=_blank]
    
    I --> O[Sidenote Component]
    D --> O
    
    K --> P[Apply CSS Classes]
    M --> P
    N --> P
    O --> P
    J --> P
    
    P --> Q[Final HTML]
    
    style G fill:#ffe6cc
    style I fill:#d1ecf1
    style L fill:#fff3cd
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

### 🎨 Modern UI
- **Responsive Design**: Works beautifully on all screen sizes
- **Dark Mode**: Automatic theme switching with localStorage persistence
- **HTMX Navigation**: Fast, SPA-like navigation without full page reloads
- **Collapsible Folders**: Organize posts in nested directories

### 🚀 Technical Highlights
- Built on **FastHTML** for modern Python web development
- Uses **Mistletoe** for extensible Markdown parsing
- **TailwindCSS** + **MonsterUI** for styling
- **Hyperscript** for interactive behaviors
- **Mermaid.js v11** for diagram rendering

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

## Getting Started

1. Set your blog content root (optional):
   ```bash
   export BLOGGY_ROOT=/path/to/your/markdown/files
   ```

2. Run the app:
   ```bash
   python -m bloggy.main
   ```

3. Create markdown files in your content directory and they'll automatically appear in the post list!
