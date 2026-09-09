#!/usr/bin/env python3
"""Rewrite every code reference in a KG pack from a codebase.

Two inputs: the KG pack and the codebase root. One pass removes stale
references, updates moved ones, and adds new ones, so the pack never holds a
reference the code no longer supports.

The join key is the order number at the start of a docstring. A node whose
label starts with the same number owns that symbol.

Node references land in `kg.code.nodes` under the attribute `code`.

An edge names the one line that bridges its two actors, and the code declares
that line with a marker comment:

    return place(game, square)  # kg:m8 1.3.2 -> 1.1.2

The edge id keys the marker, because an actor pair is not unique: two rows can
join the same pair, even on one line. The arrow is for the reader, and the
script checks it against the edge's real endpoints. Edge references land in
`kg.code.<name>.edges` under the attribute `code`, focused on that line alone.
List the generated file first in `@sources`, so an authored key always wins:

    nodes=kg.code.nodes+kg.nodes
    edges=kg.code.move.edges+move.kg.edges

The script also strips `code` from the authored files, because one
fact needs one owner.
"""

from __future__ import annotations

import argparse
import ast
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

MARKER = re.compile(r"kg:([A-Za-z0-9_-]+)(?:\s+([\d.]+)\s*->\s*([\d.]+))?")
NODE_LINE = re.compile(r"^(\s*)([A-Za-z0-9_-]+):\s+(.*)$")
EDGE_HEAD = re.compile(r"^([A-Za-z0-9_-]+):\s+([A-Za-z0-9_-]+)\s+->\s+([A-Za-z0-9_-]+)\s+(\S+)(.*)$")
ORDER = re.compile(r"^(\d+(?:\.\d+)*)\b")
ATTR = re.compile(r"(\w+)=(?:\"([^\"]*)\"|(\S+))")
# A quote closes `focus="`, and a bracket closes `match[` early. Nothing else breaks an anchor.
UNSAFE = ('"', "]")


@dataclass
class Symbol:
    """One class, function, or method that names a leaf in its docstring."""

    number: str
    name: str
    kind: str
    path: str
    node: ast.AST
    lines: dict[int, str]

    def body_lines(self) -> dict[int, str]:
        start = getattr(self.node, "lineno", 1)
        end = getattr(self.node, "end_lineno", start)
        return {n: self.lines[n] for n in range(start, end + 1) if n in self.lines}


@dataclass
class Report:
    """What the run could not decide, and what it changed."""

    ambiguous: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    orphans: list[str] = field(default_factory=list)
    written: list[str] = field(default_factory=list)
    stripped: list[str] = field(default_factory=list)


def read_nodes(pack: Path) -> tuple[dict[str, str], dict[str, str]]:
    """Return order number to node id, and node id to label."""
    by_number: dict[str, str] = {}
    labels: dict[str, str] = {}
    for line in (pack / "kg.nodes").read_text(encoding="utf-8").splitlines():
        match = NODE_LINE.match(line)
        if not match:
            continue
        node_id, label = match.group(2), match.group(3)
        labels[node_id] = label
        number = ORDER.match(label)
        if number:
            by_number[number.group(1)] = node_id
    return by_number, labels


