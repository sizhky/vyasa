# AGENTS.md

When adding a new Vyasa feature, do not update any skill file automatically.

After the feature is implemented and verified, remind the user by asking literally:

`skill-update`

This is only a reminder prompt. Do not apply the skill update unless the user asks, because the new feature may still have bugs and the skill should only be updated after the behavior is stable.

Remember during refactoring tasks, do not rewrite the same code. Like a human does, use awk and sed to cut paste code snippets to reduce token usage and avoid introducing new bugs. Only rewrite code when necessary, such as when the code is too messy to be cut and pasted.

Do not test anything by opening browser unless I ask you to do so. Any test you run should be testable in milliseconds only - like python -m or javascript's mjs etc..