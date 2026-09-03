---
title: Code Reference Highlighting
status: draft
owner: yeshwanth
date: 2026-08-27
---

# Code Reference Highlighting

## 1. Summary

Vyasa code links can open a file, line, or symbol. A preview now shows the full file and highlights one target line. This is not enough for change blueprints.

A code reference must state four separate facts:

- where the code is
- which change supplies the evidence
- how much code the reader must see
- which lines need emphasis

This specification adds link attributes for those facts. Vyasa resolves the attributes and renders one or more focused code blocks.

## 2. Problem

A new file can own one complete responsibility. The reader must see the full file. `useFeedImpressionQueue.ts` is one example.

A large function can contain only a few changed blocks. The reader must see the function and the changed blocks. `HomeFeedScreen` is one example.

The current `?symbol=HomeFeedScreen&kind=Function` link finds the definition. It does not show which blocks changed. Manual line links can show the blocks, but line numbers move after edits.

## 3. Goals

- Keep the source path as a normal local Markdown link
- Add revision, display, and focus rules after the link
- Derive changed blocks from Git when possible
- Support full files, symbols, regions, and line ranges
- Support many separate focus ranges in one preview
- Preserve original source line numbers
- Work in normal Markdown and KG card Markdown
- Keep existing links and code includes valid

## 4. Non-goals

- Remote repository access
- Binary-file previews
- A new editor integration
- A required codebase-memory service
- Automatic edits to source files

## 5. Current Behavior

[`render_link_preview_html`](../../vyasa/extensions_builtin/link_preview/routes.py?symbol=render_link_preview_html&kind=Function) reads the full local file and calls `render_code_shell`.

[`linkPreviewSymbolMatch`](../../vyasa/extensions_builtin/link_preview/static/link_preview_target.js?symbol=linkPreviewSymbolMatch&kind=Function) searches rendered text for one symbol definition.

[`scrollLinkPreviewToTarget`](../../vyasa/extensions_builtin/link_preview/static/link_preview.js?symbol=scrollLinkPreviewToTarget&kind=Function) highlights one line and scrolls it into view.

Code includes already support a selected range and separate highlight ranges:

```markdown
{* path/to/file.py ln[1:120] hl[9:11,22] *}
```

[`render_code_shell`](../../vyasa/extensions_builtin/markdown/renderer.py?symbol=render_code_shell&kind=Function) emits source line metadata. The code-tools runtime uses that metadata to highlight several lines.

`GitBackend` can read a file at a commit, branch, or tag. `uncommitted_paths` can detect changed worktree files. Vyasa does not yet calculate changed line ranges.

## 6. Design Principles

The code-reference module must have a small interface. It must hide Git lookup, rename lookup, symbol selection, range calculation, and preview folding.

The Markdown link owns the local path. Attributes after the link own presentation and evidence selection.

Authors state intent. Vyasa calculates line numbers.

Git-derived focus is the default for change blueprints. Manual ranges and named regions are escape hatches.

The server resolves the reference. The browser renders the result. The browser must not repeat Git or symbol-selection logic.

## 7. Author Syntax

Attributes follow the Markdown link on the same line:

```markdown
[Label](../path/to/file.ts){change=dc4967f show=file focus=changed}
```

The attribute list uses space-separated `key=value` items. A quoted value can contain commas or spaces.

The link remains usable when Vyasa ignores or does not understand the attributes.

### 7.1 Grammar

```text
code-reference = markdown-link attribute-list
attribute-list = "{" attribute *(SPACE attribute) "}"
attribute      = key "=" value
value          = bare-value | quoted-value
```

The parser uses the same quoting rules as `_parse_fence_attrs`. Keys are lowercase ASCII with underscores.

### 7.2 Attributes

