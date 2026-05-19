# Static Build Workflow

Typical workflow:

1. Write content.
2. Preview with hot reload.
3. Build static output.
4. Serve the output locally.
5. Deploy the generated folder.

For tests, prefer fast CLI or unit-level checks unless the user asks for browser testing.
When static and runtime disagree, fix the shared render/build contract instead of patching one output path only.
