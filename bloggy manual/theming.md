# Theming & CSS

Bloggy loads CSS from a few places to let you customize layout and content styles.

## CSS loading order

1. Framework CSS (bundled)
2. Root-level `custom.css` or `style.css`
3. Folder-specific `custom.css` or `style.css` (scoped to that folder)

## Folder-scoped CSS

Put `custom.css` in a subfolder to target only the posts in that folder. Bloggy scopes that CSS automatically so it doesn’t affect the rest of the site.

## Tips

- Use folder-scoped CSS for book-like sections.
- Keep global styles minimal and let per-folder overrides do the heavy lifting.

## Custom Styling with Cascading CSS

Bloggy supports **cascading custom CSS** at multiple levels, allowing you to style your entire blog globally or customize specific sections:

### CSS Loading Order

1. **Framework CSS** (`bloggy/static/custom.css`) - Core styling for Bloggy itself
2. **Blog-wide CSS** (`/your-blog-root/custom.css`) - Applies to all posts
3. **Folder-specific CSS** (`/your-blog-root/section/custom.css`) - Applies only to posts in that folder

Each level can override styles from previous levels, following standard CSS cascade rules.

### Pandoc-style Inline Attributes

Use backticks with attributes to add semantic classes to inline text:

:::tabs
::tab{title="Markdown Example"}
The variables `x`{.abcd}, `y`{.abcd}, and `z`{.abcd} represent coordinates.
Use `important`{.emphasis} for highlighted terms.
::tab{title="CSS"}
```css
span.abcd {
     font-family: monospace;
     background-color: #f0f0f0;
     padding: 2px 4px;
     border-radius: 4px;
 }
```
:::

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

**Section level** (`/blog/tutorials/custom.css`) - Tutorial-specific (auto-scoped to `#main-content.section-tutorials`):
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

**Chapter level** (`/blog/tutorials/advanced/custom.css`) - Advanced chapter styling (auto-scoped to `#main-content.section-tutorials-advanced`):
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

Note: Folder-specific CSS is automatically wrapped by Bloggy with the appropriate section scope, so you don't need to write the `#main-content.section-*` wrapper yourself.

### Real Example from Demo

See the `demo/books/flat-land/` folder for a working example:

**Markdown** (`demo/books/flat-land/chapter-02.md`):
```markdown
The two Northern sides `RO`{.variable}, `OF`{.variable}, constitute the roof.
```

**CSS** (`demo/books/flat-land/custom.css`):
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