| Attribute | Values | Default | Purpose |
|---|---|---|---|
| `change` | commit, `base..head`, `worktree` | none | Select the evidence change |
| `show` | `file`, `symbol`, `region`, `lines` | `file` | Select the rendered source area |
| `symbol` | qualified or short name | none | Name the selected symbol |
| `kind` | `Function`, `Method`, `Class`, and existing kinds | none | Narrow symbol lookup |
| `region` | region name | none | Select a named source region |
| `lines` | `start:end` | none | Select one explicit source range |
| `focus` | `changed`, `all`, `ln[...]`, `symbol[...]`, `region[...]`, `match[...]` | `all` | Select emphasized lines |
| `context` | integer from `0` to `20` | `3` | Add nearby lines around focus blocks |
| `view` | `source`, `diff`, `split` | `source` | Select the preview layout |
| `side` | `after`, `before`, `both` | `after` | Select source state |
| `role` | `implementation`, `test`, `context`, `contract` | `implementation` | Explain why the source is linked |
| `follow_renames` | `true`, `false` | `true` | Follow a file across a rename |
| `pin` | content hash | none | Detect drift in manual ranges |

Required pairs:

- `show=symbol` requires `symbol`
- `show=region` requires `region`
- `show=lines` requires `lines`
- `focus=changed` requires `change`
- `side=both` requires `view=diff` or `view=split`

Unknown attributes are errors in `vyasa build` and visible diagnostics in `vyasa dev`.

## 8. Change Semantics

### 8.1 One commit

`change=dc4967f` compares the commit with its first parent. A root commit compares with an empty tree.

A merge commit has more than one valid parent. Vyasa must reject the short form for a merge commit. The author must use an explicit range.

### 8.2 Explicit range

`change=base..head` compares the two resolved commits. Both names can be a branch, tag, or full commit SHA accepted by `GitBackend.resolve_ref`.

### 8.3 Working tree

`change=worktree` compares `HEAD` with staged, unstaged, and untracked content in the current clone.

This form is not reproducible. The preview must show a `worktree` badge. Static builds can reject it unless a build option permits local-only references.

## 9. Primary Examples

### 9.1 New file that owns the full responsibility

```markdown
[User feed impression queue](../shared/src/hooks/feed/useFeedImpressionQueue.ts){change=dc4967f show=file focus=changed}
```

The commit adds the file. All after-side lines are changed, so the full file receives focus.

### 9.2 Changed blocks inside one large function

```markdown
[Mobile feed tracking](../apps/mobile/src/features/feed/homeFeed/HomeFeedScreen.tsx){change=dc4967f show=symbol symbol=HomeFeedScreen kind=Function focus=changed context=3}
```

Vyasa resolves the `HomeFeedScreen` range. It intersects that range with the changed after-side lines. It renders each result with three context lines.

### 9.3 Several symbols in one file

```markdown
[Queue operations](../shared/src/hooks/feed/useFeedImpressionQueue.ts){change=dc4967f show=file focus="symbol[reportVisible],symbol[reportHidden],symbol[flushNow]"}
```

Use this form only when the symbols jointly implement one responsibility. Separate links are clearer when each symbol proves a different leaf.

## 10. Other Selection Cases

### 10.1 Manual disjoint lines

```markdown
[Separated settings](../config/settings.py){show=lines lines=120:190 focus="ln[131:137,166:180]" pin=a1b3c2}
```

Use this when Git and symbol lookup cannot identify the required lines. `pin` hashes the displayed `lines` range and detects drift.

### 10.2 Named region

```markdown
[Feed tracking region](../feed.ts){show=region region=feed-tracking focus=all}
```

Use this for a stable area that can carry `region:` and `endregion` source comments. The existing snippet-region rules apply.

### 10.3 Deleted code

```markdown
[Removed serve-time marking](../feed_service.py){change=dc4967f show=file focus=changed view=diff side=before}
```

The preview reads the base-side file and shows deleted lines. A source-only after view cannot show deleted code.

### 10.4 Before and after

```markdown
[Seen-state change](../feed_service.py){change=dc4967f show=symbol symbol=get_ranked_feed kind=Method focus=changed view=split side=both}
```

