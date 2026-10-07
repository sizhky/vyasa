"""HTML pass that finishes what the source translator marked.

Implements vyasa manual/mkdocs-compatibility.md#markdown: attr_list markers move
onto the element before them, and headings get MkDocs slug anchors.
"""

from __future__ import annotations

import html
import json
import re

MARKER = re.compile(r'<span class="vyasa-mkdocs-attrs" data-mkdocs-target="(inline|block)" data-mkdocs-attrs="([^"]*)"></span>')
TAG_ATTR = re.compile(r'\s([\w:-]+)(?:="([^"]*)")?')
HEADING = re.compile(r'(<h([1-6]) id="([^"]*)"[^>]*>)(.*?<span class="vyasa-heading-text">(.*?)</span>)', re.DOTALL)


def mkdocs_slug(text: str, separator: str = "-") -> str:
    """Python-Markdown toc's default slugify.

    >>> mkdocs_slug("AWS Setup (IAM · Logs)")
    'aws-setup-iam-logs'
    >>> mkdocs_slug("Ünïcode & C++")
    'unicode-c'
    """
    import unicodedata

    value = unicodedata.normalize("NFKD", html.unescape(re.sub(r"<[^>]+>", "", text))).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    return re.sub(rf"[{re.escape(separator)}\s]+", separator, value)


def add_slug_aliases(text: str) -> str:
    """Anchor MkDocs-style `#slug` links whose slug differs from Vyasa's heading id."""
    ids = set(re.findall(r'\sid="([^"]+)"', text))

    def alias(match):
        slug = mkdocs_slug(match.group(5))
        if not slug or slug in ids:
            return match.group(0)
        ids.add(slug)
        # The alias sits inside the heading, so it moves, hides, and reveals with it.
        return f'{match.group(1)}<span id="{slug}" class="vyasa-mkdocs-anchor"></span>{match.group(4)}'

    return HEADING.sub(alias, text)


def _merge_attrs(open_tag: str, attrs: dict[str, str]) -> str:
    """Add attr_list attributes to an opening tag; classes append, others replace.

    >>> _merge_attrs('<a href="x" class="a">', {"class": "md-button", "target": "_blank"})
    '<a href="x" class="a md-button" target="_blank">'
    >>> _merge_attrs('<img src="i.png" />', {"width": "300"})
    '<img src="i.png" width="300" />'
    """
    match = re.match(r"^<([\w-]+)(.*?)(\s*/?)>$", open_tag, re.DOTALL)
    if not match:
        return open_tag
    name, body, closing = match.groups()
    current = {key: value for key, value in TAG_ATTR.findall(body)}
    order = [key for key, _ in TAG_ATTR.findall(body)]
    for key, value in attrs.items():
        if key == "class" and current.get("class"):
            current["class"] = f'{current["class"]} {value}'
        else:
            current[key] = value
        if key not in order:
            order.append(key)
    rendered = "".join(f' {key}="{html.escape(current[key], quote=True)}"' if current[key] != "" else f" {key}" for key in order)
    return f"<{name}{rendered}{closing}>"


def _target_open_tag(before: str, target: str) -> tuple[int, int] | None:
    """Span of the opening tag the marker at the end of `before` applies to."""
    if target == "block":
        index = max(before.rfind("<p"), before.rfind("<li"))
        if index < 0:
            return None
        end = before.find(">", index)
        return (index, end + 1) if end > 0 else None
    closing = re.search(r"</(a|span|code|strong|em|abbr|kbd)>\s*$", before)
    if closing:
        index = before.rfind(f"<{closing.group(1)}", 0, closing.start())
        end = before.find(">", index)
        return (index, end + 1) if index >= 0 and end > 0 else None
    void = re.search(r"<(img|input|br)\b[^>]*>\s*$", before)
    return (void.start(), void.end()) if void else None


def apply_attr_markers(text: str) -> str:
    while True:
        match = MARKER.search(text)
        if not match:
            return text
        before, after = text[: match.start()], text[match.end():]
        span = _target_open_tag(before, match.group(1))
        if span:
            attrs = json.loads(html.unescape(match.group(2)))
            before = before[: span[0]] + _merge_attrs(before[span[0]: span[1]], attrs) + before[span[1]:]
        text = before + after


def postprocess(html_fragment: str, context=None, state=None, render_tab_content=None) -> str:
    return add_slug_aliases(apply_attr_markers(html_fragment))
