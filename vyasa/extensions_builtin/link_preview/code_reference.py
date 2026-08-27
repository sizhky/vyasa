"""Resolve a code reference into render-ready source blocks.

A code reference is a Markdown link plus an attribute list. The attributes
state author intent: which change supplies the evidence, how much source the
reader must see, and which lines need emphasis. This module turns that intent
into concrete line numbers. Callers never calculate line numbers themselves.

Git access is read-only and goes through `GitBackend`; no git subprocess runs.
"""

from __future__ import annotations

import ast
import hashlib
import re
import time
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path
from typing import Mapping

from loguru import logger

CODE_REFERENCE_KEYS = frozenset(
    {
        "change",
        "show",
        "symbol",
        "kind",
        "region",
        "lines",
        "focus",
        "context",
        "view",
        "side",
        "role",
        "follow_renames",
        "pin",
    }
)

SHOW_VALUES = frozenset({"file", "symbol", "region", "lines"})
VIEW_VALUES = frozenset({"source", "diff", "split"})
SIDE_VALUES = frozenset({"after", "before", "both"})
ROLE_VALUES = frozenset({"implementation", "test", "context", "contract"})

# Limits from the specification. They bound preview cost and keep a mistyped
# reference from rendering a whole repository into one popover.
SOURCE_BYTES_LIMIT = 2 * 1024 * 1024
# The source view renders one continuous range, so the reader can scroll the
# real file. The limit only guards a runaway page; it clips and warns.
RENDERED_LINES_LIMIT = 4000
FOCUS_RANGES_LIMIT = 50
CONTEXT_LINES_LIMIT = 20
ATTRIBUTE_PAYLOAD_LIMIT = 4 * 1024

_SYMBOL_LANGUAGES = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "jsx",
    ".ts": "typescript",
    ".tsx": "tsx",
}


