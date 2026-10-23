"""Pending edits to one section: diffed word by word, shown inline, accepted hunk by hunk.

A proposal never touches the file. It holds the section text it was made
against (``base``) and the text the agent wants (``proposed``). Accepting hunks
writes ``base`` with those hunks applied, through the same revision check as a
save; rejecting hunks removes them from ``proposed``. Either way the proposal
is diffed again, and it is done when the two texts agree.

While an agent is still writing, ``partial`` is set and ``proposed`` is a
prefix of what it will send. The base text past the last point the stream has
matched is then "pending", not deleted, so the tail of the section does not
flash as removed before the agent reaches it.
"""

from __future__ import annotations

import itertools
import json
import re
import time
from dataclasses import asdict, dataclass, field, fields
from difflib import SequenceMatcher
from pathlib import Path

_TOKEN = re.compile(r"\s+|\w+|[^\w\s]")
# Block markup that must stay at the start of its line, outside any diff tag,
# or the line stops being a heading, list item, or quote.
_LINE_MARKUP = re.compile(r"^[ \t]*(?:#{1,6}[ \t]+|(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?|>[ \t]?)*")
_FENCE = re.compile(r"^[ \t]{0,3}(`{3,}|~{3,})")


def tokens(text: str) -> list[str]:
    """Words, runs of whitespace, and single punctuation marks, in order.

    >>> tokens("a  b, c\\n")
    ['a', '  ', 'b', ',', ' ', 'c', '\\n']
    """
    return _TOKEN.findall(text)


@dataclass(frozen=True)
class Segment:
    kind: str  # equal | insert | delete | replace | pending
    old: str
    new: str
    hunk: int | None


def diff(base: str, proposed: str, *, partial: bool = False) -> list[Segment]:
    """Token diff of ``proposed`` against ``base``; every change but ``pending`` is a numbered hunk.

    Neighbouring changes separated only by whitespace merge into one hunk, so a
    reworded phrase is one decision, not one per word.

    >>> [(s.kind, s.old, s.new, s.hunk) for s in diff("the quick brown fox", "the slow red fox")]
    [('equal', 'the ', 'the ', None), ('replace', 'quick brown', 'slow red', 0), ('equal', ' fox', ' fox', None)]
    >>> [(s.kind, s.old, s.new) for s in diff("one two three", "one 2", partial=True)]
    [('equal', 'one ', 'one '), ('insert', '', '2'), ('pending', 'two three', '')]
    """
    old, new = tokens(base), tokens(proposed)
    ops = SequenceMatcher(None, old, new, autojunk=False).get_opcodes()
    raw: list[list] = []
    for tag, i1, i2, j1, j2 in ops:
        piece = ["".join(old[i1:i2]), "".join(new[j1:j2])]
        kind = "equal" if tag == "equal" else "change"
        if kind == "change" and raw and raw[-1][0] == "change":
            raw[-1][1] += piece[0]
            raw[-1][2] += piece[1]
        else:
            raw.append([kind, *piece])
    # Fold whitespace-only equal runs between two changes into one change.
    folded: list[list] = []
    for entry in raw:
        if (
            folded
            and entry[0] == "change"
            and len(folded) >= 2
            and folded[-1][0] == "equal"
            and not folded[-1][1].strip()
            and folded[-2][0] == "change"
        ):
            gap = folded.pop()
            folded[-1][1] += gap[1] + entry[1]
            folded[-1][2] += gap[2] + entry[2]
        else:
            folded.append(list(entry))
    if partial and folded and folded[-1][0] == "change" and folded[-1][1]:
        # The stream has not reached the rest of the base yet.
        _, rest, typed = folded.pop()
        if typed:
            folded.append(["change", "", typed])
        folded.append(["pending", rest, ""])
    numbers = itertools.count()
    segments = []
    for kind, a, b in folded:
        if kind == "change":
            kind = "replace" if a and b else ("insert" if b else "delete")
            segments.append(Segment(kind, a, b, next(numbers)))
        else:
            segments.append(Segment(kind, a, b, None))
    return segments


