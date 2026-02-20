---
title: Presentations with Vyasa
slides: true
reveal:
  transition: fade
  backgroundTransition: slide
  controls: true
  progress: true
  center: true
  theme: white
  # margin: 0.4
  # slidePadding: 2rem
  fontSize: 24px
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

# Your Turn
Try changing one value:
- `theme`: `white`, `beige`, `simple`
- `transition`: `none`, `fade`, `slide`, `convex`, `concave`, `zoom`

Refresh `/slides/...` and compare.
