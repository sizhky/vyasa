---
title: Presentations with Vyasa
slides: true
---

- The current file is in reading view at [/posts/demo/reveal-slides](/posts/demo/reveal-slides)
- The same file can be viewed as a slide show at <a href="/slides/demo/reveal-slides" target="_blank" rel="noopener noreferrer">/slides/demo/reveal-slides</a>

---

## 1) Enable Slide Mode
Add this to frontmatter:

````yaml
title: My Deck
slides: true
````

`slides: true` shows the **Present** button in Vyasa beside the post title.

---

## 2) Configure Reveal.js
Use a nested `reveal:` block like so

```yaml
reveal:
  theme: white
  transition: fade
  backgroundTransition: slide
  controls: true
  progress: true
  slideNumber: true
  center: false
  margin: 0.14
  slidePadding: 2rem
```

These values are passed to `Reveal.initialize(...)`.

---

## 3) Alternative: Top-Level Keys
You can also use `reveal_*` keys:

```yaml
reveal_theme: white
reveal_transition: zoom
reveal_controls: true
reveal_slideNumber: true
```

To make the **right arrow** advance through every slide (including vertical/below slides), enable:

```yaml
reveal_rightAdvancesAll: true
```

Top-level keys and `reveal:` both work.
If both define the same key, `reveal_*` overrides the value from `reveal:`.

---

## 4) Slide Separators
Defaults in Vyasa:
- Horizontal: `---`
- Vertical: `--`

You can override separators:

```yaml
reveal:
  separator: "^---$"
  separatorVertical: "^--$"
  separatorNotes: "^Note:"
```

--

### Vertical Example Child
This slide exists because the separator above is `--`.

--

### Another Child
Use this pattern to group related details under one parent topic.

---

## 5) Syntax Highlight Theme
```python
def hello():
    return "Choose highlight theme via reveal.highlightTheme"
```

Set with:
```yaml
reveal:
  highlightTheme: atom-one-dark
```

---

## 6) Starter Template
Copy this into a new markdown file:

```
[three-dashes]
title: Team Update
slides: true
reveal:
  theme: white
  transition: fade
  controls: true
  progress: true
  slideNumber: true
[three-dashes]
```

Then add content separated by `---`.

---

## 7) LaTeX Math Support
Inline math: $f(x)=\sin(x)+\log(x)$

Block math:
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

Common functions:
- $\frac{a}{b}$, $\sqrt{x}$, $x^{2}$, $x_{i}$
- $\sum_{i=1}^{n} i$, $\prod_{k=1}^{m} k$, $\lim_{x\to0}\frac{\sin x}{x}$

---

## 8) Mermaid Works in Slides
⇊
--

```mermaid
flowchart TD
  A --> B
  B --> C
```
⇊
--

```mermaid
flowchart TD
  A --> B
  B --> C
  C --> D
  D --> E
  E --> F
```

⇊
--

```mermaid
flowchart TD
  user["👤 User"] --> editor["✏️ Editor"]
  user --> browser["🌐 Browser"]

  editor --> md["📄 Markdown Files"]
  editor --> config["⚙️ settings.ini"]
  editor --> css["🎨 Custom CSS"]

  md --> parser["🔍 Markdown Parser"]
  config --> frontmatter["📋 Frontmatter Reader"]
  css --> renderer

  parser --> frontmatter
  frontmatter --> meta["🏷️ Metadata<br/>(title, theme, slides)"]
  parser --> ast["🌳 AST"]

  ast --> renderer["⚙️ HTML Renderer"]
  meta --> renderer

  renderer --> read["📖 Reading View"]
  renderer --> slide["🎞️ Slide View"]
  renderer --> api["🔌 REST API"]
  renderer --> logs["📝 Build Logs"]

  read --> katex_r["📐 KaTeX"]
  read --> highlight_r["🖍️ Syntax Highlight"]

  slide --> reveal["🎭 Reveal.js"]
  reveal --> mermaid["📊 Mermaid.js"]
  reveal --> d2["📐 D2 Renderer"]
  reveal --> math["∑ KaTeX"]
  reveal --> highlight["🖍️ Highlight.js"]
  reveal --> themes["🎨 Themes<br/>(white/beige/simple)"]
  reveal --> transitions["✨ Transitions<br/>(fade/zoom/slide)"]

  api --> storage["🗄️ File System"]
  storage --> md

  browser --> read
  browser --> slide
```