def merge(segments: list[Segment], hunks: set[int]) -> str:
    """The base text with the given hunks applied; pending text stays as base.

    >>> segs = diff("a b c", "a x c y")
    >>> merge(segs, {0}), merge(segs, set()), merge(segs, {0, 1})
    ('a x c', 'a b c', 'a x c y')
    """
    out = []
    for segment in segments:
        take_new = segment.hunk is not None and segment.hunk in hunks
        out.append(segment.new if take_new else segment.old)
    return "".join(out)


def _tag(kind: str, text: str, hunk: int | None) -> str:
    if not text or kind == "equal":
        return text
    if kind == "pending":
        return f'<span class="vyasa-diff-pending">{text}</span>'
    name = "ins" if kind == "insert" else "del"
    return f'<{name} class="vyasa-diff-{name}" data-vyasa-hunk="{hunk}">{text}</{name}>'


def marked_markdown(segments: list[Segment], *, partial: bool = False) -> str:
    """Markdown of the proposed section with each change wrapped in ``<ins>`` or ``<del>``.

    Tags never cross a line, and a line's block markup (heading hashes, list
    marker, quote) stays outside them, so the structure renders as it will
    after accepting. Inside a fence, tags would show as code: the fence is
    shown as proposed, and a marker line before it carries its hunks. An
    unclosed fence at the end of a partial proposal renders as plain text, so a
    half-written diagram is not drawn.

    >>> print(marked_markdown(diff("- old item\\n", "- new item\\n")))
    - <del class="vyasa-diff-del" data-vyasa-hunk="0">old</del><ins class="vyasa-diff-ins" data-vyasa-hunk="0">new</ins> item
    <BLANKLINE>
    >>> print(marked_markdown(diff("```py\\na = 1\\n```\\n", "```py\\na = 2\\n```\\n")))
    <div class="vyasa-diff-block" data-vyasa-hunks="0"></div>
    <BLANKLINE>
    ```py
    a = 2
    ```
    <BLANKLINE>
    """
    # Split the display stream into lines of (kind, text, hunk) pieces.
    lines: list[list[tuple[str, str, int | None]]] = [[]]
    for segment in segments:
        parts = []
        if segment.kind in ("delete", "replace"):
            parts.append(("delete", segment.old))
        if segment.kind in ("insert", "replace"):
            parts.append(("insert", segment.new))
        if segment.kind in ("equal", "pending"):
            parts.append((segment.kind, segment.old))
        for kind, text in parts:
            for index, chunk in enumerate(text.split("\n")):
                if index:
                    lines.append([])
                if chunk:
                    lines[-1].append((kind, chunk, segment.hunk))
    out: list[str] = []
    fence: str | None = None
    fence_marker = ""
    fence_hunks: list[int] = []
    fence_start = 0
    for pieces in lines:
        shown = "".join(text for kind, text, _ in pieces if kind in ("equal", "insert"))
        hunks = [h for kind, _, h in pieces if h is not None]
        opener = _FENCE.match(shown)
        if fence is None and opener and any(kind in ("equal", "insert") for kind, _, _ in pieces):
            fence_marker = opener.group(1)
            fence, fence_hunks, fence_start = fence_marker[0], list(hunks), len(out)
            out.append(shown)
            continue
        if fence is not None:
            fence_hunks.extend(hunks)
            if not shown and pieces:
                continue  # a deleted or pending line inside a fence
            out.append(shown)
            if opener and opener.group(1)[0] == fence and not shown.strip().strip(fence):
                if fence_hunks:
                    ids = " ".join(str(h) for h in dict.fromkeys(fence_hunks))
                    out.insert(fence_start, f'<div class="vyasa-diff-block" data-vyasa-hunks="{ids}"></div>\n')
                fence = None
            continue
        out.append(_mark_line(pieces))
    if fence is not None and partial:
        out[fence_start] = fence_marker
    return "\n".join(out)


