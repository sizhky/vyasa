# AGENTS.md

When adding a new Vyasa feature, do not update any skill file automatically.

After the feature is implemented and verified, remind the user by asking literally:

`skill-update`

This is only a reminder prompt. Do not apply the skill update unless the user asks, because the new feature may still have bugs and the skill should only be updated after the behavior is stable.