Use this when the behavior is clear only through comparison.

### 10.5 Renamed file

`follow_renames=true` finds the path on both sides of the change. A rename-only change shows the new file with a rename badge and no changed-line focus.

### 10.6 Unchanged supporting source

Use `focus=all role=context` for unchanged code that explains a changed call. The preview shows a `context` badge and does not claim that the source changed.

### 10.7 Tests and contracts

Use `role=test` for behavior evidence. Use `role=contract` for request models, schemas, configuration, and database contracts.

## 11. Resolution Model

The code-reference module owns parsing and resolution. Callers provide the link, attributes, and current document path.

The parse result is a `CodeReference`. It contains normalized author intent and no calculated line numbers.

The resolution result is a `ResolvedCodeReference`. It contains:

- canonical local path
- base and head revision ids
- path on each revision side
- selected source range
- focused source ranges
- omitted gaps
- source language
- role and view metadata
- diagnostics

All ranges are inclusive and one-based. Empty ranges are invalid.

### 11.1 Resolution order

1. Parse the link attributes.
2. Resolve the local link from the current Markdown path.
3. Confirm that the path is inside an allowed content root.
4. Find the owning Git repository when `change` is present.
5. Resolve the base and head source states.
6. Follow a rename when `follow_renames=true`.
7. Read the required side or sides.
8. Resolve the `show` range.
9. Resolve the `focus` ranges.
10. Intersect focus ranges with the shown range.
11. Add context and merge overlapping ranges.
12. Calculate omitted gaps and render metadata.

### 11.2 Changed-line mapping

Vyasa uses Dulwich and must not start a Git subprocess.

For an added file, every after-side line is changed. For a deleted file, every before-side line is changed.

For a modified file, the resolver records before-side and after-side ranges for each diff hunk. Modified lines appear as a deletion and an addition in diff views.

For an untracked worktree file, every line is changed. For a binary file, the resolver returns an unsupported-file diagnostic.

## 12. Source Selection

### 12.1 File

`show=file` selects all lines on the requested side. It is also the fallback display for old links without attributes.

### 12.2 Symbol

`show=symbol` must resolve the full symbol range, not only its definition line.

Python uses the standard-library AST and its `lineno` and `end_lineno` data.

JavaScript, TypeScript, and TSX use a Tree-sitter adapter. Other languages can add adapters behind the same internal interface.

A short symbol name must resolve to one range after `kind` filtering. Several matches produce an ambiguous-symbol diagnostic. A qualified symbol name can select a nested method.

The current `linkPreviewSymbolMatch` text search remains for old links. A new code reference must not silently use that heuristic for range selection.

If a language has no range adapter, Vyasa asks the author to use `show=region` or `show=lines`.

### 12.3 Region

`show=region` uses the region markers defined by the snippet-anchor specification. A missing or duplicate region is an error.

### 12.4 Lines

`show=lines` reads one inclusive range. A range outside the file is an error. A `pin` mismatch is an error in builds and a diagnostic in development.

## 13. Focus and Folding

`focus=changed` selects the diff ranges for the requested side. It then intersects them with the shown range.

`focus=all` selects the full shown range.

`focus=ln[...]` supports comma-separated single lines and ranges. Colons and hyphens are accepted as range separators.

`focus=symbol[...]` and `focus=region[...]` can repeat inside one quoted value.

`focus=match[...]` selects every line that contains the literal text. Use it for a name that one
function rebinds many times, where no single symbol range exists. The literal keeps its commas and
spaces, but it cannot hold a `]`. A literal that matches no line raises `match_not_found`.

Vyasa adds `context` lines before and after each focus range. It clips context to the shown range.

Overlapping or adjacent rendered ranges merge. Separate ranges stay separate and receive an omission row between them.

The omission row shows the number of hidden lines and can expand in place. Expansion must not change source line numbers.

## 14. Preview UI

### 14.1 Header

