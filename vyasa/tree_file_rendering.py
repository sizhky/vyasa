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

    for raw_line in (text or "").expandtabs(4).splitlines():
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

        indent = _indent_width(raw_line)
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
        node = TreeNode(label=label, meta=meta, section=section)
        stack[-1][1].append(node)
        stack.append((indent, node.children))

    return TreeDocument(title=title, metadata=metadata, roots=roots)


def resolve_tree_title(file_path: str | Path, abbreviations=None) -> tuple[str, str, TreeDocument]:
    file_path = Path(file_path)
    raw_content = file_path.read_text(encoding="utf-8", errors="replace")
    fallback = slug_to_title(file_path.stem, abbreviations=abbreviations)
    document = parse_tree_document(raw_content, fallback_title=fallback)
    return document.title or fallback, raw_content, document


def _node_html(node: TreeNode) -> str:
    label = html.escape(node.label)
    meta = "".join(f'<span class="vyasa-tree-chip">{html.escape(value)}</span>' for value in node.meta)
    row_cls = "vyasa-tree-row vyasa-tree-section-row" if node.section else "vyasa-tree-row"
    row = (
        f'<div class="{row_cls}">'
        f'<span class="vyasa-tree-label">{label}</span>'
        f'<span class="vyasa-tree-meta">{meta}</span>'
        "</div>"
    )
    if not node.children:
        return f'<li class="vyasa-tree-item">{row}</li>'
    children = "".join(_node_html(child) for child in node.children)
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
    content = "".join(_node_html(node) for node in document.roots)
    if not content:
        content = '<li class="vyasa-tree-empty">No tree entries.</li>'
    return Div(NotStr(f'<ul class="vyasa-tree-root">{content}</ul>'), cls="vyasa-tree-doc w-full")
