from __future__ import annotations

import html
import re
from dataclasses import dataclass, field
from pathlib import Path

from fasthtml.common import Div, NotStr

from .helpers import slug_to_title


_KEY_VALUE_COMMENT_RE = re.compile(r"^#\s*([A-Za-z][\w -]*):\s*(.+?)\s*$")
_SIZE_TOKEN_RE = re.compile(r"^(?:XS|S|M|L|XL|XXL)$")
_META_TOKEN_RE = re.compile(r"^[A-Z][A-Z0-9_/-]{0,7}$")
_PRIORITY_TOKEN_RE = re.compile(r"^P\d+$")


@dataclass
class TreeNode:
    label: str
    meta: list[str] = field(default_factory=list)
    children: list["TreeNode"] = field(default_factory=list)
    section: bool = False


@dataclass
class TreeDocument:
    title: str | None
    metadata: dict[str, str]
    roots: list[TreeNode]


def _indent_width(line: str) -> int:
    return len(line) - len(line.lstrip(" \t"))


def _split_label_meta(text: str) -> tuple[str, list[str]]:
    tab_parts = [part.strip() for part in text.split("\t")]
    tab_parts = [part for part in tab_parts if part]
    if len(tab_parts) > 1:
        return tab_parts[0], tab_parts[1:]

    tokens = text.split()
    if len(tokens) < 5:
        return text.strip(), []
    if (
        _SIZE_TOKEN_RE.match(tokens[-4])
        and _META_TOKEN_RE.match(tokens[-3])
        and _META_TOKEN_RE.match(tokens[-2])
        and _PRIORITY_TOKEN_RE.match(tokens[-1])
    ):
        return " ".join(tokens[:-4]).strip(), tokens[-4:]
    return text.strip(), []


def parse_tree_document(text: str, *, fallback_title: str | None = None) -> TreeDocument:
    metadata: dict[str, str] = {}
    title = fallback_title
    roots: list[TreeNode] = []
    stack: list[tuple[int, list[TreeNode]]] = [(-1, roots)]

    for raw_line in (text or "").splitlines():
        stripped = raw_line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            match = _KEY_VALUE_COMMENT_RE.match(stripped)
            if match:
                key = match.group(1).strip().lower().replace(" ", "_")
                metadata[key] = match.group(2).strip()
                if key == "title":
                    title = metadata[key]
            elif title is None:
                title = stripped.lstrip("#").strip() or None
            continue

        indent = _indent_width(raw_line.expandtabs(4))
        body = stripped
        section = body.startswith("[") and body.endswith("]") and len(body) > 2
        if section:
            label, meta = body[1:-1].strip(), []
        else:
            label, meta = _split_label_meta(body)
        if not label:
            continue

        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()
        node = TreeNode(label=label, meta=meta, section=section or indent == 0)
        stack[-1][1].append(node)
        stack.append((indent, node.children))

    return TreeDocument(title=title, metadata=metadata, roots=roots)


def resolve_tree_title(file_path: str | Path, abbreviations=None) -> tuple[str, str, TreeDocument]:
    file_path = Path(file_path)
    raw_content = file_path.read_text(encoding="utf-8", errors="replace")
    fallback = slug_to_title(file_path.stem, abbreviations=abbreviations)
    document = parse_tree_document(raw_content, fallback_title=fallback)
    return document.title or fallback, raw_content, document


def _split_pipe_list(value: str | None) -> list[str]:
    return [part.strip() for part in (value or "").split("|") if part.strip()]


def _flatten_leaf_rows(nodes: list[TreeNode], path: list[str] | None = None) -> list[tuple[list[str], list[str]]]:
    path = path or []
    rows: list[tuple[list[str], list[str]]] = []
    for node in nodes:
        next_path = [*path, node.label]
        if node.children:
            rows.extend(_flatten_leaf_rows(node.children, next_path))
        else:
            rows.append((next_path, node.meta))
    return rows


