# Vyasa Markdown Features

All standard CommonMark markdown works. The following are Vyasa-specific or extended features.

## Frontmatter

```markdown
---
title: My Post Title
---

Post content starts here.
```

`title` overrides the default title (derived from filename). Other keys are stored but not used by Vyasa currently.

## Index / landing page

Place `index.md` or `README.md` (case-insensitive) in any folder to make it the landing page for that folder. `index.md` takes precedence over `README.md`.

## Raw markdown access

Append `.md` to any post URL to fetch its source: `/posts/my-note.md`

## Extended inline syntax

```markdown
~~strikethrough~~
==highlighted text==
E = mc^2^          (superscript)
H~2~O              (subscript)
{++inserted text++}
{--deleted text--}
```

## Footnotes / sidenotes

```markdown
Main text with a note.[^1]

[^1]: This appears as a sidenote on desktop, inline on mobile.
```

On desktop (xl breakpoint), footnotes render as interactive margin sidenotes. Clicking the reference highlights the sidenote.

## Tables

```markdown
| Column A | Column B |
|----------|----------|
| row 1    | data     |
| row 2    | data     |
```

Markdown tables render inside a horizontal scroll wrapper. By default, each cell is capped at `33vw` so one verbose column does not consume the whole viewport.

Use a per-table override when needed:

```markdown
<!-- table max-col=24vw -->
| Column A | Column B |
|----------|----------|
| long prose | more prose |
```

## Definition lists

```markdown
Term
: Definition text here.
```

## Task lists

```markdown
- [x] Done
- [ ] Not done
```

## Abbreviation expansion

```markdown
The HTML spec defines how browsers work.

*[HTML]: HyperText Markup Language
```

Any occurrence of "HTML" in the document gets an `<abbr>` tooltip.

You can also configure site-wide abbreviations in `.vyasa` so certain words are always uppercased in auto-generated titles:

```toml
abbreviations = ["API", "UI", "CLI"]
```

## Tabbed content

:::tabs
::tab{title="Rendered"}
:::tabs
::tab{title="Python"}
```python
def hello():
    return "world"
```
::tab{title="JavaScript"}
```js
function hello() { return "world"; }
```
::tab{title="Output"}
```
world
```
:::
::tab{title="Markdown Source" copy-from="Rendered"}
:::

Tabs are interactive. Any content (code, prose, images) can go inside a tab.

## Table of contents

```markdown
[TOC]
```

Inserts a table of contents at that position based on all headings in the document.

## Custom heading IDs

```markdown
## My Section {#my-anchor}
```

Link to it with `[link text](#my-anchor)`.

## Math (KaTeX)

```markdown
Inline: $E = mc^2$

Block:
$$
\int_a^b f(x)\,dx = F(b) - F(a)
$$
```

Escape a literal dollar sign with `\$5`.

## Mermaid diagrams

````markdown
```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Done]
    B -->|No| A
```
````

Optional frontmatter to control size:

````markdown
```mermaid
---
width: 80vw
height: 60vh
---
graph TD
    ...
```
````

See `references/diagrams.md` for full Mermaid reference.

## D2 diagrams

````markdown
```d2
---
title: My System
width: 85vw
layout: elk
---
direction: right
web -> api -> db
```
````

See `references/diagrams.md` for full D2 reference.

## YouTube embed

```markdown
[yt:dQw4w9WgXcQ|Optional caption]
```

Renders as a responsive embedded video player.

## Inline code with CSS class

```markdown
`highlighted`{.highlight}
```

Renders as `<span class="highlight">highlighted</span>`. Useful with folder-level `custom.css`.

## Obsidian-style callouts

```markdown
> [!faq]- Can callouts be nested?
> > [!todo] Yes.
```

Supports aliases like `warn`, `error`, `faq`, `help`, `check`, `done`, `summary`, `tldr`, and `cite`, plus fold markers `+` and `-`, nesting, custom titles, and custom types. This is the preferred emitted form.

For richer task cards, prefer markdown task-list syntax instead of custom HTML:

