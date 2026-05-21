from __future__ import annotations

import html
import re
from urllib.parse import unquote, urlsplit

from starlette.responses import Response

from ...helpers import (
    _extract_markdown_section_text,
    _strip_leading_frontmatter_block,
    content_path_for_slug,
    content_slug_for_path,
    find_folder_note_file,
    resolve_markdown_title,
)
from ..markdown.renderer import from_md


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
    if base.endswith(".md"):
        base = base[:-3]
    return base, fragment


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
    folder_path = content_path_for_slug(slug)
    if folder_path and folder_path.exists() and folder_path.is_dir():
        return find_folder_note_file(folder_path)
    return None


def render_link_preview_html(*, href: str, current_path: str | None = None) -> str | None:
    slug, fragment = _normalize_preview_slug(href, current_path)
    if not slug:
        return None
    file_path = _resolve_preview_file(slug)
    if not file_path or not file_path.exists():
        return None
    source = file_path.read_text(encoding="utf-8")
    section = _extract_markdown_section_text(source, fragment) if fragment else _default_section_markdown(source)
    if not section and fragment:
        section = _default_section_markdown(source)
    if not section:
        return None
    page_slug = content_slug_for_path(file_path) or slug
    preview_html = from_md(section, current_path=page_slug)
    title, _ = resolve_markdown_title(file_path)
    return (
        '<div class="vyasa-link-preview-shell">'
        f'<div class="vyasa-link-preview-source text-[10px] font-semibold uppercase tracking-[0.18em]">'
        f'{html.escape(title)}</div>'
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