---

## 9) D2 Works in Slides
⇊
--

```d2
direction: right

user: User {
  shape: person
}

editor: Editor {
  shape: rectangle
  style.fill: "#e8f4fd"
}

vyasa: Vyasa Engine {
  shape: rectangle
  style.fill: "#fff3cd"

  parser: Markdown Parser
  frontmatter: Frontmatter Reader
  renderer: HTML Renderer
  router: URL Router
}

assets: Static Assets {
  shape: rectangle
  style.fill: "#d4edda"

  css: CSS Files
  js: JS Bundles
  fonts: Fonts
}

output: Browser Output {
  shape: rectangle
  style.fill: "#f8d7da"

  reading: Reading View
  slides: Slide View {
    reveal: Reveal.js
    mermaid: Mermaid.js
    d2: D2 Renderer
    math: KaTeX
  }
  api: REST API
}

storage: File System {
  shape: cylinder
  style.fill: "#e2d9f3"

  md: Markdown Files
  config: Config / settings.ini
  logs: Build Logs
}

user -> editor: writes markdown
editor -> storage.md: saves
storage.md -> vyasa.parser: reads
vyasa.frontmatter -> vyasa.renderer: metadata
vyasa.parser -> vyasa.frontmatter: extracts
vyasa.parser -> vyasa.renderer: AST
vyasa.renderer -> output.reading: HTML page
vyasa.renderer -> output.slides: slide deck
vyasa.router -> output.reading: /posts/...
vyasa.router -> output.slides: /slides/...
assets.css -> output.reading: styles
assets.js -> output.slides: scripts
output.slides.reveal -> output.slides.mermaid: init
output.slides.reveal -> output.slides.d2: init
output.slides.reveal -> output.slides.math: init
output.api -> storage.config: read/write
user -> output.reading: views
user -> output.slides: presents
vyasa.renderer -> storage.logs: writes
```


---

## 10) Mixed Content Stress

This slide is meant to combine prose, emphasis, inline code like `vyasa serve`, and a short checklist in one place.

- First bullet with **bold text** and a [link to the home page](/).
- Second bullet with `inline code`, math $e^{i\pi}+1=0$, and a longer sentence to test wrapping.
- Third bullet with nested-looking content kept flat on purpose.

> “Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.”  
> Antoine de Saint-Exupéry

---

## 11) Table Layout

| Surface | What to check | Expected |
|---|---|---|
| Title | Centering | Stable |
| Content | Width | Readable |
| Overflow | Long text | Internal scroll |
| Navigation | Left / Right | Predictable |

Follow the table with one paragraph so the slide is not only a grid. That tends to expose spacing bugs faster than isolated components.

---

## 12) Intentional Overflow

This slide should become internally scrollable instead of clipping. The point is not beauty. The point is to force the engine to deal with too much content without shrinking everything into dust.

Paragraph 1. Vyasa should treat overflow as a real mode, not as an accident.

Paragraph 2. A presenter should still understand where they are, what comes next, and whether the slide can scroll.

Paragraph 3. If this page clips, stretches strangely, or leaks into the viewport chrome, the engine is lying about its contract.

Paragraph 4. Long slides are where presentation systems usually reveal whether they were designed or merely assembled.

Paragraph 5. Add enough text here to push past the fold on a laptop-sized viewport and make the scroll affordance obvious.

Paragraph 6. If the bottom fade, internal scrolling, and navigation handoff all work, this slide has done its job.

---


# Remember
It's advisable to store not put any text in slides that have mermaid or d2 diagrams, as they may not render properly in the slide view. Instead, use the reading view for detailed explanations and reserve the slide view for visual content.