def collect_symbols(code_root: Path) -> list[Symbol]:
    """Return every symbol whose docstring opens with an order number."""
    found: list[Symbol] = []
    for path in sorted(code_root.rglob("*.py")):
        if any(part.startswith((".", "__pycache__")) for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8")
        lines = {n: line for n, line in enumerate(text.splitlines(), start=1)}
        try:
            tree = ast.parse(text)
        except SyntaxError as error:
            print(f"WARN: {path} does not parse: {error}", file=sys.stderr)
            continue
        rel = path.relative_to(code_root).as_posix()
        for node in tree.body:
            found.extend(_symbols_in(node, rel, lines, prefix=""))
    return found


def _symbols_in(node: ast.AST, rel: str, lines: dict[int, str], prefix: str) -> list[Symbol]:
    if not isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
        return []
    name = f"{prefix}{node.name}"
    kind = "class" if isinstance(node, ast.ClassDef) else ("method" if prefix else "function")
    found: list[Symbol] = []
    number = ORDER.match(ast.get_docstring(node) or "")
    if number:
        found.append(Symbol(number.group(1), name, kind, rel, node, lines))
    if isinstance(node, ast.ClassDef):
        for child in node.body:
            found.extend(_symbols_in(child, rel, lines, prefix=f"{name}."))
    return found


def anchor_for(symbol: Symbol, lineno: int) -> str | None:
    """Return a `match[...]` slice of that line, unique inside the symbol."""
    body = symbol.body_lines()
    text = body.get(lineno, "").strip()
    for mark in UNSAFE:
        cut = text.find(mark)
        if cut >= 0:
            text = text[:cut]
    text = text.rstrip()
    if len(text) < 4:
        return None
    if text != text.rstrip(",("):
        text = text + " " if False else text
    hits = [n for n, line in body.items() if text in line]
    if len(hits) != 1:
        # A slice that names two lines cannot be made unique by shortening it.
        wider = text + " "
        hits = [n for n, line in body.items() if wider in line]
        if len(hits) != 1:
            return None
        text = wider
    return f'focus="match[{text}]" context=1'


def collect_markers(code_root: Path) -> tuple[dict[str, tuple[str, int, str, str]], list[str]]:
    """Return each edge marker found in the code, and any duplicate report."""
    markers: dict[str, tuple[str, int, str, str]] = {}
    duplicates: list[str] = []
    for path in sorted(code_root.rglob("*.py")):
        if any(part.startswith((".", "__pycache__")) for part in path.parts):
            continue
        rel = path.relative_to(code_root).as_posix()
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            for edge_id, src, target in MARKER.findall(line):
                if edge_id in markers:
                    duplicates.append(f"{rel}:{lineno}: marker kg:{edge_id} already sits at {markers[edge_id][0]}:{markers[edge_id][1]}")
                    continue
                markers[edge_id] = (rel, lineno, src, target)
    return markers, duplicates


def enclosing_symbol(defs: list[tuple[str, str, str, int, int]], path: str, lineno: int) -> tuple[str, str] | None:
    """Return the innermost class, function, or method holding that line."""
    holding = [d for d in defs if d[0] == path and d[3] <= lineno <= d[4]]
    if not holding:
        return None
    innermost = max(holding, key=lambda d: d[3])
    return innermost[1], innermost[2]


def collect_defs(code_root: Path) -> list[tuple[str, str, str, int, int]]:
    """Return every class, function, and method with its line range."""
    found: list[tuple[str, str, str, int, int]] = []

    def walk(node: ast.AST, rel: str, prefix: str) -> None:
        if not isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            return
        name = f"{prefix}{node.name}"
        kind = "class" if isinstance(node, ast.ClassDef) else ("method" if prefix else "function")
        found.append((rel, name, kind, node.lineno, getattr(node, "end_lineno", node.lineno)))
        if isinstance(node, ast.ClassDef):
            for child in node.body:
                walk(child, rel, f"{name}.")

    for path in sorted(code_root.rglob("*.py")):
        if any(part.startswith((".", "__pycache__")) for part in path.parts):
            continue
        rel = path.relative_to(code_root).as_posix()
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError:
            continue
        for node in tree.body:
            walk(node, rel, "")
    return found


def link(label: str, symbol: Symbol, depth: str, focus: str | None) -> str:
    tail = f" {focus}" if focus else ""
    return f"[{label}]({depth}{symbol.path}){{show=symbol symbol={symbol.name} kind={symbol.kind}{tail}}}"


def build_node_file(
    by_node: dict[str, list[Symbol]], labels: dict[str, str], depth: str
) -> str:
    out: list[str] = []
    for node_id in sorted(by_node, key=lambda i: labels[i]):
        out.append(f"{node_id}: {labels[node_id]}")
        out.append("\tcode=|")
        for symbol in by_node[node_id]:
            out.append(f"\t\t- {link(symbol.name, symbol, depth, None)}")
    return "\n".join(out) + "\n" if out else ""


def strip_attr(path: Path, key: str) -> int:
    """Remove every `key=` block from an authored file. Returns the count."""
    lines = path.read_text(encoding="utf-8").splitlines()
    out: list[str] = []
    dropping_indent: int | None = None
    removed = 0
    for line in lines:
        indent = len(line) - len(line.lstrip("\t"))
        if dropping_indent is not None:
            if line.strip() and indent > dropping_indent:
                continue
            dropping_indent = None
        if re.match(rf"^\t*{key}=", line):
            removed += 1
            dropping_indent = indent if line.rstrip().endswith("=|") else None
            continue
        out.append(line)
    if removed:
        path.write_text("\n".join(out) + "\n", encoding="utf-8")
    return removed


def edge_rows(path: Path) -> list[tuple[str, str, str, str, dict[str, str]]]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        match = EDGE_HEAD.match(line)
        if not match:
            continue
        attrs = {m.group(1): (m.group(2) if m.group(2) is not None else m.group(3)) for m in ATTR.finditer(match.group(5))}
        rows.append((match.group(1), match.group(2), match.group(3), match.group(4), attrs))
    return rows


def build_edge_file(
    path: Path,
    markers: dict[str, tuple[str, int, str, str]],
    defs: list[tuple[str, str, str, int, int]],
    numbers: dict[str, str],
    depth: str,
    report: Report,
) -> str:
    """Return the generated edge file, one reference per marked exchange."""
    out: list[str] = []
    for edge_id, source, target, relation, attrs in edge_rows(path):
        if attrs.get("role", "") not in {"call", "reply", "standing"}:
            continue
        marker = markers.get(edge_id)
        if not marker:
            report.missing.append(f"{path.name} {edge_id}: no `kg:{edge_id}` marker in the code")
            continue
        rel, lineno, arrow_source, arrow_target = marker
        want = (numbers.get(source, ""), numbers.get(target, ""))
        if arrow_source and (arrow_source, arrow_target) != want:
            report.missing.append(
                f"{rel}:{lineno}: marker kg:{edge_id} says {arrow_source} -> {arrow_target},"
                f" but the edge joins {want[0]} -> {want[1]}"
            )
            continue
        holder = enclosing_symbol(defs, rel, lineno)
        if not holder:
            report.missing.append(f"{rel}:{lineno}: marker kg:{edge_id} sits outside any function")
            continue
        name, kind = holder
        label = attrs.get("note", edge_id).strip("→← ")
        focus = f'focus="match[kg:{edge_id}]"'
        out.append(f"{edge_id}: {source} -> {target} {relation}")
        out.append(f"\tcode=[{label}]({depth}{rel}){{show=symbol symbol={name} kind={kind} {focus}}}")
    for edge_id in sorted(set(markers) - {row[0] for row in edge_rows(path)}):
        rel, lineno, _, _ = markers[edge_id]
        if not any(edge_id == row[0] for other in path.parent.glob("*.edges") for row in edge_rows(other)):
            report.orphans.append(f"{rel}:{lineno}: marker kg:{edge_id} names no edge")
    return "\n".join(out) + "\n" if out else ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("pack", type=Path, help="the KG pack directory")
    parser.add_argument("code", type=Path, help="the codebase root")
    parser.add_argument("--check", action="store_true", help="fail when a generated file would change")
    args = parser.parse_args()

    pack, code_root = args.pack.resolve(), args.code.resolve()
    if not (pack / "kg.nodes").is_file():
        print(f"error: {pack} holds no kg.nodes", file=sys.stderr)
        return 2

    depth = "../" * len(pack.relative_to(code_root).parts) if pack.is_relative_to(code_root) else ""
    by_number, labels = read_nodes(pack)
    numbers = {node_id: number for number, node_id in by_number.items()}
    report = Report()
    markers, duplicates = collect_markers(code_root)
    report.missing.extend(duplicates)
    defs = collect_defs(code_root)

    by_node: dict[str, list[Symbol]] = {}
    for symbol in collect_symbols(code_root):
        node_id = by_number.get(symbol.number)
        if not node_id:
            report.orphans.append(f"{symbol.path}:{symbol.name} names {symbol.number}, which no node holds")
            continue
        by_node.setdefault(node_id, []).append(symbol)
    for symbols in by_node.values():
        symbols.sort(key=lambda s: (s.path, s.node.lineno))

    planned: dict[Path, str] = {pack / "kg.code.nodes": build_node_file(by_node, labels, depth)}
    for authored in sorted(pack.glob("*.edges")):
        if ".code." in authored.name:
            continue
        stem = authored.name.replace("kg.edges", "").rstrip(".")
        # Every generated name starts with `kg.`, because the reference checker
        # only scans names that start with `kg.` or hold `.kg.`.
        generated = pack / (f"kg.code.{stem}.edges" if stem else "kg.code.edges")
        planned[generated] = build_edge_file(authored, markers, defs, numbers, depth, report)

    if args.check:
        stale = [p for p, text in planned.items() if (p.read_text() if p.is_file() else "") != text]
        for path in stale:
            print(f"ERROR: {path.name} is out of date")
        _print_report(report)
        return 1 if stale or report.ambiguous or report.missing or report.orphans else 0

    authored = [pack / "kg.nodes"] + [p for p in pack.glob("*.edges") if ".code." not in p.name]
    for path in authored:
        removed = strip_attr(path, "code")
        if removed:
            report.stripped.append(f"{path.name}: removed {removed} code block(s)")

    for path, text in planned.items():
        if text:
            path.write_text(text, encoding="utf-8")
            report.written.append(f"{path.name}: {text.count('show=symbol')} reference(s)")
        elif path.is_file():
            path.unlink()
            report.written.append(f"{path.name}: removed, nothing to generate")

    _print_report(report)
    return 1 if report.missing or report.orphans else 0


def _print_report(report: Report) -> None:
    for line in report.stripped + report.written:
        print(f"ok: {line}")
    for line in report.ambiguous:
        print(f"WARN: {line}; add a comment on the line you mean")
    for line in report.missing + report.orphans:
        print(f"ERROR: {line}")


if __name__ == "__main__":
    raise SystemExit(main())
