---
title: Wiki Links Lab
---

# Wiki Links Lab

This folder is a test cave for current and future wiki-link behavior.

## Notes

- Live tab shows rendered link.
- Source tab shows exact wiki syntax.
- Raw unresolved output is intentional where ambiguity exists.

## Current Behavior

### Unique basename
:::tabs
::tab{title="Live link"}
- [[branch-b/deep/nested-note]]
::tab{title="Source"}
```md
[[branch-b/deep/nested-note]]
```
:::

### Heading jump
:::tabs
::tab{title="Live link"}
- [[branch-b/deep/nested-note#Target Section]]
::tab{title="Source"}
```md
[[branch-b/deep/nested-note#Target Section]]
```
:::

### Nested heading chain
:::tabs
::tab{title="Live link"}
- [[branch-b/deep/nested-note#Target Section#Child Hop]]
::tab{title="Source"}
```md
[[branch-b/deep/nested-note#Target Section#Child Hop]]
```
:::

### Explicit heading id
:::tabs
::tab{title="Live link"}
- [[branch-b/deep/nested-note#named-target]]
::tab{title="Source"}
```md
[[branch-b/deep/nested-note#named-target]]
```
:::

### Custom label
:::tabs
::tab{title="Live link"}
- [[branch-b/deep/nested-note|Open nested note with custom label]]
::tab{title="Source"}
```md
[[branch-b/deep/nested-note|Open nested note with custom label]]
```
:::

### Path-qualified duplicate resolution
:::tabs
::tab{title="Live link"}
- [[branch-a/overview]]
- [[branch-b/overview]]
::tab{title="Source"}
```md
[[branch-a/overview]]
[[branch-b/overview]]
```
:::

### Ambiguous basename stays raw
:::tabs
::tab{title="Live link"}
- [[overview]]
::tab{title="Source"}
```md
[[overview]]
```
:::

### Alias resolution
:::tabs
::tab{title="Live link"}
- [[lab root alias]]
- [[branch a overview alias]]
- [[wiki aliases#Alias Section]]
::tab{title="Source"}
```md
[[lab root alias]]
[[branch a overview alias]]
[[wiki aliases#Alias Section]]
```
:::

### Ambiguous alias stays raw
:::tabs
::tab{title="Live link"}
- [[shared overview alias]]
::tab{title="Source"}
```md
[[shared overview alias]]
```
:::

### Folder note resolution
:::tabs
::tab{title="Live link"}
- [[branch-b/deep]]
- [[deep hub]]
- [[branch-b/deep#Folder Entry]]
::tab{title="Source"}
```md
[[branch-b/deep]]
[[deep hub]]
[[branch-b/deep#Folder Entry]]
```
:::

### Self heading resolution
:::tabs
::tab{title="Live link"}
- [[#Current Behavior]]
- [[#Folder note resolution]]
::tab{title="Source"}
```md
[[#Current Behavior]]
[[#Folder note resolution]]
```
:::

### Relative upward navigation
:::tabs
::tab{title="Live link"}
- [[../aliases]]
- [[branch-b/deep/../overview]]
::tab{title="Source"}
```md
[[../aliases]]
[[branch-b/deep/../overview]]
```
:::

## Future Behavior To Add

- Block refs: `[[note#^block-id]]`
- Vault-wide shortest unique path serialization when author types only basename
- Rename propagation for wiki links using stable ids instead of raw text
- Better ambiguity diagnostics in rendered output
