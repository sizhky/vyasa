import re
from dataclasses import dataclass
from ...helpers import _strip_leading_frontmatter_block, content_url_for_slug, resolve_heading_anchor
from ..tooltip_syntax import extract_tooltips, format_tooltip_definitions


@dataclass(frozen=True)
class SlideRevealConfig:
    enabled: bool = True
    unit: str = "paragraph-groups"
    style: str = "slide-right"
    policy: str = "step"
    stagger_ms: int = 300
    duration_ms: int = 420
    distance: str = "0.5rem"
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
        stagger_ms=_coerce_int(metadata.get("slide_reveal_stagger"), SlideRevealConfig.stagger_ms),
        duration_ms=_coerce_int(metadata.get("slide_reveal_duration"), SlideRevealConfig.duration_ms),
        distance=str(metadata.get("slide_reveal_distance", "") or SlideRevealConfig.distance).strip(),
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


_DIRECTIVE = re.compile(r"^(?:<p\b[^>]*>\s*)?<vyasa-reveal(?P<attrs>[^>]*)></vyasa-reveal>(?:\s*</p>)?$")
_LIST = re.compile(r"^<(ul|ol)\b([^>]*)>(.*)</\1>$", re.DOTALL)
_SUPPORT_ONLY = re.compile(r"^<(script|style|link)\b", re.IGNORECASE)
_POPOVER = re.compile(r"^<\w+\b[^>]*\bid=\"([^\"]+)\"[^>]*\bpopover\b")


def _parse_reveal_directive_chunk(chunk):
    match = _DIRECTIVE.match(chunk.strip())
    if not match:
        return None
    return dict(re.findall(r'data-([a-z]+)="([^"]+)"', match.group("attrs")))


def split_list_items(chunk):
    """One chunk per top-level item of a rendered list; an ordered list keeps its numbering.

    >>> split_list_items('<ol class="x"><li>a</li><li>b<ul><li>c</li></ul></li></ol>')
    ['<ol class="x" start="1"><li>a</li></ol>', '<ol class="x" start="2"><li>b<ul><li>c</li></ul></li></ol>']
    >>> split_list_items('<p>text</p>')
    ['<p>text</p>']
    """
    match = _LIST.match(chunk.strip())
    if not match:
        return [chunk]
    tag, attrs, inner = match.groups()
    items = [item for item in split_top_level_html(inner) if item.startswith("<li")]
    if len(items) < 2:
        return [chunk]
    start_match = re.search(r'\bstart="(\d+)"', attrs)
    first = int(start_match.group(1)) if start_match else 1
    attrs = re.sub(r'\s*\bstart="\d+"', "", attrs)
    if tag == "ol":
        return [f'<ol{attrs} start="{first + index}">{item}</ol>' for index, item in enumerate(items)]
    return [f"<ul{attrs}>{item}</ul>" for item in items]


def _is_anchor(chunk):
    """True for an empty `<a>` or `<span>`, such as a link target with no content.

    >>> _is_anchor('<span id="a"></span>'), _is_anchor('<a id="b"> </a>'), _is_anchor('<div class="d2"></div>')
    (True, True, False)
    """
    return bool(re.fullmatch(r"<(a|span)\b[^>]*>\s*</\1>", chunk.strip(), re.IGNORECASE))


def _unit_kind(chunk):
    if re.match(r"^<h[1-6]\b", chunk):
        return "heading"
    return "list" if re.match(r"^<(ul|ol)\b", chunk) else "content"


