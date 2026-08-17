from __future__ import annotations

import html
import re
from urllib.parse import parse_qs, unquote, urlsplit

from starlette.responses import Response

from ...helpers import (
    _extract_markdown_section_text,
    _strip_leading_frontmatter_block,
    content_path_for_slug,
    content_slug_for_path,
    find_folder_note_file,
)
from ..markdown.renderer import from_md, infer_code_language, render_code_shell


_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)


def _slug_from_post_route(path: str) -> str:
    raw = unquote(str(path or "").strip())
    if raw.startswith("/posts/"):
        raw = raw[len("/posts/"):]
    return raw.strip("/")


def _current_path_from_request(request) -> str | None:
    if request is None:
        return None
    referer = request.headers.get("referer") or request.headers.get("Referer") or ""
    if referer:
        parsed = urlsplit(referer)
        slug = _slug_from_post_route(parsed.path)
        if slug:
            return slug
    return None


def _normalize_preview_slug(href: str, current_path: str | None) -> tuple[str, str]:
    parsed = urlsplit(href or "")
    path = unquote(parsed.path or "").strip("/")
    fragment = unquote(parsed.fragment or "").strip()
    if not path:
        base = str(current_path or "").strip("/")
    elif path.startswith("posts/"):
        base = path[len("posts/"):]
    else:
        base = path
    base = re.sub(r":\d+(?::\d+)?$", "", base)
    base = base.partition("$")[0]
    if base.endswith(".md"):
        base = base[:-3]
    return base, fragment


def _markdown_target_line(source: str, href: str) -> int | None:
    path = unquote(urlsplit(href or "").path)
    numbered = re.search(r":(\d+)(?::\d+)?$", path)
    if numbered:
        line = int(numbered.group(1))
        return line if 0 < line <= len(source.splitlines()) else None
    if "$" not in path:
        return None
    prefix = path.partition("$")[2]
    return next((number for number, text in enumerate(source.splitlines(), 1) if text.startswith(prefix)), None)


def _default_section_markdown(text: str) -> str:
    body = _strip_leading_frontmatter_block(text)
    matches = list(_HEADING_RE.finditer(body))
    if matches:
        first = matches[0]
        level = len(first.group(1))
        end = len(body)
        for later in matches[1:]:
            if len(later.group(1)) <= level:
                end = later.start()
                break
        return body[first.start():end].strip()
    paragraphs = [chunk.strip() for chunk in re.split(r"\n\s*\n", body) if chunk.strip()]
    return "\n\n".join(paragraphs[:2]).strip()


def _resolve_preview_file(slug: str):
    file_path = content_path_for_slug(slug, ".md")
    if file_path and file_path.exists():
        return file_path
    raw_path = content_path_for_slug(slug)
    if raw_path and raw_path.exists():
        return find_folder_note_file(raw_path) if raw_path.is_dir() else raw_path
    return None


def render_link_preview_html(*, href: str, current_path: str | None = None) -> str | None:
    slug, fragment = _normalize_preview_slug(href, current_path)
    symbol = str(parse_qs(urlsplit(href or "").query).get("symbol", [""])[0]).strip()
    if not slug:
        return None
    file_path = _resolve_preview_file(slug)
    if not file_path or not file_path.exists():
        return None
    source = file_path.read_text(encoding="utf-8", errors="replace")
    target_line = _markdown_target_line(source, href) if file_path.suffix.lower() == ".md" else None
    if file_path.suffix.lower() == ".md":
        section = None if target_line else (
            _extract_markdown_section_text(source, fragment)
            if fragment
            else _strip_leading_frontmatter_block(source).strip()
            if symbol
            else _default_section_markdown(source)
        )
        if not section and fragment:
            section = _default_section_markdown(source)
        if target_line:
            preview_html = render_code_shell(source, "markdown", line_numbers=True)
        elif not section:
            return None
        else:
            page_slug = content_slug_for_path(file_path) or slug
            preview_html = from_md(section, current_path=page_slug)
    else:
        language = infer_code_language(file_path.name)
        preview_html = (
            render_code_shell(source, language, line_numbers=True)
            if language
            else f'<pre class="vyasa-link-preview-plain-text">{html.escape(source)}</pre>'
        )
    relative_path = content_slug_for_path(file_path, strip_suffix=False) or file_path.name
    return (
        f'<div class="vyasa-link-preview-shell" data-relative-path="{html.escape(relative_path, quote=True)}" '
        f'{f"data-target-line={target_line!r} " if target_line else ""}'
        f'data-absolute-path="{html.escape(str(file_path.resolve()), quote=True)}">'
        f'<div class="vyasa-link-preview-body">{preview_html}</div>'
        '</div>'
    )


def register_link_preview_routes(rt, runtime) -> None:
    @rt("/preview/link")
    def preview_link(href: str = "", current_path: str = "", request=None):
        resolved_current_path = current_path or _current_path_from_request(request)
        html = render_link_preview_html(href=href, current_path=resolved_current_path or None)
        if not html:
            return Response("Not Found", status_code=404)
        return Response(html, media_type="text/html")
