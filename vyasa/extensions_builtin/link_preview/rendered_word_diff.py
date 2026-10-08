"""Mark changed words in two rendered HTML fragments.

The diff runs on rendered HTML, not on Markdown source, so marks never split
link, code, emphasis, or table syntax. Each run of changed words becomes one
`<ins>` or `<del>` element; a run splits only where an element boundary forces it.

>>> old, new = mark_changed_words("<p>a b c d</p>", "<p>a X Y c d</p>")
>>> new
'<p>a <ins class="vyasa-markdown-diff-word">X Y</ins> c d</p>'
>>> old
'<p>a <del class="vyasa-markdown-diff-word">b</del> c d</p>'
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import NamedTuple

WORD_CLASS = "vyasa-markdown-diff-word"

_TAG_RE = re.compile(r"<!--.*?-->|<[^>]*>", re.S)
_TAG_NAME_RE = re.compile(r"<(/?)([a-zA-Z][\w-]*)")
# Client-side math reads `$...$` from one text node, so a math span is one atom.
_TEXT_RE = re.compile(r"\$\$.+?\$\$|\$[^$\n]+?\$|&#?\w+;|\s+|\w+|[^\w\s]", re.S)
# Compared as one atom; never marked inside.
_OPAQUE = {"pre", "script", "style", "svg", "math", "textarea", "template"}
# Page chrome such as heading-level buttons; not compared and never marked.
_CHROME = {"button"}
_VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
_INLINE = {
    "a", "abbr", "b", "bdi", "bdo", "cite", "code", "data", "dfn", "em", "i", "kbd",
    "mark", "math", "q", "s", "samp", "small", "span", "strong", "sub", "sup", "svg", "time", "u", "var", "uk-icon",
}


class Atom(NamedTuple):
    kind: str  # "word" | "opaque" | "space" | "tag" | "chrome"
    raw: str
    name: str = ""
    closing: bool = False

    @property
    def compared(self) -> bool:
        return self.kind in ("word", "opaque")


def _element_end(fragment: str, start: int, name: str) -> int:
    """Index after the close tag that matches an open `name` tag ending at `start`."""
    depth = 1
    for match in re.finditer(rf"<(/?){name}\b[^>]*>", fragment[start:], re.I):
        depth += -1 if match.group(1) else 1
        if depth == 0:
            return start + match.end()
    return len(fragment)


def atoms(fragment: str) -> list[Atom]:
    """Split rendered HTML into tags, whole opaque elements, words, and spaces.

    >>> [a.kind for a in atoms("<p>a, <b>c</b></p>")]
    ['tag', 'word', 'word', 'space', 'tag', 'word', 'tag', 'tag']
    """
    output: list[Atom] = []
    pos = 0
    while pos < len(fragment):
        if fragment[pos] != "<":
            end = fragment.find("<", pos)
            end = len(fragment) if end < 0 else end
            output.extend(
                Atom("space" if token.isspace() else "word", token)
                for token in _TEXT_RE.findall(fragment[pos:end])
            )
            pos = end
            continue
        match = _TAG_RE.match(fragment, pos)
        if not match:
            output.append(Atom("word", "<"))
            pos += 1
            continue
        raw = match.group()
        name_match = _TAG_NAME_RE.match(raw)
        name = name_match.group(2).lower() if name_match else ""
        closing = bool(name_match and name_match.group(1))
        whole = name in _OPAQUE | _CHROME and not closing and not raw.endswith("/>")
        if whole:
            end = _element_end(fragment, match.end(), name)
            output.append(Atom("chrome" if name in _CHROME else "opaque", fragment[pos:end], name))
            pos = end
            continue
        output.append(Atom("tag", raw, name, closing))
        pos = match.end()
    return output


def _blocks(side: list[Atom]) -> list[int]:
    """Block number of each atom: it increases at every non-inline tag."""
    numbers: list[int] = []
    block = 0
    for atom in side:
        block += int(atom.kind == "tag" and atom.name not in _INLINE and atom.name not in _VOID)
        numbers.append(block)
    return numbers


def _absorb_short_equalities(
    segments: list[list], old_blocks: list[int], new_blocks: list[int]
) -> list[list]:
    """Merge an unchanged span into its neighbours when it is no longer than the
    edits on both sides, so a rewrite reads as one change, not confetti.

    Rule from diff-match-patch `diff_cleanupSemantic`, limited to one block so
    an unchanged word in the next list item or paragraph stays unmarked.
    """
    def one_block(indexes, blocks) -> bool:
        return len({blocks[index] for index in indexes}) <= 1

    def size(keys) -> int:
        return sum(len(key) for key in keys)

    changed = True
    while changed:
        changed = False
        for index in range(1, len(segments) - 1):
            before, equal, after = segments[index - 1: index + 2]
            if not equal[0] or before[0] or after[0]:
                continue
            equal_size = size(equal[1])
            if equal_size > max(size(before[1]), size(before[2])) or equal_size > max(size(after[1]), size(after[2])):
                continue
            merged = [False, before[1] + equal[1] + after[1], before[2] + equal[2] + after[2]]
            merged.append(before[3] + equal[3] + after[3])
            merged.append(before[4] + equal[4] + after[4])
            if one_block(merged[3], old_blocks) and one_block(merged[4], new_blocks):
                segments[index - 1: index + 2] = [merged]
                changed = True
                break
    return segments


def changed_indexes(old: list[Atom], new: list[Atom]) -> tuple[set[int], set[int]]:
    """Atom indexes that changed on each side.

    >>> changed_indexes(atoms("a b"), atoms("a y"))
    ({2}, {2})
    """
    old_at = [index for index, atom in enumerate(old) if atom.compared]
    new_at = [index for index, atom in enumerate(new) if atom.compared]
    old_keys = [old[index].raw for index in old_at]
    new_keys = [new[index].raw for index in new_at]
    # Segment: [equal, old keys, new keys, old atom indexes, new atom indexes].
    segments = [
        [tag == "equal", old_keys[i1:i2], new_keys[j1:j2], old_at[i1:i2], new_at[j1:j2]]
        for tag, i1, i2, j1, j2 in SequenceMatcher(None, old_keys, new_keys, autojunk=False).get_opcodes()
    ]
    segments = _absorb_short_equalities(segments, _blocks(old), _blocks(new))
    old_changed = {index for segment in segments if not segment[0] for index in segment[3]}
    new_changed = {index for segment in segments if not segment[0] for index in segment[4]}
    return old_changed, new_changed


def _cuts(run: list[Atom]) -> set[int]:
    """Positions in a run that one wrapper cannot span: block tags and
    inline tags whose partner lies outside the run."""
    cuts: set[int] = set()
    stack: list[tuple[str, int]] = []
    for index, atom in enumerate(run):
        # A changed code block is compared but not wrapped; its block label shows the change.
        if atom.kind == "opaque" and atom.name not in _INLINE:
            cuts.add(index)
        if atom.kind != "tag" or atom.name in _VOID or not atom.name:
            continue
        if atom.name not in _INLINE:
            cuts.add(index)
        elif not atom.closing:
            stack.append((atom.name, index))
        elif stack and stack[-1][0] == atom.name:
            stack.pop()
        else:
            cuts.add(index)
    cuts.update(index for _, index in stack)
    return cuts


def _wrap(run: list[Atom], tag: str) -> str:
    """Wrap each cut-free stretch of a run, leaving edge spaces outside."""
    cuts = _cuts(run)
    output: list[str] = []
    stretch: list[Atom] = []

    def flush() -> None:
        # Trim only spaces: the stretch is balanced, so its edge tags stay inside.
        marked = [index for index, atom in enumerate(stretch) if atom.kind != "space"]
        if not any(atom.compared for atom in stretch):
            output.extend(atom.raw for atom in stretch)
        else:
            first, last = marked[0], marked[-1]
            inner = "".join(atom.raw for atom in stretch[first: last + 1])
            output.extend(atom.raw for atom in stretch[:first])
            output.append(f'<{tag} class="{WORD_CLASS}">{inner}</{tag}>')
            output.extend(atom.raw for atom in stretch[last + 1:])
        stretch.clear()

    for index, atom in enumerate(run):
        if index in cuts:
            flush()
            output.append(atom.raw)
        else:
            stretch.append(atom)
    flush()
    return "".join(output)


def runs(side: list[Atom], changed: set[int]) -> list[tuple[int, int]]:
    """Inclusive atom ranges to wrap, one per run of changed atoms.

    A run spans spaces and tags between changed atoms and stops at the first
    unchanged compared atom. Tags touching a run's edges join it, so
    `<b>x</b> y` can become one wrapper when `x` and `y` both changed.
    """
    output: list[tuple[int, int]] = []
    index = 0
    while index < len(side):
        if index not in changed:
            index += 1
            continue
        start, end, probe = index, index, index + 1
        while probe < len(side) and (probe in changed or not side[probe].compared):
            end = probe if probe in changed else end
            probe += 1
        floor = output[-1][1] + 1 if output else 0
        while start > floor and side[start - 1].kind == "tag":
            start -= 1
        while end + 1 < len(side) and side[end + 1].kind == "tag":
            end += 1
        output.append((start, end))
        index = end + 1
    return output


def mark(side: list[Atom], changed: set[int], tag: str) -> str:
    """Rebuild one side with each run wrapped."""
    output: list[str] = []
    position = 0
    for start, end in runs(side, changed):
        output.extend(atom.raw for atom in side[position:start])
        output.append(_wrap(side[start: end + 1], tag))
        position = end + 1
    output.extend(atom.raw for atom in side[position:])
    return "".join(output)


def mark_changed_words(old_html: str, new_html: str) -> tuple[str, str]:
    """Return both fragments with changed word runs wrapped in `<del>` / `<ins>`."""
    old, new = atoms(old_html), atoms(new_html)
    old_changed, new_changed = changed_indexes(old, new)
    return mark(old, old_changed, "del"), mark(new, new_changed, "ins")