def _mark_line(pieces: list[tuple[str, str, int | None]]) -> str:
    text = "".join(text for _, text, _ in pieces)
    markup = _LINE_MARKUP.match(text)
    keep = markup.end() if markup else 0
    head, body, used = [], [], 0
    for kind, chunk, hunk in pieces:
        cut = max(0, min(len(chunk), keep - used))
        used += len(chunk)
        if cut:
            head.append(chunk[:cut])
        if chunk[cut:]:
            body.append(_tag(kind, chunk[cut:], hunk))
    return "".join(head) + "".join(body)


@dataclass
class Proposal:
    id: str
    slug: str
    heading: str
    anchor: str
    base: str
    base_revision: str
    proposed: str
    partial: bool = False
    origin: str = ""
    stale_base: bool = False
    created: float = field(default_factory=time.time)

    def segments(self) -> list[Segment]:
        return diff(self.base, self.proposed, partial=self.partial)

    def to_json(self) -> dict:
        segments = self.segments()
        return {
            "id": self.id,
            "slug": self.slug,
            "heading": self.heading,
            "anchor": self.anchor,
            "origin": self.origin,
            "partial": self.partial,
            "stale_base": self.stale_base,
            "base_revision": self.base_revision,
            "hunks": [{"id": s.hunk, "kind": s.kind} for s in segments if s.hunk is not None],
            "marked": marked_markdown(segments, partial=self.partial),
        }


class ProposalStore:
    """Proposals per server process; ``open`` a JSON file and every change is saved there, so a restart keeps them.

    >>> import tempfile, pathlib
    >>> path = pathlib.Path(tempfile.mkdtemp()) / "proposals.json"
    >>> store = ProposalStore()
    >>> store.open(path)
    >>> made = store.add(Proposal(store.new_id(), "notes", "## Now", "now", "a", "r1", "b"))
    >>> made.proposed = "c"
    >>> store.save()
    >>> again = ProposalStore()
    >>> again.open(path)
    >>> [(p.id, p.proposed) for p in again.for_slug("notes")], again.new_id()
    ([('p1', 'c')], 'p2')
    >>> again.drop("p1")
    >>> json.loads(path.read_text())
    []
    """

    def __init__(self):
        self._items: dict[str, Proposal] = {}
        self._ids = itertools.count(1)
        self.path: Path | None = None

    def open(self, path: Path | None) -> None:
        """Load the proposals saved at ``path`` and save there from now on; ``None`` keeps them in memory only."""
        self.path = path
        rows = []
        if path is not None and path.is_file():
            try:
                rows = json.loads(path.read_text(encoding="utf-8"))
            except ValueError:
                rows = []
        names = {f.name for f in fields(Proposal)}
        self._items = {row["id"]: Proposal(**{k: v for k, v in row.items() if k in names}) for row in rows}
        numbers = [int(pid[1:]) for pid in self._items if pid[1:].isdigit()]
        self._ids = itertools.count(max(numbers, default=0) + 1)

    def save(self) -> None:
        if self.path is not None:
            from ...helpers import atomic_write_bytes

            atomic_write_bytes(self.path, json.dumps([asdict(p) for p in self._items.values()]).encode("utf-8"))

    def new_id(self) -> str:
        return f"p{next(self._ids)}"

    def add(self, proposal: Proposal) -> Proposal:
        self._items[proposal.id] = proposal
        self.save()
        return proposal

    def get(self, proposal_id: str) -> Proposal | None:
        return self._items.get(proposal_id)

    def for_slug(self, slug: str) -> list[Proposal]:
        return sorted((p for p in self._items.values() if p.slug == slug), key=lambda p: p.created)

    def drop(self, proposal_id: str) -> None:
        self._items.pop(proposal_id, None)
        self.save()


STORE = ProposalStore()

__all__ = ["Proposal", "ProposalStore", "STORE", "Segment", "diff", "marked_markdown", "merge", "tokens"]