The preview header shows:

- repository-relative path
- selected symbol, region, or line range
- change or revision badge
- role badge
- changed-line count
- open-in-editor action
- open-full-file action

The header shows both old and new paths for a rename.

### 14.2 Source view

`view=source` shows source from `side=after` by default. Focused lines use the code highlight accent. Context lines use the normal code background.

An added file can highlight all lines. A changed symbol can show several focused blocks with omission rows.

The first focused block scrolls into view. The reader can move to the next or previous block with controls and keyboard shortcuts.

### 14.3 Diff view

`view=diff` shows a unified diff. Added lines use the add color. Deleted lines use the delete color. Context lines keep the normal background.

`view=split` shows before and after panes with synchronized scrolling. It is valid only with `side=both`.

### 14.4 Existing actions

Each visible line keeps its original source line number. The line-number action continues to open that line in VS Code.

Copy copies visible code by default. A second action copies the full shown range.

### 14.5 Accessibility

Color is not the only change signal. Added, deleted, focused, and context lines have text labels for assistive technology.

All controls are keyboard reachable. Focus order follows the visual order. Omission rows state how many lines they hide.

## 15. Module Design

### 15.1 Code-reference module

Add `vyasa/extensions_builtin/link_preview/code_reference.py`.

This module owns:

- `CodeReference` parsing and validation
- `ResolvedCodeReference` output
- revision and rename resolution
- file and range loading
- symbol, region, and line selection
- diff-range calculation
- context and omission calculation

Its public interface accepts author intent and returns render-ready source blocks. Callers do not calculate line numbers.

### 15.2 Markdown integration

Add a link-preview Markdown inline element for a link followed by `{...}`. It must run before the standard link token consumes the link.

The renderer emits the normal `href` plus `data-vyasa-code-reference` with normalized JSON. Standard links remain unchanged.

KG card Markdown uses the same renderer. It needs no KG-specific parser rule.

### 15.3 Preview request

`fetchPreview` reads `data-vyasa-code-reference`. It sends the JSON in a separate `code_ref` query parameter to `/preview/link`.

The link `href` stays clean. Editor actions and normal navigation continue to use the local path.

### 15.4 Preview route

`render_link_preview_html` delegates code references to the new module. Plain links keep the current path.

The route calls `render_code_shell` for source blocks. Diff blocks use the same code-tools runtime with added line-state metadata.

### 15.5 Git access

Extend `GitBackend` with read-only change operations. Use Dulwich object trees for committed changes and Dulwich status plus worktree reads for `change=worktree`.

Cache results by repository, canonical path, base SHA, head SHA, and normalized attributes. Worktree cache keys also include file revision data.

### 15.6 Browser runtime

For new code references, the browser uses server-provided ranges. `linkPreviewSymbolMatch` remains only for old symbol-query links.

## 16. Render Contract

The preview shell adds:

- `data-code-reference-role`
- `data-code-reference-view`
- `data-code-reference-base`
- `data-code-reference-head`
- `data-code-reference-path-before`
- `data-code-reference-path-after`

Each code line keeps `data-source-line`. It can also have:

- `data-code-focus="true"`
- `data-code-change="added"`
- `data-code-change="deleted"`
- `data-code-change="context"`

An omission row has `data-code-omitted-start`, `data-code-omitted-end`, and an expand action.

The route returns an inline diagnostic card when development mode permits recovery. Static builds fail before HTML output for invalid references.

## 17. Safety

- Resolve every path inside an allowed content root
- Reject path traversal and symlink escape
- Resolve refs through `GitBackend.resolve_ref`
- Never execute a Git subprocess
- Escape source, labels, paths, and diagnostics before HTML output
- Allow `worktree` only for a local clone
- Do not read ignored credentials through a relative link outside content roots
- Reject binary content before syntax rendering

## 18. Limits and Performance

Initial limits:

