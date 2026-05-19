# AGENTS.md

When adding a new Vyasa feature, do not update any skill file automatically.

After the feature is implemented and verified, remind the user by asking literally:

`skill-update`

This is only a reminder prompt. Do not apply the skill update unless the user asks, because the new feature may still have bugs and the skill should only be updated after the behavior is stable.

Remember during refactoring tasks, do not rewrite the same code. Like a human does, use awk and sed to cut paste code snippets to reduce token usage and avoid introducing new bugs. Only rewrite code when necessary, such as when the code is too messy to be cut and pasted.

Treat code smells as first-class work, not cosmetic trivia. When a request exposes bad architecture, fix the architecture behind the visible bug, not only the symptom; for example, do not let sidebar files, folders, bookmarks, and git-ref buttons each invent their own row classes, padding, JS click behavior, icons, or active-state logic. Other smell examples: duplicated HTML strings across Python and JS, one-off CSS utility piles instead of a shared semantic class, fallback JS markup that drifts from server-rendered markup, plugin behavior that bypasses core row contracts, and tests that only prove the current screenshot instead of locking the shared contract.

When you notice nearby smells while doing the requested work, name them plainly and ask before fixing them unless they are required to complete the current fix. If the smell is required for the requested behavior, say that and fix it as part of the task. If it is adjacent cleanup, ask permission first with a short note like: `Found smell: <specific issue>. Fix it too?`

Do not test anything by opening browser unless I ask you to do so. Any test you run should be testable in milliseconds only - like python -m or javascript's mjs etc..
Do not start work if commit is dirty. Make the user aware. Don't make any commits.