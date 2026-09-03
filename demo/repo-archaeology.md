---
title: Repo Archaeology — 998 commits, read as a shape
---

# Repo Archaeology

Every git history is a data set. This page reads one: **this repository**, from its first commit to its most recent.

All numbers come from `git log` on `main`. The commands are at the bottom. Nothing here is estimated. Every chart on this page is a `visuals` fence — see [[demo/visuals|visuals]] for the syntax.

```card columns=5
998 | commits
263 | calendar days
142 | days with a commit
7.0 | commits per active day @accent
550 | tracked files today
```

Work happened on 54% of the calendar. On the days it happened, it happened in bursts of seven.

---

## Volume by month

Nine months, but not nine equal months. These rows come from a file rather than the fence body:

```bar title="Commits per month" total=sum src="data/repo-archaeology.json" select="commits_by_month"
```

The first and last months are partial. December starts on the 11th; August ends on the 30th.

February is the odd one. It holds 15.5% of all commits, and it sits between two quiet months. Something happened in February. Hold that thought.

---

## The finding: commit discipline collapsed, then came back

A commit subject either follows the `type(scope): summary` convention or it does not. That is a clean binary. Across the whole history, **247 of 998 subjects follow it — 24.7%**.

That single average hides the real story. Split it by month, as a rate out of 100:

```bar title="Share of subjects following the convention" max=100 note="Read as a percentage. The average of 24.7% describes no month in this history."
Dec 2025 | 77
Jan 2026 | 95
Feb 2026 | 0 @warn
Mar 2026 | 17 @accent
Apr 2026 | 1 @warn
May 2026 | 12 @accent
Jun 2026 | 13 @accent
Jul 2026 | 22 @accent
Aug 2026 | 60
```

The shape is a **U**, not a slope. Discipline ran at 77% and 95%. It fell to exactly zero for a month of 155 commits. It stayed near the floor for four months. It is now climbing: 22%, then 60%. Over the most recent 50 commits it is **70%**.

An average of 24.7% would have told you the project is sloppy. The monthly split tells you the project had a habit, lost it, and is rebuilding it. Those need different responses.

---

## What broke in February

The convention was carried almost entirely by one prefix: `checkpoint:`.

```bar title="Conventional prefixes across the whole history" sort=desc
checkpoint: | 109 @accent
feat: | 71
fix: | 42
style: | 11 @muted
refactor: | 6 @muted
docs: | 4 @muted
others | 4 @muted
```

Every one of those 109 `checkpoint:` commits landed in December 2025 or January 2026. The prefix appears **zero** times after that.

The reason is in the file tree, not the messages. The package was called `bloggy` until **2026-02-04**, when it was renamed to `vyasa`. The last `bloggy/` commit and the first `vyasa/` commit share that date.

```stack title="Project lifetime, in days" note="bloggy: 2025-12-11 to 2026-02-04. vyasa: 2026-02-04 to 2026-08-30."
bloggy | 56
vyasa | 207
```

`bloggy` lived 56 days and 126 commits. Of those 126, 109 were checkpoints — **86.5%**. The rename ended the era and the habit at the same time. February then absorbed 155 commits of restructuring, none of them formatted.

The lesson is not "write better messages." It is that a large rename resets conventions unless something enforces them.

---

## When the work happens

Commits carry a local timestamp. Grouped into six-hour bands:

```bar title="Commits by time of day" total=sum src="data/repo-archaeology.json" select="commits_by_hour_band"
```

The busiest single hour is **22:00**, with 93 commits. The quietest is 03:00, with none. Midnight holds 48 — more than any hour before 09:00.

```bar title="Commits by weekday" total=sum src="data/repo-archaeology.json" select="commits_by_weekday" sort=desc
```

Friday is the peak. Saturday is the floor — lower than any weekday. Sunday recovers to 139, above Monday. The week does not end on Friday here; it dips for one day and restarts on Sunday evening.

---

## Where the churn concentrates

Count how many commits touched each file. Ten files carry most of the history.