def build_slide_reveal_units(markdown_text, *, render_fragment, current_path, config: SlideRevealConfig):
    """Reveal units from the rendered slide: one per top-level HTML element.

    The renderer alone decides where a block ends, so callouts, tabs, card grids, and
    footnotes stay whole. `paragraph-groups` also reveals a list one item at a time.
    Support elements join a unit: scripts and styles join the unit before them, and a
    popover joins the unit that holds its trigger.
    """
    if not config.enabled:
        return []
    fragment = render_fragment(inject_reveal_directives(markdown_text), current_path=current_path, slide_mode=True)
    chunks = split_top_level_html(fragment)
    if config.unit == "paragraph-groups":
        chunks = [piece for chunk in chunks for piece in split_list_items(chunk)]
    units, pending, popovers, lead = [], {}, [], ""
    for chunk in chunks:
        directive = _parse_reveal_directive_chunk(chunk)
        if directive is None and _is_anchor(chunk):
            lead += chunk  # a link target belongs to the block after it
            continue
        if directive is not None:
            pending.update(directive)
        elif re.match(r"^<hr\b", chunk):
            continue
        elif popover := _POPOVER.match(chunk):
            popovers.append((popover.group(1), chunk))
        elif _SUPPORT_ONLY.match(chunk) and units:
            units[-1]["html"] += chunk
        else:
            units.append({"html": lead + chunk, "kind": _unit_kind(chunk), **pending})
            pending, lead = {}, ""
    if lead and units:
        units[-1]["html"] += lead
    for popover_id, chunk in popovers:
        owner = next((unit for unit in units if f'popovertarget="{popover_id}"' in unit["html"]), units[-1] if units else None)
        if owner is not None:
            owner["html"] += chunk
    return [unit for unit in units if unit.get("html", "").strip()]


_SEGMENT_COUNTS: dict[tuple, int] = {}


def count_slide_progress_segments(markdown_text, *, render_fragment, current_path, config):
    """Revealable non-heading units after a slide's leading headings.

    Counting needs the rendered units, so counts are cached per slide text and config.
    """
    from ...config import config_generation

    key = (markdown_text, current_path, config, config_generation())
    if key not in _SEGMENT_COUNTS:
        if len(_SEGMENT_COUNTS) > 4096:
            _SEGMENT_COUNTS.clear()
        units = build_slide_reveal_units(markdown_text, render_fragment=render_fragment, current_path=current_path, config=config)
        step_units = [unit for unit in units if (unit.get("style") or config.style) not in {"none", "instant"}]
        first_content = next((index for index, unit in enumerate(step_units) if unit.get("kind") != "heading"), len(step_units))
        _SEGMENT_COUNTS[key] = sum(1 for unit in step_units[first_content:] if unit.get("kind") != "heading")
    return _SEGMENT_COUNTS[key]


class ZenSlideDeck:
    def __init__(self, markdown_text):
        content, tooltips = extract_tooltips(markdown_text)
        self.tooltip_definitions = format_tooltip_definitions(tooltips)
        self.slides = list(iter_zen_slides(content)) or [["# Empty deck"]]
        self.anchors = self._build_anchors()

    def clamp(self, index):
        return max(1, min(index, len(self.slides)))

    def body(self, index):
        content = "\n\n".join(self.slides[self.clamp(index) - 1])
        return f"{content}\n\n{self.tooltip_definitions}" if self.tooltip_definitions else content

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
        paths = {}
        for index, slide in enumerate(self.slides, start=1):
            crumbs = []
            for block in slide:
                match = re.match(r"^(#{1,6})\s+(.+)$", block, re.MULTILINE)
                if match:
                    crumbs.append(match.group(2).strip())
            if not crumbs:
                items.append({
                    "index": index + 1, "label": f"Slide {index + 1}", "depth": 1,
                    "href": content_url_for_slug(doc_path, prefix="/slides", suffix=f"/{slide_slug(index + 1)}"),
                })
                continue
            for depth in range(1, len(crumbs) + 1):
                path = tuple(crumbs[:depth])
                item = paths.get(path)
                if item is None:
                    item = {"index": None, "label": crumbs[depth - 1], "depth": depth, "href": None}
                    paths[path] = item
                    items.append(item)
                if depth == len(crumbs):
                    item["index"] = index + 1
                    item["href"] = content_url_for_slug(
                        doc_path, prefix="/slides", suffix=f"/{slide_slug(index + 1)}",
                    )
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