```markdown
- [ ] Write a blog post | author: John Doe | deadline: 2024-12-31 | priority: high | status: in progress | project: Vyasa Blog
```

Recognized task metadata families:

- person: `owner`, `author`, `assignee`, `person`, `user`, `who`
- deadline: `deadline`, `due`, `date`, `when`, `eta`
- priority: `priority`, `urgency`, `severity`, `importance`
- status: `status`, `state`, `phase`
- project: `project`, `bucket`, `area`, `team`, `stream`

## Inline task graphs

For dependency planning, use a fenced `tasks` block inside a normal markdown page:

```markdown
```tasks
title: Sprint Slice
width: 85vw
height: 75vh
---
group G-FE "Frontend"
  task T-001 "Design"
    estimate: 1d
    owner: Alice
  task T-002 "Build"
    estimate: 2d
    owner: Alice
    depends_on: [T-001]
end

task T-003 "Backend"
  estimate: 3d
  owner: Bob
  depends_on: [T-002]

chain Main
  T-001 -> T-002 -> T-003
```
```

Notes:

- `title`, `width`, and `height` belong in the fence frontmatter before `---`.
- Each task starts with `task ID "Title"` with indented attrs below.
- Tasks can be grouped with `group ID "Title" ... end`. Tasks inside inherit `group_id`; the group renders as a collapsible frame in the graph.
- Supported first-class attrs: `estimate`, `depends_on`, `priority`, `points`, `owner`, `phase`.
- `depends_on` uses bracket form: `[T-001, T-002]`.
- `chain Name` followed by `  A -> B -> C` lines declares sequential dependency chains.
- Groups support collapse/expand in the UI. Collapsed state, pill position, and expanded position are persisted back to the file.
- Renderer-owned layout attrs (`graph_x`, `graph_y`, `collapsed`, `pill_x`, `pill_y`) appear in saved source after interaction; treat as implementation detail, not authoring API.
- The block renders as an interactive React Flow graph, not as a code sample.
- Cards are draggable, snap to grid, support edge create/delete and popup editing.
- Group bounds auto-resize as children are dragged; shrink and grow in all directions.
- Warnings (missing deps, cycles, owner overlaps) render in a collapsible panel inside the graph.
- Persisted edits rewrite the fenced block source in the markdown file itself.

## Code snippet includes

```markdown
{* ../../docs_src/stream_json_lines/tutorial001_py310.py ln[1:24] hl[9:11,22] *}
```

Embeds a file as a code block. `ln[start:end]` slices by 1-based source lines, and `hl[...]` highlights original source lines or ranges.

## Explicit heading IDs and permalinks

```markdown
### My Title { #server-sent-events-sse }
```

Uses the explicit id for both the heading anchor and the `¶` permalink/TOC target.


Renders as styled callout boxes.

## Collapsible sections

```markdown
<details>
<summary>Click to expand</summary>

Hidden content here. Supports full markdown inside.

</details>
```

## Smart typography

```markdown
"Curly quotes auto-convert"
-- en-dash
--- em-dash
```

## Page break (print/PDF)

```markdown
\pagebreak
```

## Line block (preserves line breaks)

```markdown
| Roses are red
| Violets are blue
```

## Keyboard shortcuts

```markdown
Press <kbd>Ctrl</kbd> + <kbd>S</kbd> to save.
```

## Citation

```markdown
See Smith et al. [@smith2024].
```

## Cascading folder CSS

Place `custom.css` or `style.css` in any folder. Styles are scoped to that folder's section and cascade to subfolders. See `references/theming.md` for selectors and examples.

## Relative links

```markdown
[Other post](../other-folder/post.md)
[Home](/)
[Section](#heading-anchor)
```

Relative `.md` links are automatically resolved to the correct Vyasa post URLs with HTMX attributes for SPA navigation.

## Images

```markdown
![Alt text](./images/photo.jpg)
![Remote](https://example.com/img.png)
```

Relative image paths are resolved relative to the post's folder.