| Limit | Default |
|---|---:|
| Source file size | 2 MiB |
| Rendered source lines | 500 |
| Focus ranges | 50 |
| Context lines per side | 20 |
| Attribute payload | 4 KiB |

When selected content exceeds a limit, Vyasa returns a diagnostic with an open-full-file action.

Committed references are immutable and cacheable. Worktree references use file revision data and repository status in the cache key.

## 19. Diagnostics

Diagnostic codes are stable and testable:

| Code | Meaning |
|---|---|
| `invalid_attribute` | Unknown key or value |
| `missing_attribute` | Required paired attribute is absent |
| `ref_not_found` | Git ref cannot resolve |
| `merge_base_required` | Short change form names a merge commit |
| `path_not_found` | File does not exist on the required side |
| `path_outside_root` | Local path escapes allowed roots |
| `rename_ambiguous` | More than one rename target matches |
| `symbol_not_found` | Symbol range cannot resolve |
| `symbol_ambiguous` | Several symbol ranges match |
| `language_unsupported` | No strict symbol-range adapter exists |
| `region_not_found` | Named region does not exist |
| `region_duplicate` | Named region occurs more than once |
| `range_invalid` | Line range is empty or outside the file |
| `pin_mismatch` | Manual range content changed |
| `no_changed_lines` | Change does not touch the shown range |
| `binary_unsupported` | File is not renderable text |
| `worktree_disallowed` | Static build forbids local-only evidence |

`no_changed_lines` is a warning. It renders the selected source with no focused lines and a clear badge. Other author errors fail static builds.

## 20. Compatibility

Links without an attribute list keep current behavior.

Old `?symbol=...&kind=...` links keep the current one-line symbol targeting. They do not gain strict symbol-range claims automatically.

Existing `:line`, `:line:column`, and heading fragments keep current behavior.

Existing `{* ... ln[...] hl[...] *}` includes keep current behavior. The new module should reuse their range parser and hash rules instead of creating a second grammar.

VS Code line actions keep their current `relativePath:line` form.

## 21. Delivery Order

1. Parse and render attribute-bearing links without changing plain links.
2. Add committed file diffs and `show=file`.
3. Add source folding and many focus ranges.
4. Add strict Python and JS/TS/TSX symbol ranges.
5. Add diff and split views.
6. Add `worktree`, rename following, regions, and pinned lines.
7. Convert selected Blueprint links after each stage passes its tests.

## 22. Test Plan

### 22.1 Parser tests

- Parse every valid attribute and default
- Parse quoted multi-range values
- Reject unknown values and missing pairs
- Leave plain Markdown links unchanged
- Preserve clean `href` output and serialize normalized metadata

### 22.2 Git resolver tests

- Added, modified, deleted, and rename-only files
- One commit, explicit range, root commit, and merge rejection
- Branch, tag, and full SHA lookup
- Staged, unstaged, and untracked worktree files
- Path on before and after sides
- Path escape and missing-ref rejection

### 22.3 Selection tests

- Full file
- Python function, method, class, and nested method
- JS, TS, and TSX function and class ranges
- Ambiguous and missing symbols
- Named region and duplicate region
- Pinned and drifting line ranges
- Changed focus intersected with one symbol
- Several disjoint focus ranges with context
- Overlap merge and omission-row calculation

### 22.4 Render tests

- Source, unified diff, and split views
- Original source line numbers
- Added, deleted, focused, and context metadata
- Role and revision badges
- Rename header
- Empty focus warning
- Escaped source and diagnostic text

### 22.5 Browser tests

- First focus block receives initial scroll
- Next and previous focus controls
- Omission row expansion
- Keyboard access and focus order
- Copy visible and copy full range
- Open-in-editor line action
- Old symbol-query preview path

### 22.6 End-to-end acceptance

The new `useFeedImpressionQueue.ts` example renders the full file with all added lines focused.

The `HomeFeedScreen` example renders only the function range and focuses all separate changed blocks.

## 23. Expected Code Changes

### New files

