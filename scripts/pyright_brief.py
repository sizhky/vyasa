#!/usr/bin/env python3
"""Collapse `pyright --outputjson` into one terse line per error.

Errors only (warnings/info dropped), repo-relative path, message squashed to its
first line: `path:line:col rule: message`. Keeps type-check output small enough for
an LLM to read. Exit 1 if any error, mirroring pyright.
"""
import json
import sys

# Rules that flag real runtime/type-safety bugs (wrong arg, bad return, None access,
# missing attribute, ...). Library-stub gripes like reportPrivateImportUsage are
# excluded — they are noise an LLM should not act on. Pass --all to show every error.
CRITICAL = {
    "reportArgumentType", "reportReturnType", "reportCallIssue", "reportAssignmentType",
    "reportAttributeAccessIssue", "reportIndexIssue", "reportOperatorIssue",
    "reportOptionalMemberAccess", "reportOptionalSubscript", "reportOptionalCall",
    "reportOptionalIterable", "reportGeneralTypeIssues", "reportRedeclaration",
    "reportUndefinedVariable", "reportPossiblyUnbound",
}
show_all = "--all" in sys.argv[1:]

data = json.load(sys.stdin)
errors = [
    d for d in data.get("generalDiagnostics", [])
    if d.get("severity") == "error" and (show_all or d.get("rule") in CRITICAL)
]
for d in errors:
    path = d.get("file", "").split("/vyasa/")[-1]
    start = d.get("range", {}).get("start", {})
    line, col = start.get("line", 0) + 1, start.get("character", 0) + 1
    rule = d.get("rule") or "error"
    msg = (d.get("message") or "").splitlines()[0]
    print(f"{path}:{line}:{col} {rule}: {msg}")
print(f"-- {len(errors)} errors --")
sys.exit(1 if errors else 0)
