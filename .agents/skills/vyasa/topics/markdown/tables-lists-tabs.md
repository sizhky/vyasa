# Tables, Lists, Tabs

Tables default to a per-cell max width of `33vw`.
Override globally with `.vyasa` `table_col_max_width` or per table with:

```md
<!-- table max-col=24vw -->
```

For long table content, prefer literal `<br/>` line breaks inside cells.

## Tables

```md
<!-- table max-col=24vw -->
| Feature | Notes |
|---|---|
| Long cell | First line<br/>Second line<br/>Third line |
```

Rules:

- Use literal `<br/>` inside cells when prose gets visually noisy.
- Prefer the per-table comment for one-off wide tables.
- Use `.vyasa` `table_col_max_width` for site or folder defaults.

## Task Lists

Use markdown task-list items for lightweight task cards:

```md
- [ ] Task | owner: Jane | deadline: Tomorrow | priority: high
- [x] Done task | status: done | project: Vyasa
```

Metadata families:

- person: `owner`, `author`, `assignee`, `person`, `user`, `who`
- deadline: `deadline`, `due`, `date`, `when`, `eta`
- priority: `priority`, `urgency`, `severity`, `importance`
- status: `status`, `state`, `phase`
- project: `project`, `bucket`, `area`, `team`, `stream`

Use `items`/`tasks` fences for dependency graphs, not flat task lists.

## Tabs

Use Vyasa's supported tabbed content syntax.
Do not invent new tab fences.
When editing parser behavior, inspect the existing tab implementation and keep headings inside tab blocks from becoming slide/page boundaries.