- `vyasa/extensions_builtin/link_preview/code_reference.py`
- `vyasa/extensions_builtin/link_preview/code_reference_markdown.py`
- `vyasa/extensions_builtin/link_preview/static/code_reference.js`
- `vyasa/extensions_builtin/link_preview/static/code_reference.css`

### Changed files

- `vyasa/extensions_builtin/markdown/renderer.py` to register the inline element, preserve link metadata, and reuse `render_code_shell`
- `vyasa/extensions_builtin/link_preview/routes.py` to call the resolver
- `vyasa/extensions_builtin/link_preview/static/link_preview.js` to send metadata and install controls
- `vyasa/extensions_builtin/link_preview/static/link_preview_target.js` to keep legacy targeting separate
- `vyasa/extensions_builtin/link_preview/static/link_preview.css` to style diagnostics and focused blocks
- `vyasa/extensions_builtin/code_tools/static/code_tools_lines.js` to support line-state fragments
- `vyasa/content_backend.py` to expose read-only diff and rename operations
- `pyproject.toml` and `uv.lock` for strict JS/TS/TSX symbol parsing
- `tests/test_link_preview.py`, `tests/test_markdown_renderer.py`, and `tests/test_callouts.py` for all new test cases

## 24. Dependency Decision

Python symbol ranges use the standard library and add no package.

JS, TS, and TSX need a parser that returns exact node ranges. Add Tree-sitter and only the required language grammars.

Keep the parser behind the internal symbol-range interface. A missing optional grammar produces `language_unsupported`; it does not fall back to guessed ranges.

## 25. Risks and Controls

| Risk | Control |
|---|---|
| Link attributes conflict with literal braces | Consume braces only when they immediately follow a link and contain known keys |
| Large diffs slow previews | Cache committed results and enforce file and line limits |
| Worktree results become stale | Include status and file revision data in cache keys |
| Rename detection finds several paths | Return `rename_ambiguous` and require an explicit path |
| Symbol grammar is unavailable | Require a region or line range |
| Theme color hides meaning | Add text and assistive labels |
| Manual range drifts | Require `pin` for strict builds |
| New syntax leaks into normal navigation | Keep attributes in data metadata, not in `href` |

## 26. Observability

Development diagnostics include the document path, source path, normalized attributes, and diagnostic code.

Do not log source content. Do not log repository credentials or full remote URLs.

Debug logs record resolver time, diff time, symbol-selection time, rendered-line count, and cache result.

Static builds print a summary:

```text
code references: 42 valid, 2 warnings, 0 errors
```

The summary groups references by `role`, `show`, `focus`, and diagnostic code.

## 27. Acceptance Criteria

1. A normal Markdown link renders exactly as it does today.
2. A code-reference link keeps a clean local `href`.
3. The attribute list works in normal Markdown and KG card Markdown.
4. `change=dc4967f show=file focus=changed` focuses every line in a file added by that commit.
5. `show=symbol symbol=HomeFeedScreen focus=changed` shows the full strict symbol range and every changed block inside it.
6. Separate changed blocks keep original line numbers and show omission rows.
7. Added, modified, deleted, renamed, and worktree files have defined results.
8. Manual lines can use a content pin. Named regions survive line movement.
9. Unsupported strict symbol lookup produces a diagnostic and no guessed range.
10. Old symbol-query, line, heading, and code-include syntax remains valid.
11. Source paths cannot escape allowed content roots.
12. Static builds fail on invalid author references.
13. Development mode shows a useful diagnostic card.
14. All controls work with a keyboard and do not depend on color alone.
15. The end-to-end examples pass in browser tests.

## 28. Final Design Decision

Vyasa will treat code evidence as a first-class reference. Authors select intent with a small attribute interface. The server calculates source ranges. The browser presents those ranges without reinterpreting them.

This design supports full-file ownership and precise multi-block changes with one syntax. It also gives deleted code, context code, tests, and contracts an honest display model.
