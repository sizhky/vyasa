import re
from dataclasses import dataclass
from .helpers import _strip_leading_frontmatter_block, content_url_for_slug, resolve_heading_anchor


@dataclass(frozen=True)
class SlideRevealConfig:
    enabled: bool = True
    unit: str = "paragraph-groups"
    style: str = "slide-right"
    policy: str = "step"
    stagger_ms: int = 220
    duration_ms: int = 420
    distance: str = "1.75rem"
    easing: str = "cubic-bezier(0.22, 1, 0.36, 1)"


_VOID_HTML_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}


def _coerce_boolish(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in {"true", "1", "yes", "on"}:
        return True
    if text in {"false", "0", "no", "off", "none"}:
        return False
    return None


def _coerce_int(value, default):
    try:
        return int(str(value).strip())
    except Exception:
        return default


def resolve_slide_reveal_config(metadata):
    metadata = metadata or {}
    raw_mode = metadata.get("slide_reveal", metadata.get("slides_reveal", None))
    boolish = _coerce_boolish(raw_mode)
    if boolish is False:
        return SlideRevealConfig(enabled=False)

    style = str(metadata.get("slide_reveal_style", "") or "").strip() or "slide-right"
    if isinstance(raw_mode, str) and raw_mode.strip().lower() not in {"true", "1", "yes", "on"}:
        mode_text = raw_mode.strip().lower()
        if mode_text in {"off", "false", "none"}:
            return SlideRevealConfig(enabled=False)
        if mode_text not in {"on", "stagger", "load"}:
            style = mode_text

    unit = str(metadata.get("slide_reveal_unit", "paragraph-groups") or "paragraph-groups").strip().lower()
    if unit not in {"top-level-blocks", "paragraph-groups"}:
        unit = "paragraph-groups"

    policy = str(metadata.get("slide_reveal_policy", "step") or "step").strip().lower()
    if policy not in {"step", "auto"}:
        policy = "step"

    return SlideRevealConfig(
        enabled=True,
        unit=unit,
        style=style,
        policy=policy,
        stagger_ms=_coerce_int(metadata.get("slide_reveal_stagger"), 220),
        duration_ms=_coerce_int(metadata.get("slide_reveal_duration"), 420),
        distance=str(metadata.get("slide_reveal_distance", "1.75rem") or "1.75rem").strip(),
        easing=str(metadata.get("slide_reveal_easing", "cubic-bezier(0.22, 1, 0.36, 1)") or "cubic-bezier(0.22, 1, 0.36, 1)").strip(),
    )


def _directive_attrs(text):
    text = (text or "").strip()
    if not text:
        return {}
    attrs = {}
    if "=" not in text and text.lower() in {"none", "off", "instant"}:
        attrs["style"] = "none" if text.lower() != "instant" else "instant"
        return attrs
    for token in re.split(r"\s+", text):
        if "=" not in token:
            if token.lower() in {"none", "off", "instant"}:
                attrs["style"] = "none" if token.lower() != "instant" else "instant"
            continue
        key, value = token.split("=", 1)
        key = key.strip().lower()
        value = value.strip().strip('"').strip("'")
        if key in {"style", "delay", "duration", "distance", "easing"} and value:
            attrs[key] = value
    return attrs


def inject_reveal_directives(markdown_text):
    pattern = re.compile(r"^\s*<!--\s*reveal(?::|\s+)?(.*?)\s*-->\s*$", re.MULTILINE)
    return pattern.sub(
        lambda m: "\n<vyasa-reveal " + " ".join(
            f'data-{key}="{value}"' for key, value in _directive_attrs(m.group(1)).items()
        ) + "></vyasa-reveal>\n",
        markdown_text,
    )


def split_top_level_html(fragment):
    tag_re = re.compile(r"<!--[\s\S]*?-->|</?[^>]+?>", re.MULTILINE)
    chunks = []
    depth = 0
    chunk_start = None
    pos = 0
    for match in tag_re.finditer(fragment):
        if chunk_start is None and fragment[pos:match.start()].strip():
            chunk_start = pos
        tag = match.group(0)
        if chunk_start is None and tag.strip():
            chunk_start = match.start()
        if tag.startswith("</"):
            depth = max(depth - 1, 0)
        elif tag.startswith("<!--") or tag.startswith("<!"):
            pass
        else:
            tag_name_match = re.match(r"<\s*([A-Za-z0-9:_-]+)", tag)
            tag_name = tag_name_match.group(1).lower() if tag_name_match else ""
            self_closing = tag.endswith("/>") or tag_name in _VOID_HTML_TAGS
            if not self_closing:
                depth += 1
        if chunk_start is not None and depth == 0:
            chunk = fragment[chunk_start:match.end()].strip()
            if chunk:
                chunks.append(chunk)
            chunk_start = None
        pos = match.end()
    trailing = fragment[(chunk_start if chunk_start is not None else pos):].strip()
    if trailing:
        chunks.append(trailing)
    return chunks


def split_markdown_paragraph_groups(markdown_text):
    groups, current = [], []
    in_fence = False
    tabs_depth = 0
    for line in markdown_text.splitlines():
        stripped = line.strip()
        if line == '---':
            continue
        if re.match(r"^(```+|~~~+)", stripped):
            in_fence = not in_fence
        elif not in_fence and stripped == ":::tabs":
            tabs_depth += 1
        elif not in_fence and tabs_depth and stripped == ":::":
            tabs_depth -= 1
        if not in_fence and not tabs_depth and not stripped:
            if current:
                groups.append("\n".join(current).strip())
                current = []
            continue
        current.append(line)
    if current:
        groups.append("\n".join(current).strip())
    groups = [group for group in groups if group]
    exploded = []
    for group in groups:
        if _contains_tabs_group(group):
            exploded.append(group)
        elif _contains_list_group(group):
            exploded.extend(_split_mixed_list_group(group))
        else:
            exploded.append(group)
    return exploded


def _is_heading_only_group(group):
    lines = [line.strip() for line in (group or "").splitlines() if line.strip()]
    return len(lines) == 1 and bool(re.match(r"^#{1,6}\s+", lines[0]))


def _is_list_group(group):
    lines = [line.strip() for line in (group or "").splitlines() if line.strip()]
    return bool(lines) and all(
        re.match(r"^([-*+]\s+|\d+\.\s+)", line) for line in lines
    )


def _split_mixed_list_group(group):
    parts = []
    prelude = []
    current_item = []
    for line in (group or "").splitlines():
        if re.match(r"^\s*([-*+]\s+|\d+\.\s+)", line):
            if current_item:
                parts.append("\n".join(current_item).strip())
            elif prelude:
                parts.append("\n".join(prelude).strip())
                prelude = []
            current_item = [line]
            continue
        if current_item:
            current_item.append(line)
        else:
            prelude.append(line)
    if current_item:
        parts.append("\n".join(current_item).strip())
    elif prelude:
        parts.append("\n".join(prelude).strip())
    return [part for part in parts if part]


def _contains_list_group(group):
    lines = [line.strip() for line in (group or "").splitlines() if line.strip()]
    return any(re.match(r"^([-*+]\s+|\d+\.\s+)", line) for line in lines)


def _contains_tabs_group(group):
    text = group or ""
    return ":::tabs" in text or "::tab{" in text


def _parse_reveal_directive_chunk(chunk):
    match = re.fullmatch(r"<vyasa-reveal(?P<attrs>[^>]*)></vyasa-reveal>", chunk.strip())
    if not match:
        return None
    attrs = {}
    for key, value in re.findall(r'data-([a-z]+)="([^"]+)"', match.group("attrs")):
        attrs[key] = value
    return attrs


def build_slide_reveal_units(markdown_text, *, render_fragment, current_path, config: SlideRevealConfig):
    if not config.enabled:
        return []
    pending = {}
    units = []
    if config.unit == "paragraph-groups":
        for group in split_markdown_paragraph_groups(inject_reveal_directives(markdown_text)):
            directive = _parse_reveal_directive_chunk(group)
            if directive:
                pending.update(directive)
                continue
            kind = "content"
            if _is_heading_only_group(group):
                kind = "heading"
            elif _contains_list_group(group):
                kind = "list"
            units.append({
                "html": render_fragment(group, current_path=current_path, slide_mode=True),
                "kind": kind,
                **pending,
            })
            pending = {}
        return [unit for unit in units if unit.get("html", "").strip()]

    fragment = render_fragment(inject_reveal_directives(markdown_text), current_path=current_path, slide_mode=True)
    for chunk in split_top_level_html(fragment):
        directive = _parse_reveal_directive_chunk(chunk)
        if directive is not None:
            pending.update(directive)
            continue
        units.append({"html": chunk, "kind": "content", **pending})
        pending = {}
    return [unit for unit in units if unit.get("html", "").strip()]

class ZenSlideDeck:
    def __init__(self, markdown_text):
        self.slides = list(iter_zen_slides(markdown_text)) or [["# Empty deck"]]
        self.anchors = self._build_anchors()

    def clamp(self, index):
        return max(1, min(index, len(self.slides)))

    def body(self, index):
        return "\n\n".join(self.slides[self.clamp(index) - 1])

    def href(self, doc_path, index):
        return content_url_for_slug(doc_path, prefix="/slides", suffix=f"/{slide_slug(self.clamp(index))}")

    def anchor(self, index):
        return self.anchors[self.clamp(index) - 1]

    def doc_href(self, doc_path, index):
        anchor = self.anchor(index)
        return content_url_for_slug(doc_path, fragment=anchor) if anchor else content_url_for_slug(doc_path)

    def nav(self, doc_path, index):
        index = self.clamp(index)
        return {
            "index": index,
            "total": len(self.slides),
            "left": self.href(doc_path, index - 1),
            "right": self.href(doc_path, index + 1),
        }

    def outline(self, doc_path):
        items = []
        for index, slide in enumerate(self.slides, start=1):
            crumbs = []
            for block in slide:
                match = re.match(r"^(#{1,6})\s+(.+)$", block, re.MULTILINE)
                if match:
                    crumbs.append(match.group(2).strip())
            items.append({
                "index": index + 1,
                "text": "✦ > " + " > ".join(crumbs) if crumbs else "✦",
                "href": content_url_for_slug(doc_path, prefix="/slides", suffix=f"/{slide_slug(index + 1)}"),
            })
        return items

    def _build_anchors(self):
        counts = {}
        anchors = []
        for slide in self.slides:
            slide_anchor = None
            for block in slide:
                match = re.match(r"^(#{1,6})\s+(.+)$", block, re.MULTILINE)
                if not match:
                    continue
                _, anchor = resolve_heading_anchor(match.group(2).strip(), counts)
                slide_anchor = anchor
            anchors.append(slide_anchor)
        return anchors


def iter_zen_slides(markdown_text):
    blocks = _split_blocks(_strip_leading_frontmatter_block(markdown_text))
    prelude = []
    context = []
    for block in blocks:
        heading = _heading_level(block)
        if not heading:
            if block.strip():
                prelude.append(block)
            continue
        head, body = _split_heading_block(block)
        while context and context[-1][0] >= heading:
            context.pop()
        if prelude and not context:
            yield prelude
            prelude = []
        if body:
            yield prelude + [item for _, item in context] + [head, body]
            prelude = []
        context.append((heading, head))
    if prelude:
        yield prelude


def _split_blocks(markdown_text):
    blocks, current = [], []
    in_fence = False
    tabs_depth = 0
    for line in markdown_text.strip().splitlines():
        stripped = line.strip()
        if re.match(r"^(```+|~~~+)", stripped):
            in_fence = not in_fence
        elif not in_fence and stripped == ":::tabs":
            tabs_depth += 1
        elif not in_fence and tabs_depth and stripped == ":::":
            tabs_depth -= 1
        if current and not in_fence and not tabs_depth and re.match(r"^#{1,6}\s+", line):
            blocks.append("\n".join(current).strip())
            current = [line]
            continue
        current.append(line)
    if current:
        blocks.append("\n".join(current).strip())
    return [block for block in blocks if block]


def _heading_level(block):
    match = re.match(r"^(#{1,6})\s+", block)
    return len(match.group(1)) if match else None


def _block_has_body(block):
    lines = block.splitlines()
    return any(line.strip() for line in lines[1:])


def _split_heading_block(block):
    lines = block.splitlines()
    return lines[0], "\n".join(lines[1:]).strip()


def slide_slug(index):
    return f"slide-{index}"


def present_href_for_anchor(markdown_text, doc_path, target_anchor):
    deck = ZenSlideDeck(markdown_text)
    for index, anchor in enumerate(deck.anchors, start=2):
        if anchor == target_anchor:
            return content_url_for_slug(doc_path, prefix="/slides", suffix=f"/{slide_slug(index)}")
    return content_url_for_slug(doc_path, prefix="/slides", suffix="/slide-2")