```bar title="Commits touching each file" total=998 note="Share is of all 998 commits, so the column does not sum to 100."
extensions_builtin/tasks/static/tasks.js | 264 @accent
vyasa/static/scripts.js | 154
vyasa/core.py | 141
tests/test_tasks_rendering.py | 141 @good
pyproject.toml | 127 @muted
settings.ini | 90 @muted
bloggy/core.py (retired) | 89 @muted
bloggy/__init__.py (retired) | 87 @muted
vyasa/static/header.css | 77 @muted
tests_js/tasks_graph_core.test.mjs | 63 @good
```

One file, `tasks.js`, appears in **more than one commit in four**. That is a hotspot. Hotspots are where defects gather, and they are the strongest single predictor of future change — Adam Tornhill's *Your Code as a Crime Scene* builds its whole method on this signal.

The healthy sign sits two rows below it. `test_tasks_rendering.py` has 141 touches against the source file's 264 — the test moves when the code moves. Compare `header.css` at 77, which has no test file near it in this list at all.

---

## The tree today

550 tracked files. Where they live:

```stack title="Tracked files by directory"
vyasa/ | 255
demo/ | 133
.agents/ | 57
tests + tests_js | 36
docs, root, other | 69
```

A quarter of the repository is demo content, and a tenth is agent instructions. Only 6.5% is test code.

```bar title="Tracked files by type" total=sum
.py | 184
.md | 127 @accent
.js / .mjs | 48 @muted
everything else | 191 @muted
```

Markdown is 23% of the file count. For a markdown renderer, the content is part of the test surface.

There is a mismatch worth naming. JavaScript is 8.7% of files but holds the two highest-churn files in the repo. Effort does not follow file count.

---

## One more shape: message length

```bar title="Commit subject length" total=sum
1-20 ch | 279 @accent
21-40 ch | 367
41-60 ch | 265
61-80 ch | 60 @muted
81+ ch | 27 @muted
```

91.3% of subjects fit inside 60 characters. Git's own convention caps the subject at 50 and hard-wraps at 72. This history respects that without a hook enforcing it.

Note what this proves and what it does not. Short subjects are a formatting habit. The February collapse showed the *semantic* habit — the `type(scope):` prefix — is the fragile one. Length survived the rename. Structure did not.

---

## What to take from this

> [!tip] The invariant
> An average over a time series hides regime changes. Always split by time before you judge a rate.
>
> Two other places it applies: a p50 latency that looks flat while p99 doubles after a deploy, and a test suite whose pass rate holds at 98% because one flaky file fails half the time.

Three things this history says plainly:

1. **February 2026 was a regime change, not a busy month.** The rename from `bloggy` to `vyasa` reset a convention that nothing enforced. A commit-message hook would have caught it on the first commit, not nine months later.
2. **`tasks.js` earns a hard look.** 264 touches out of 998 commits is a concentration, not a coincidence. Its test file tracks it, which is the reason it has stayed workable.
3. **The habit is returning on its own.** 60% in August, 70% over the last 50 commits. That is a trend worth locking in while it is climbing.

---

## Reproduce it

Every figure above comes from these commands. Run them in this repository.

```bash
git rev-list --count HEAD
git log --format=%ad --date=short | sort -u | wc -l
git log --format=%ad --date=format:%Y-%m | sort | uniq -c
git log --format=%s | grep -cE '^[a-z]+(\([a-z0-9_/.-]+\))?!?: '
git log --format=%ad --date=format:%H | sort | uniq -c
git log --format=%ad --date=format:%u-%a | sort | uniq -c
git log --format='' --name-only | grep -v '^$' | sort | uniq -c | sort -rn | head -15
git ls-files | awk -F/ '{print $1}' | sort | uniq -c | sort -rn
```

The one that produced the U-curve:

```bash
git log --format='%ad|%s' --date=format:%Y-%m \
  | awk -F'|' '{t[$1]++; if ($2 ~ /^[a-z]+(\([a-z0-9_\/.-]+\))?!?: /) c[$1]++} \
               END {for (m in t) printf "%s %d/%d\n", m, c[m], t[m]}' \
  | sort
```

---

*Data window: 2025-12-11 to 2026-08-30. Three charts read their rows from [repo-archaeology.json](data/repo-archaeology.json); the rest are written inline.*