class CodeReferenceError(ValueError):
    """An author error with a stable diagnostic code."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Diagnostic:
    code: str
    message: str
    severity: str = "error"


@dataclass(frozen=True, order=True)
class SourceRange:
    """An inclusive, one-based line range. Empty ranges are invalid."""

    start: int
    end: int

    def __post_init__(self):
        if self.start < 1 or self.end < self.start:
            raise CodeReferenceError("range_invalid", f"Invalid range {self.start}:{self.end}")

    @property
    def count(self) -> int:
        return self.end - self.start + 1

    def intersect(self, other: "SourceRange") -> "SourceRange | None":
        start, end = max(self.start, other.start), min(self.end, other.end)
        return SourceRange(start, end) if start <= end else None


@dataclass(frozen=True)
class DiffLine:
    """One rendered unified-diff row with both original line numbers."""

    state: str
    before_line: int
    after_line: int
    text: str


@dataclass(frozen=True)
class CodeReference:
    """Normalized author intent. It holds no calculated line numbers."""

    change: str = ""
    show: str = "file"
    symbol: str = ""
    kind: str = ""
    region: str = ""
    lines: str = ""
    focus: str = "all"
    context: int = 3
    view: str = "source"
    side: str = "after"
    role: str = "implementation"
    follow_renames: bool = True
    pin: str = ""

    @classmethod
    def parse(cls, raw: Mapping[str, object]) -> "CodeReference":
        unknown = set(raw) - CODE_REFERENCE_KEYS
        if unknown:
            raise CodeReferenceError("invalid_attribute", f"Unknown attribute: {sorted(unknown)[0]}")

        values = {key: str(value).strip() for key, value in raw.items()}
        show = values.get("show", "file")
        focus = values.get("focus", "all")
        view = values.get("view", "source")
        side = values.get("side", "after")
        role = values.get("role", "implementation")
        for name, value, allowed in (
            ("show", show, SHOW_VALUES),
            ("view", view, VIEW_VALUES),
            ("side", side, SIDE_VALUES),
            ("role", role, ROLE_VALUES),
        ):
            if value not in allowed:
                raise CodeReferenceError("invalid_attribute", f"Invalid {name} value: {value}")

        paired = {"symbol": "symbol", "region": "region", "lines": "lines"}.get(show)
        if paired and not values.get(paired):
            raise CodeReferenceError("missing_attribute", f"show={show} requires {paired}")
        if focus == "changed" and not values.get("change"):
            raise CodeReferenceError("missing_attribute", "focus=changed requires change")
        if side == "both" and view not in {"diff", "split"}:
            raise CodeReferenceError("missing_attribute", "side=both requires view=diff or view=split")
        if view == "split" and side != "both":
            raise CodeReferenceError("missing_attribute", "view=split requires side=both")

        try:
            context = int(values.get("context", "3"))
        except ValueError as exc:
            raise CodeReferenceError("invalid_attribute", "context must be an integer") from exc
        if not 0 <= context <= CONTEXT_LINES_LIMIT:
            raise CodeReferenceError(
                "invalid_attribute", f"context must be between 0 and {CONTEXT_LINES_LIMIT}"
            )
        follow = values.get("follow_renames", "true").lower()
        if follow not in {"true", "false"}:
            raise CodeReferenceError("invalid_attribute", "follow_renames must be true or false")

        reference = cls(
            change=values.get("change", ""),
            show=show,
            symbol=values.get("symbol", ""),
            kind=values.get("kind", ""),
            region=values.get("region", ""),
            lines=values.get("lines", ""),
            focus=focus,
            context=context,
            view=view,
            side=side,
            role=role,
            follow_renames=follow == "true",
            pin=values.get("pin", ""),
        )
        # Validate the shapes that only the resolver would otherwise reach.
        if reference.show == "lines":
            parse_line_range(reference.lines)
        focus_ranges(reference.focus)
        return reference

    def label(self) -> str:
        """Short human label for the preview header."""
        if self.show == "symbol":
            return f"{self.symbol}{f' ({self.kind})' if self.kind else ''}"
        if self.show == "region":
            return f"region {self.region}"
        if self.show == "lines":
            return f"lines {self.lines.replace('-', ':')}"
        return "full file"


@dataclass(frozen=True)
class ResolvedCodeReference:
    """Render-ready result. Every range is inclusive and one-based."""

    file_path: Path
    reference: CodeReference
    language: str
    source: str
    source_lines: tuple[str, ...]
    selected: SourceRange
    focused: tuple[SourceRange, ...]
    blocks: tuple[SourceRange, ...]
    rendered: SourceRange | None = None
    base_ref: str = ""
    head_ref: str = ""
    path_before: str = ""
    path_after: str = ""
    before_source: str = ""
    after_source: str = ""
    changed: tuple[SourceRange, ...] = ()
    diff_lines: tuple[DiffLine, ...] = ()
    diagnostics: tuple[Diagnostic, ...] = ()

    @property
    def shown(self) -> SourceRange:
        """The continuous range the source view renders."""
        return self.rendered or self.selected

    @property
    def changed_count(self) -> int:
        return sum(item.count for item in self.changed)

    @property
    def renamed(self) -> bool:
        return bool(self.path_before and self.path_after and self.path_before != self.path_after)

    @property
    def omitted_gaps(self) -> tuple[SourceRange, ...]:
        """Line ranges hidden between rendered blocks."""
        gaps = []
        for previous, current in zip(self.blocks, self.blocks[1:]):
            if current.start > previous.end + 1:
                gaps.append(SourceRange(previous.end + 1, current.start - 1))
        return tuple(gaps)

    def line_state(self, number: int) -> str:
        """`added`, `deleted`, or `context` for one shown line."""
        if not self.reference.change:
            return "context"
        if not any(item.start <= number <= item.end for item in self.changed):
            return "context"
        return "deleted" if self.reference.side == "before" else "added"


# --- range parsing ------------------------------------------------------


def parse_line_range(value: str) -> SourceRange:
    """Parse `start:end` or `start-end`.

    >>> parse_line_range("12:18")
    SourceRange(start=12, end=18)
    """
    match = re.fullmatch(r"(\d+)\s*[:\-]\s*(\d+)", str(value).strip())
    if not match:
        raise CodeReferenceError("range_invalid", f"Invalid line range: {value}")
    return SourceRange(int(match.group(1)), int(match.group(2)))


def focus_ranges(value: str) -> tuple[SourceRange, ...]:
    """Parse `ln[3,10:14]` into ranges. Other focus forms return ().

    >>> focus_ranges("ln[3,10:14]")
    (SourceRange(start=3, end=3), SourceRange(start=10, end=14))
    """
    match = re.fullmatch(r"ln\[([^\]]+)\]", str(value).strip())
    if not match:
        return ()
    ranges = []
    for part in match.group(1).split(","):
        item = part.strip()
        ranges.append(SourceRange(int(item), int(item)) if item.isdigit() else parse_line_range(item))
    _guard_focus_count(ranges)
    return tuple(ranges)


def _guard_focus_count(ranges) -> None:
    if len(ranges) > FOCUS_RANGES_LIMIT:
        raise CodeReferenceError(
            "limit_exceeded", f"More than {FOCUS_RANGES_LIMIT} focus ranges"
        )


def merge_ranges(ranges) -> tuple[SourceRange, ...]:
    """Merge overlapping or adjacent ranges, keeping order.

    >>> merge_ranges([SourceRange(4, 6), SourceRange(1, 2), SourceRange(3, 3)])
    (SourceRange(start=1, end=6),)
    """
    merged: list[SourceRange] = []
    for current in sorted(ranges):
        if merged and current.start <= merged[-1].end + 1:
            merged[-1] = SourceRange(merged[-1].start, max(merged[-1].end, current.end))
        else:
            merged.append(current)
    return tuple(merged)


# --- symbol ranges ------------------------------------------------------


@dataclass(frozen=True)
class _SymbolMatch:
    qualified: str
    name: str
    kind: str
    span: SourceRange


def _assigned_names(node) -> list[str]:
    """Names bound by an assignment, for `kind=Variable` lookup."""
    targets = node.targets if isinstance(node, ast.Assign) else [node.target]
    return [item.id for item in targets if isinstance(item, ast.Name)]


def _python_symbol_matches(source: str) -> list[_SymbolMatch]:
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        raise CodeReferenceError("language_unsupported", f"Python source does not parse: {exc}") from exc
    found: list[_SymbolMatch] = []

    def visit(node, prefix: str, inside_class: bool) -> None:
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                qualified = f"{prefix}.{child.name}" if prefix else child.name
                kind = "Class" if isinstance(child, ast.ClassDef) else ("Method" if inside_class else "Function")
                start = min([child.lineno] + [item.lineno for item in child.decorator_list])
                found.append(
                    _SymbolMatch(qualified, child.name, kind, SourceRange(start, child.end_lineno))
                )
                visit(child, qualified, isinstance(child, ast.ClassDef))
                continue
            if isinstance(child, (ast.Assign, ast.AnnAssign)):
                # Settings, constants, and flags are evidence too.
                for name in _assigned_names(child):
                    qualified = f"{prefix}.{name}" if prefix else name
                    found.append(
                        _SymbolMatch(
                            qualified, name, "Variable", SourceRange(child.lineno, child.end_lineno)
                        )
                    )
                continue
            visit(child, prefix, inside_class)

    visit(tree, "", False)
    return found


_TREE_DECLARATIONS = {
    "function_declaration": "Function",
    "generator_function_declaration": "Function",
    "class_declaration": "Class",
    "method_definition": "Method",
    "abstract_class_declaration": "Class",
    "interface_declaration": "Class",
    "type_alias_declaration": "Class",
}
_TREE_NAME_TYPES = {"identifier", "property_identifier", "type_identifier"}


def _tree_nodes(node):
    yield node
    for child in node.children:
        yield from _tree_nodes(child)


def _tree_node_name(node) -> str:
    for child in node.children:
        if child.type in _TREE_NAME_TYPES:
            return child.text.decode("utf-8", errors="replace")
    return ""


def _tree_symbol_matches(source: str, language: str) -> list[_SymbolMatch]:
    try:
        from tree_sitter_language_pack import get_parser
    except ImportError as exc:
        # The grammar package is optional. Name the fix instead of guessing a
        # range: a wrong range is worse than a clear diagnostic.
        raise CodeReferenceError(
            "language_unsupported",
            f"{language} symbol ranges need the tree-sitter grammars. "
            "Install tree-sitter-language-pack in the environment that runs vyasa, "
            "or use show=region or show=lines.",
        ) from exc
    try:
        root = get_parser(language).parse(source.encode("utf-8")).root_node
    except Exception as exc:  # missing grammar or parser failure
        raise CodeReferenceError(
            "language_unsupported", f"No symbol-range adapter for {language}: {exc}"
        ) from exc

    found: list[_SymbolMatch] = []

    def qualify(node, name: str) -> str:
        parts = [name]
        parent = node.parent
        while parent is not None:
            if parent.type in _TREE_DECLARATIONS:
                outer = _tree_node_name(parent)
                if outer:
                    parts.append(outer)
            parent = parent.parent
        return ".".join(reversed(parts))

    for node in _tree_nodes(root):
        span = SourceRange(node.start_point[0] + 1, node.end_point[0] + 1)
        if node.type in _TREE_DECLARATIONS:
            name = _tree_node_name(node)
            if name:
                found.append(_SymbolMatch(qualify(node, name), name, _TREE_DECLARATIONS[node.type], span))
            continue
        # A binding is evidence too: `const Name = () => {}`, a hook-wrapped
        # callback such as `const reportHidden = useCallback(...)`, and a
        # plain constant.
        if node.type != "variable_declarator":
            continue
        name = _tree_node_name(node)
        value = node.child_by_field_name("value")
        if not name or value is None:
            continue
        outer = node.parent
        if outer is not None and outer.type in {"lexical_declaration", "variable_declaration"}:
            if outer.parent is not None and outer.parent.type == "export_statement":
                outer = outer.parent
            span = SourceRange(outer.start_point[0] + 1, outer.end_point[0] + 1)
        found.append(_SymbolMatch(qualify(node, name), name, _binding_kind(value), span))
    return found


_FUNCTION_VALUES = {"arrow_function", "function_expression", "function"}


def _binding_kind(value) -> str:
    """Classify what a binding holds, so `kind` can narrow a lookup."""
    if value.type == "class":
        return "Class"
    if value.type in _FUNCTION_VALUES:
        return "Function"
    if value.type == "call_expression" and any(
        node.type in _FUNCTION_VALUES for node in _tree_nodes(value)
    ):
        # `useCallback(fn, deps)`, `memo(fn)`, `forwardRef(fn)`.
        return "Function"
    return "Variable"


def symbol_range(source: str, path: Path, symbol: str, kind: str = "") -> SourceRange:
    """Resolve the full range of one symbol. Never guesses.

    Raises `language_unsupported`, `symbol_not_found`, or `symbol_ambiguous`.
    """
    language = _SYMBOL_LANGUAGES.get(Path(path).suffix.lower())
    if not language:
        raise CodeReferenceError(
            "language_unsupported",
            f"No symbol-range adapter for {Path(path).suffix or path}; use show=region or show=lines",
        )
    matches = (
        _python_symbol_matches(source)
        if language == "python"
        else _tree_symbol_matches(source, language)
    )
    wanted = str(symbol).strip()
    selected = [item for item in matches if item.qualified == wanted]
    if not selected:
        selected = [item for item in matches if item.name == wanted]
    if kind:
        selected = [item for item in selected if item.kind.lower() == kind.strip().lower()]
    spans = sorted({item.span for item in selected})
    if not spans:
        raise CodeReferenceError("symbol_not_found", f"Symbol not found: {symbol}")
    if len(spans) > 1:
        raise CodeReferenceError(
            "symbol_ambiguous", f"Symbol {symbol} matches {len(spans)} ranges; add kind or a qualified name"
        )
    return spans[0]


# --- regions ------------------------------------------------------------

_REGION_START = r"^[^\S\n]*(?:#|//|<!--|/\*|--)[^\S\n]*region:[^\S\n]*{name}[^\S\n]*(?:-->|\*/)?[^\S\n]*$"
_REGION_END = re.compile(
    r"^[^\S\n]*(?:#|//|<!--|/\*|--)[^\S\n]*endregion\b.*$", re.MULTILINE
)


def region_range(source: str, name: str) -> SourceRange:
    """Resolve a `region: name` ... `endregion` body range."""
    pattern = re.compile(_REGION_START.format(name=re.escape(str(name).strip())), re.MULTILINE)
    starts = list(pattern.finditer(source))
    if len(starts) > 1:
        raise CodeReferenceError("region_duplicate", f"Region {name} occurs {len(starts)} times")
    if not starts:
        raise CodeReferenceError("region_not_found", f"Region not found: {name}")
    end = _REGION_END.search(source, starts[0].end())
    if not end:
        raise CodeReferenceError("region_not_found", f"Region {name} has no endregion")
    start_line = source.count("\n", 0, starts[0].start()) + 1
    end_line = source.count("\n", 0, end.start()) + 1
    if end_line <= start_line + 1:
        raise CodeReferenceError("region_not_found", f"Region {name} is empty")
    return SourceRange(start_line + 1, end_line - 1)


def _named_focus_ranges(source: str, path: Path, focus: str, kind: str) -> tuple[SourceRange, ...]:
    text = str(focus).strip()
    ranges: list[SourceRange] = []
    for match in re.finditer(r"(symbol|region)\[([^\]]+)\]", text):
        for name in match.group(2).split(","):
            item = name.strip()
            if not item:
                continue
            ranges.append(
                symbol_range(source, path, item, kind)
                if match.group(1) == "symbol"
                else region_range(source, item)
            )
    if not ranges:
        raise CodeReferenceError("invalid_attribute", f"Invalid focus value: {focus}")
    _guard_focus_count(ranges)
    return merge_ranges(ranges)


def range_pin(lines, selected: SourceRange) -> str:
    """Content hash of a displayed range. Trailing spaces are ignored."""
    text = "\n".join(line.rstrip() for line in lines[selected.start - 1 : selected.end]) + "\n"
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# --- change mapping -----------------------------------------------------


def _opcodes(before: list[str], after: list[str]):
    return SequenceMatcher(None, before, after, autojunk=False).get_opcodes()


def changed_ranges(before: list[str], after: list[str], side: str) -> tuple[SourceRange, ...]:
    """Changed line ranges on one side.

    >>> changed_ranges(["a", "b"], ["a", "c"], "after")
    (SourceRange(start=2, end=2),)
    """
    ranges = []
    for tag, i1, i2, j1, j2 in _opcodes(before, after):
        if tag == "equal":
            continue
        start, end = (i1 + 1, i2) if side == "before" else (j1 + 1, j2)
        if start <= end:
            ranges.append(SourceRange(start, end))
    return merge_ranges(ranges)


def diff_lines(before: list[str], after: list[str]) -> tuple[DiffLine, ...]:
    """Unified diff rows that keep both original line numbers."""
    rows: list[DiffLine] = []
    for tag, i1, i2, j1, j2 in _opcodes(before, after):
        if tag in {"replace", "delete"}:
            for offset, text in enumerate(before[i1:i2]):
                rows.append(DiffLine("deleted", i1 + offset + 1, 0, text))
        if tag in {"replace", "insert"}:
            for offset, text in enumerate(after[j1:j2]):
                rows.append(DiffLine("added", 0, j1 + offset + 1, text))
        if tag == "equal":
            for offset, text in enumerate(after[j1:j2]):
                rows.append(DiffLine("context", i1 + offset + 1, j1 + offset + 1, text))
    return tuple(rows)


# --- git sources --------------------------------------------------------


@dataclass
class _Sources:
    before: str = ""
    after: str = ""
    base_ref: str = ""
    head_ref: str = ""
    path_before: str = ""
    path_after: str = ""
    diagnostics: list[Diagnostic] = field(default_factory=list)


def _decode(raw: bytes | None) -> str:
    if raw is None:
        return ""
    if len(raw) > SOURCE_BYTES_LIMIT:
        raise CodeReferenceError("limit_exceeded", "Source is larger than 2 MiB")
    if b"\x00" in raw[:8192]:
        raise CodeReferenceError("binary_unsupported", "File is not renderable text")
    return raw.decode("utf-8", errors="replace")


def _read_worktree(file_path: Path) -> str:
    if not file_path.exists():
        raise CodeReferenceError("path_not_found", f"File does not exist: {file_path}")
    return _decode(file_path.read_bytes())


def _resolve_change(backend, change: str) -> tuple[str, str]:
    """Resolve `change` to (base sha, head sha)."""
    if ".." in change:
        base_name, head_name = change.split("..", 1)
        base, head = backend.resolve_ref(base_name.strip()), backend.resolve_ref(head_name.strip())
        if not base or not head:
            raise CodeReferenceError("ref_not_found", f"Cannot resolve {change}")
        return base, head
    head = backend.resolve_ref(change)
    if not head:
        raise CodeReferenceError("ref_not_found", f"Cannot resolve {change}")
    parents = backend.commit_parents(head)
    if len(parents) > 1:
        raise CodeReferenceError(
            "merge_base_required", f"{change} is a merge commit; use base..head"
        )
    return (parents[0] if parents else ""), head


def _git_sources(file_path: Path, reference: CodeReference, *, allow_worktree: bool) -> _Sources:
    from ...content_backend import discover_git_backend

    found = discover_git_backend(file_path)
    if found is None:
        raise CodeReferenceError("ref_not_found", f"No git repository owns {file_path}")
    backend, root = found
    try:
        rel = file_path.resolve().relative_to(root).as_posix()
    except ValueError as exc:
        raise CodeReferenceError("path_outside_root", str(file_path)) from exc

    if reference.change == "worktree":
        if not allow_worktree:
            raise CodeReferenceError(
                "worktree_disallowed", "change=worktree is local-only evidence"
            )
        base = backend.resolve_ref("HEAD") or ""
        return _Sources(
            before=_decode(backend.read_bytes(rel, "HEAD")) if base else "",
            after=_read_worktree(file_path),
            base_ref=base,
            head_ref="worktree",
            path_before=rel,
            path_after=rel,
        )

    base, head = _resolve_change(backend, reference.change)
    path_before = rel
    diagnostics: list[Diagnostic] = []
    if reference.follow_renames and base:
        sources = backend.rename_sources(rel, base, head)
        if len(sources) > 1:
            raise CodeReferenceError(
                "rename_ambiguous", f"{rel} has {len(sources)} rename sources"
            )
        if sources:
            path_before = sources[0]
    before = _decode(backend.read_bytes(path_before, base)) if base else ""
    after = _decode(backend.read_bytes(rel, head))
    if not after and backend.stat_kind(rel, head) is None:
        if reference.side == "after":
            raise CodeReferenceError("path_not_found", f"{rel} does not exist at {head[:8]}")
        path_after = ""
    else:
        path_after = rel
    if base and not before and backend.stat_kind(path_before, base) is None:
        if reference.side == "before":
            raise CodeReferenceError("path_not_found", f"{path_before} does not exist at {base[:8]}")
        path_before = ""
    return _Sources(before, after, base, head, path_before, path_after, diagnostics)


# --- resolution ---------------------------------------------------------


def _selected_range(reference: CodeReference, source: str, file_path: Path, whole: SourceRange) -> SourceRange:
    if reference.show == "symbol":
        return symbol_range(source, file_path, reference.symbol, reference.kind)
    if reference.show == "region":
        return region_range(source, reference.region)
    if reference.show == "lines":
        return parse_line_range(reference.lines)
    return whole


def _worktree_stamp(file_path: Path) -> str:
    """File revision data, so a live edit cannot serve a stale preview."""
    try:
        stat = file_path.stat()
    except OSError:
        return "missing"
    return f"{stat.st_mtime_ns}:{stat.st_size}"


def _is_immutable_change(change: str) -> bool:
    """A full or abbreviated sha names one commit forever; a branch does not."""
    return bool(change) and change != "worktree" and bool(
        re.fullmatch(r"[0-9a-fA-F]{7,40}(\.\.[0-9a-fA-F]{7,40})?", change)
    )


@lru_cache(maxsize=256)
def _resolve_cached(file_path: Path, reference: CodeReference, allow_worktree: bool, _stamp: str):
    return _resolve(file_path, reference, allow_worktree=allow_worktree)


def resolve_code_reference(
    file_path: Path,
    reference: CodeReference,
    *,
    allow_worktree: bool = True,
) -> ResolvedCodeReference:
    """Resolve author intent into concrete source ranges.

    Committed references are immutable, so their results cache by path,
    change, and normalized attributes. Working-tree and no-change
    references add file revision data to the key.
    """
    file_path = Path(file_path)
    started = time.perf_counter()
    stamp = "" if _is_immutable_change(reference.change) else _worktree_stamp(file_path)
    resolved = _resolve_cached(file_path, reference, allow_worktree, stamp)
    logger.debug(
        "code reference resolved path={} change={} show={} focus={} lines={} blocks={} ms={:.1f}",
        file_path.name,
        reference.change or "-",
        reference.show,
        reference.focus,
        sum(item.count for item in resolved.blocks),
        len(resolved.blocks),
        (time.perf_counter() - started) * 1000,
    )
    return resolved


def _resolve(
    file_path: Path,
    reference: CodeReference,
    *,
    allow_worktree: bool = True,
) -> ResolvedCodeReference:
    """Resolution order follows the specification: read the sides, resolve
    the shown range, resolve focus, intersect, add context, then merge."""
    diagnostics: list[Diagnostic] = []
    if reference.change:
        sources = _git_sources(file_path, reference, allow_worktree=allow_worktree)
        diagnostics.extend(sources.diagnostics)
    else:
        sources = _Sources(after=_read_worktree(file_path), path_after=file_path.name)

    source = sources.before if reference.side == "before" else sources.after
    if not source and reference.change:
        raise CodeReferenceError(
            "path_not_found", f"No {reference.side}-side content for {file_path.name}"
        )
    lines = source.splitlines()
    whole = SourceRange(1, max(len(lines), 1))
    selected = _selected_range(reference, source, file_path, whole)
    if selected.end > len(lines):
        raise CodeReferenceError(
            "range_invalid", f"Range {selected.start}:{selected.end} is outside the file"
        )
    if reference.pin and not range_pin(tuple(lines), selected).startswith(reference.pin.lower()):
        raise CodeReferenceError("pin_mismatch", f"Content changed under pin {reference.pin}")

    before_lines, after_lines = sources.before.splitlines(), sources.after.splitlines()
    changed = (
        changed_ranges(before_lines, after_lines, reference.side) if reference.change else ()
    )
    if reference.focus == "changed":
        focused = changed
    elif reference.focus == "all":
        focused = (selected,)
    else:
        focused = focus_ranges(reference.focus) or _named_focus_ranges(
            source, file_path, reference.focus, reference.kind
        )
    _guard_focus_count(focused)
    focused = tuple(
        item for item in (value.intersect(selected) for value in focused) if item is not None
    )
    if reference.focus == "changed" and not focused:
        diagnostics.append(
            Diagnostic("no_changed_lines", "This change does not touch the shown source", "warning")
        )
    blocks = (
        merge_ranges(
            [
                SourceRange(
                    max(selected.start, item.start - reference.context),
                    min(selected.end, item.end + reference.context),
                )
                for item in focused
            ]
        )
        if focused
        else (selected,)
    )
    rendered = _rendered_range(selected, focused)
    if rendered.count < selected.count:
        diagnostics.append(
            Diagnostic(
                "limit_exceeded",
                f"Showing lines {rendered.start}-{rendered.end} of {selected.count}; "
                "open the full file for the rest",
                "warning",
            )
        )

    return ResolvedCodeReference(
        file_path=file_path,
        reference=reference,
        language=_language_for(file_path),
        source=source,
        source_lines=tuple(lines),
        selected=selected,
        focused=focused,
        blocks=blocks,
        rendered=rendered,
        base_ref=sources.base_ref,
        head_ref=sources.head_ref,
        path_before=sources.path_before,
        path_after=sources.path_after,
        before_source=sources.before,
        after_source=sources.after,
        changed=tuple(item for item in (value.intersect(selected) for value in changed) if item),
        diff_lines=diff_lines(before_lines, after_lines) if reference.view in {"diff", "split"} else (),
        diagnostics=tuple(diagnostics),
    )


def _rendered_range(selected: SourceRange, focused: tuple[SourceRange, ...]) -> SourceRange:
    """The continuous range to render, clipped around focus when it is huge.

    The reader scrolls one real file, so folding buys nothing on screen. The
    limit exists only so a mistyped reference cannot render a whole monorepo.

    >>> _rendered_range(SourceRange(1, 10), (SourceRange(4, 5),))
    SourceRange(start=1, end=10)
    """
    if selected.count <= RENDERED_LINES_LIMIT:
        return selected
    if not focused:
        return SourceRange(selected.start, selected.start + RENDERED_LINES_LIMIT - 1)
    span = SourceRange(focused[0].start, focused[-1].end)
    if span.count >= RENDERED_LINES_LIMIT:
        return SourceRange(span.start, span.start + RENDERED_LINES_LIMIT - 1)
    margin = (RENDERED_LINES_LIMIT - span.count) // 2
    start = max(selected.start, span.start - margin)
    end = min(selected.end, start + RENDERED_LINES_LIMIT - 1)
    return SourceRange(max(selected.start, end - RENDERED_LINES_LIMIT + 1), end)


def _language_for(path: Path) -> str:
    from ..markdown.renderer import infer_code_language

    return infer_code_language(path.name)
