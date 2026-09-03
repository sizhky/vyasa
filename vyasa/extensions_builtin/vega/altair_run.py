"""Run an Altair fence body and return its Vega-Lite spec.

The body is Python, so a figure the author can derive stays derived instead of
being pasted in as a literal. Two layers stand between the body and the host:

1. An AST pass rejects imports, dunder names, and the builtins that reach the
   filesystem or the interpreter. This is what stops reads and introspection.
2. `safepyrun` blocks writes, subprocesses and network at runtime, and rejects
   `def`, `class`, `exec`, `eval` and `compile` itself.
3. An audit hook denies `open`, `os.listdir`, `os.scandir`, `os.stat` and
   `import` for the duration of the run, catching anything the AST pass missed.

Pro: `chart.to_dict()` is already a Vega-Lite spec, so the browser side needs
no change and one theme serves both fence kinds.
Con: this is not a boundary against a determined author -- `safepyrun` says so
of itself. It stops accidents and casual mischief in files you wrote.
"""

from __future__ import annotations

import ast
import asyncio
import concurrent.futures as cf
import contextvars
import math
import sys
from typing import Any

# `sys._getframe` is deliberately absent: safepyrun walks the call stack itself,
# so denying it kills the sandbox rather than the fence body.
AUDIT_EVENTS = frozenset({"open", "os.listdir", "os.scandir", "os.stat", "import"})

# `alt` and `math` are already bound, so the body needs no imports -- but an
# author writing Python will reach for them anyway. Allowing exactly the two
# modules that are already loaded costs nothing: the statement resolves from
# `sys.modules` and imports nothing new. Anything else stays refused.
IMPORTABLE = frozenset({"altair", "math"})

BANNED_NAMES = frozenset(
    {
        "open",
        "eval",
        "exec",
        "compile",
        "input",
        "breakpoint",
        "getattr",
        "setattr",
        "delattr",
        "vars",
        "globals",
        "locals",
        "dir",
        "help",
        "memoryview",
        "exit",
        "quit",
    }
)

_DENYING = contextvars.ContextVar("vyasa_altair_denying", default=False)
_hook_installed = False
_warmed = False


# Altair validates every schema object it builds, and `jsonschema` does that
# through a `referencing.Registry` backed by `rpds`, a native extension.
# safepyrun blocks calls into native code it has not been told about, so the
# fence body would die inside Altair rather than in the author's own code.
# `rpds` is a persistent-collections library with no filesystem, process or
# network surface, so exempting it costs nothing this sandbox was protecting.
SAFE_NATIVE_PREFIXES = ("rpds.",)


def _allow_safe_native() -> None:
    """Exempt known-pure native modules from safepyrun's call monitor.

    The host may set this policy; safepyrun only forbids the sandboxed code
    from changing it mid-run.
    """
    from safepyrun import mon_disable_policy

    have = tuple(mon_disable_policy.get("callee_prefixes", ()))
    missing = tuple(p for p in SAFE_NATIVE_PREFIXES if p not in have)
    if missing:
        mon_disable_policy["callee_prefixes"] = have + missing


def _warm(alt) -> None:
    """Build one throwaway chart outside the sandbox.

    Altair's first validation pass is the slow one, and paying it here keeps the
    first fence on a page from carrying it.
    """
    global _warmed
    if _warmed:
        return
    (
        alt.Chart(alt.Data(values=[{"x": 1, "y": 1}]))
        .transform_fold(["y"], as_=["k", "v"])
        .mark_line(point=True)
        .encode(x=alt.X("x:Q"), y=alt.Y("v:Q", scale=alt.Scale(type="log")), color=alt.Color("k:N"))
        .to_dict()
    )
    _warmed = True


def _audit_hook(event: str, args: tuple) -> None:
    if event in AUDIT_EVENTS and _DENYING.get():
        raise PermissionError(f"{event} is not allowed in an altair fence")


def _install_hook() -> None:
    """Install the audit hook once.

    An audit hook cannot be removed, so it is gated on a context variable that
    is set only inside the fence's own worker thread. Server threads keep their
    own context and are never denied.
    """
    global _hook_installed
    if not _hook_installed:
        sys.addaudithook(_audit_hook)
        _hook_installed = True


def check_body(code: str) -> ast.Module:
    r"""Reject a fence body that reaches outside chart building.

    >>> check_body("alt.Chart()") and True
    True
    >>> check_body("import math\nimport altair as alt\nalt.Chart()") and True
    True
    >>> check_body("import os")
    Traceback (most recent call last):
    ...
    PermissionError: import of 'os' is not allowed in an altair fence
    >>> check_body("from math import log2")
    Traceback (most recent call last):
    ...
    PermissionError: from-import is not allowed in an altair fence
    >>> check_body("open('/etc/passwd')")
    Traceback (most recent call last):
    ...
    PermissionError: 'open' is not allowed in an altair fence
    >>> check_body("().__class__.__bases__")
    Traceback (most recent call last):
    ...
    PermissionError: dunder names are not allowed in an altair fence
    """
    tree = ast.parse(code)
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            raise PermissionError("from-import is not allowed in an altair fence")
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name not in IMPORTABLE:
                    raise PermissionError(
                        f"import of {alias.name!r} is not allowed in an altair fence"
                    )
        if isinstance(node, ast.Name) and node.id in BANNED_NAMES:
            raise PermissionError(f"{node.id!r} is not allowed in an altair fence")
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            raise PermissionError("dunder names are not allowed in an altair fence")
        if isinstance(node, ast.Name) and node.id.startswith("__"):
            raise PermissionError("dunder names are not allowed in an altair fence")
    return tree


def altair_spec(code: str, timeout: float = 5.0) -> dict[str, Any]:
    """Execute an Altair fence body and return its Vega-Lite spec.

    The body's last expression must be the chart. `alt` and `math` are already
    bound, so the body needs no imports. `def`, `class`, lambdas and generator
    expressions are unavailable; list comprehensions and `for` loops are not,
    so a derived curve is still one loop.

    >>> altair_spec("alt.Chart(alt.Data(values=[{'x': 1}])).mark_line()")["mark"]["type"]
    'line'
    >>> altair_spec("2 + 2")
    Traceback (most recent call last):
    ...
    ValueError: fence body must end in an Altair chart, got int
    """
    # Import altair OUTSIDE the sandbox: jsonschema pulls lark, and building
    # lark's parser trips safepyrun's native-call audit.
    import altair as alt
    from safepyrun import RunPython

    check_body(code)
    _allow_safe_native()
    _warm(alt)
    _install_hook()

    def work():
        _DENYING.set(True)
        return asyncio.run(RunPython(g={"alt": alt, "math": math})(code))

    # The fence handler is sync but runs inside the request's event loop, where
    # asyncio.run() raises. A worker thread also gives the deny flag a context
    # of its own.
    with cf.ThreadPoolExecutor(1) as pool:
        chart = pool.submit(work).result(timeout=timeout)
    if not hasattr(chart, "to_dict"):
        raise ValueError(f"fence body must end in an Altair chart, got {type(chart).__name__}")
    return chart.to_dict()
