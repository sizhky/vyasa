import re
from .helpers import resolve_heading_anchor


class ZenSlideDeck:
    def __init__(self, markdown_text):
        self.slides = list(iter_zen_slides(markdown_text)) or [["# Empty deck"]]
        self.anchors = self._build_anchors()

    def clamp(self, index):
        return max(1, min(index, len(self.slides)))

    def body(self, index):
        return "\n\n".join(self.slides[self.clamp(index) - 1])

    def href(self, doc_path, index):
        return f"/slides/{doc_path}/{slide_slug(self.clamp(index))}"

    def anchor(self, index):
        return self.anchors[self.clamp(index) - 1]

    def doc_href(self, doc_path, index):
        anchor = self.anchor(index)
        return f"/posts/{doc_path}#{anchor}" if anchor else f"/posts/{doc_path}"

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
                match = re.match(r"^(#{2,6})\s+(.+)$", block, re.MULTILINE)
                if match:
                    crumbs.append(match.group(2).strip())
            items.append({
                "index": index + 1,
                "text": "✦ > " + " > ".join(crumbs) if crumbs else "✦",
                "href": f"/slides/{doc_path}/{slide_slug(index + 1)}",
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
    blocks = _split_blocks(markdown_text)
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
        if heading == 1:
            if body:
                prelude = [body]
            continue
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
    counts = {}
    for index, slide in enumerate(iter_zen_slides(markdown_text), start=1):
        for block in slide:
            match = re.match(r"^(#{1,6})\s+(.+)$", block, re.MULTILINE)
            if not match:
                continue
            _, anchor = resolve_heading_anchor(match.group(2).strip(), counts)
            if anchor == target_anchor:
                return f"/slides/{doc_path}/{slide_slug(index + 1)}"
    return f"/slides/{doc_path}/slide-2"
