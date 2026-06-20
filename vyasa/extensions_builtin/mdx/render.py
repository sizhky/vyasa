from __future__ import annotations

import json
import re
from pathlib import Path
from types import SimpleNamespace

import frontmatter
from fasthtml.common import Div, H1, NotStr, to_xml

from ...assets import bundle_asset_nodes, bundle_asset_html
from ...document_pages import PAGE_TITLE_CLS, DocumentPage
from ...extensions_builtin.markdown.renderer import from_md
from ...helpers import _strip_inline_markdown, slug_to_title, text_to_anchor, _unique_anchor
from ...sidebar_helpers import extract_toc


IMPORT_RE = re.compile(r"^\s*import\s+([A-Za-z_$][\w$]*)\s+from\s+['\"](.+?\.jsx?)['\"]\s*;?\s*$")
EXPORT_RE = re.compile(r"^\s*export\s+(const|let|var|function|default)\b")
JSX_START_RE = re.compile(r"^\s*<[A-Z][\w.]*[\s>/]")


def is_mdx_path(path: Path) -> str | None:
    if path.suffix.lower() != ".md":
        return None
    source = path.read_text(encoding="utf-8")
    imports, _, islands = split_mdx(source)
    has_export = any(EXPORT_RE.match(line) for line in source.splitlines())
    return "mdx" if imports or islands or has_export else None


def render_mdx_document(context):
    title, body, toc_source = render_mdx_body(context.document.path, context.path)
    content = Div(context.breadcrumbs, H1(title, cls=f"{PAGE_TITLE_CLS} mb-6"), NotStr(body))
    return DocumentPage(
        title,
        context.path,
        content,
        file_path=str(context.document.path),
        toc_source=toc_source,
        extra_head_nodes=bundle_asset_nodes(("mdx.runtime",)),
    ).render(context.layout, htmx=context.htmx, blog_title=context.blog_title, auth=context.auth)


def render_static_mdx_document(context):
    title, body, toc_source = render_mdx_body(context.doc_file, context.relative_path.with_suffix("").as_posix())
    return SimpleNamespace(
        title=title,
        raw_content=toc_source,
        toc_items=_toc_items(toc_source),
        content_html=bundle_asset_html(("mdx.runtime",)) + body,
    )


def render_mdx_body(path: Path, slug: str):
    source = path.read_text(encoding="utf-8")
    metadata, content = _split_frontmatter(source)
    title = str(metadata.get("title") or _first_heading(content) or slug_to_title(path.stem))
    imports, markdown, islands = split_mdx(content)
    rendered = to_xml(from_md(markdown, current_path=slug))
    payload = {"base": str(Path(slug).parent), "imports": imports, "islands": islands}
    data = json.dumps(payload).replace("</", "<\\/")
    html_body = (
        rendered
        + f'<script type="application/json" class="vyasa-mdx-payload">{data}</script>'
    )
    return title, html_body, markdown


def split_mdx(content: str):
    imports: dict[str, str] = {}
    islands: list[str] = []
    out: list[str] = []
    lines = content.splitlines()
    i = 0
    fence_marker = ""
    while i < len(lines):
        line = lines[i]
        marker = _fence_marker(line)
        if fence_marker:
            out.append(line)
            if marker == fence_marker:
                fence_marker = ""
            i += 1
            continue
        if marker:
            fence_marker = marker
            out.append(line)
            i += 1
            continue
        match = IMPORT_RE.match(line)
        if match:
            imports[match.group(1)] = match.group(2)
            i += 1
            continue
        if EXPORT_RE.match(line) or line.strip().startswith("{/*"):
            i += 1
            continue
        if JSX_START_RE.match(line):
            block, i = _consume_jsx_block(lines, i)
            island_id = len(islands)
            islands.append("\n".join(block))
            out.append(f'<div class="vyasa-mdx-island" data-vyasa-mdx-island="{island_id}"></div>')
            continue
        out.append(line)
        i += 1
    return imports, "\n".join(out).strip(), islands


def _fence_marker(line: str) -> str:
    stripped = line.lstrip()
    if stripped.startswith("```"):
        return "```"
    if stripped.startswith("~~~"):
        return "~~~"
    return ""


def _consume_jsx_block(lines: list[str], start: int):
    block: list[str] = []
    depth = 0
    i = start
    while i < len(lines):
        line = lines[i]
        block.append(line)
        depth += len(re.findall(r"<[A-Z][\w.]*\b(?![^>]*?/>)", line))
        depth -= len(re.findall(r"</[A-Z][\w.]*\s*>", line))
        i += 1
        if depth <= 0:
            break
    return block, i


def _split_frontmatter(source: str):
    post = frontmatter.loads(source)
    return dict(post.metadata), post.content


def _first_heading(content: str) -> str | None:
    for line in content.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return None


def _toc_items(markdown: str):
    headings = extract_toc(markdown, _strip_inline_markdown, text_to_anchor, _unique_anchor)
    return [{"level": level, "text": text, "id": anchor} for level, text, anchor in headings]