def _tree_table_html(document: TreeDocument) -> str | None:
    data_columns = _split_pipe_list(document.metadata.get("columns"))
    if not data_columns:
        return None
    leaf_rows = _flatten_leaf_rows(document.roots)
    if not leaf_rows:
        return None

    hierarchy_columns = _split_pipe_list(document.metadata.get("hierarchy"))
    hierarchy_depth = max(len(path) for path, _ in leaf_rows)
    if len(hierarchy_columns) < hierarchy_depth:
        hierarchy_columns.extend(f"Level {idx}" for idx in range(len(hierarchy_columns) + 1, hierarchy_depth + 1))
    hierarchy_columns = hierarchy_columns[:hierarchy_depth]

    paths = [(path + [""] * hierarchy_depth)[:hierarchy_depth] for path, _ in leaf_rows]
    metas = [(meta + [""] * len(data_columns))[:len(data_columns)] for _, meta in leaf_rows]

    def rowspan_at(row_idx: int, col_idx: int) -> int:
        prefix = paths[row_idx][: col_idx + 1]
        span = 1
        for next_idx in range(row_idx + 1, len(paths)):
            if paths[next_idx][: col_idx + 1] != prefix:
                break
            span += 1
        return span

    def should_emit_hierarchy_cell(row_idx: int, col_idx: int) -> bool:
        return row_idx == 0 or paths[row_idx][: col_idx + 1] != paths[row_idx - 1][: col_idx + 1]

    header = "".join(f"<th>{html.escape(name)}</th>" for name in [*hierarchy_columns, *data_columns])
    body_rows = []
    for row_idx, (path, meta) in enumerate(zip(paths, metas)):
        cells = []
        for col_idx, value in enumerate(path):
            if should_emit_hierarchy_cell(row_idx, col_idx):
                span = rowspan_at(row_idx, col_idx)
                rowspan = f' rowspan="{span}"' if span > 1 else ""
                cells.append(f'<td{rowspan} class="vyasa-tree-table-h{col_idx + 1}">{html.escape(value)}</td>')
        cells.extend(f'<td class="vyasa-tree-table-meta">{html.escape(value)}</td>' for value in meta)
        body_rows.append(f"<tr>{''.join(cells)}</tr>")
    return (
        '<div class="vyasa-tree-table-wrap">'
        '<table class="vyasa-tree-table">'
        f"<thead><tr>{header}</tr></thead>"
        f"<tbody>{''.join(body_rows)}</tbody>"
        "</table>"
        "</div>"
    )


def _node_html(node: TreeNode, level: int = 0) -> str:
    label = html.escape(node.label)
    meta = "".join(f'<span class="vyasa-tree-chip">{html.escape(value)}</span>' for value in node.meta)
    row_cls = "vyasa-tree-row vyasa-tree-section-row" if node.section else "vyasa-tree-row"
    row = (
        f'<div class="{row_cls}" style="--vyasa-tree-level:{level}">'
        f'<span class="vyasa-tree-label">{label}</span>'
        f'<span class="vyasa-tree-meta">{meta}</span>'
        "</div>"
    )
    if not node.children:
        return f'<li class="vyasa-tree-item">{row}</li>'
    children = "".join(_node_html(child, level + 1) for child in node.children)
    return (
        '<li class="vyasa-tree-item vyasa-tree-branch">'
        f"<details open>"
        f'<summary class="vyasa-tree-summary">{row}</summary>'
        f'<ul class="vyasa-tree-children">{children}</ul>'
        "</details>"
        "</li>"
    )


def render_tree_document(document: TreeDocument | str):
    if isinstance(document, str):
        document = parse_tree_document(document)
    table_html = _tree_table_html(document)
    if table_html:
        return Div(NotStr(table_html), cls="vyasa-tree-doc vyasa-tree-table-doc w-full")
    content = "".join(_node_html(node) for node in document.roots)
    if not content:
        content = '<li class="vyasa-tree-empty">No tree entries.</li>'
    return Div(NotStr(f'<ul class="vyasa-tree-root">{content}</ul>'), cls="vyasa-tree-doc w-full")
