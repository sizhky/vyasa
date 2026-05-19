# Callouts

Use Obsidian-style callouts:

```md
> [!note] Title
> Body
```

## Shapes

```md
> [!warning] Careful
> Visible by default.

> [!faq]- Closed question
> Starts collapsed.

> [!todo]+ Open task
> Starts expanded.
```

Fold markers:

- `+` means default open.
- `-` means default closed.
- No marker uses default callout behavior.

## Nesting

```md
> [!faq]- Can callouts nest?
> > [!todo] Yes.
> > Use nested blockquotes.
```

## Types

Prefer supported Obsidian aliases:

- `note`, `abstract`, `summary`, `tldr`
- `info`, `todo`, `tip`, `hint`, `important`
- `success`, `check`, `done`
- `question`, `help`, `faq`
- `warning`, `warn`, `caution`, `attention`
- `failure`, `fail`, `missing`
- `danger`, `error`, `bug`
- `example`, `quote`, `cite`

Custom types are allowed.
Style them through `data-callout="your-type"` in `custom.css`.
Do not add renderer logic unless the user explicitly wants core support.

## Task Cards

For richer task cards, prefer markdown task-list syntax:

```md
- [ ] Write post | owner: Jane | due: 2026-06-01 | priority: high
```

Recognized metadata families:

- person: `owner`, `author`, `assignee`, `person`, `user`, `who`
- deadline: `deadline`, `due`, `date`, `when`, `eta`
- priority: `priority`, `urgency`, `severity`, `importance`
- status: `status`, `state`, `phase`
- project: `project`, `bucket`, `area`, `team`, `stream`
