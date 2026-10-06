"""Rewrite MkDocs / Python-Markdown / pymdownx syntax into Vyasa Markdown.

Implements vyasa manual/mkdocs-compatibility.md#markdown. Block constructs become
raw-HTML shells around blank-line-separated Markdown, so CommonMark parses the
body as ordinary Markdown and nesting needs no recursion in the renderer.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import textwrap
from pathlib import Path

FENCE_OPEN = re.compile(r"^(\s*)(`{3,}|~{3,})(.*)$")
ADMONITION = re.compile(r'^(\s*)(!!!|\?\?\?\+?)\s+([\w-]+)((?:\s+[\w-]+)*)(?:\s+"(.*)")?\s*$')
TAB = re.compile(r'^(\s*)===([!+]{0,2})\s+"(.*)"\s*$')
MD_IN_HTML = re.compile(r"""^(\s*)<([a-zA-Z][\w-]*)([^>]*?)\s+markdown(?:=(["']?)(?:1|block|span|auto)\4)?(\s[^>]*)?>\s*$""")
HEADING_ATTRS = re.compile(r"^(\s{0,3}#{1,6}\s+.*?)\s*\{:?\s*([^{}]*)\}\s*$")
BLOCK_ATTRS = re.compile(r"^\s*\{:?\s*((?:[.#][\w-]+|[\w-]+=(?:\"[^\"]*\"|'[^']*'|\S+))(?:\s+(?:[.#][\w-]+|[\w-]+=(?:\"[^\"]*\"|'[^']*'|\S+)))*)\s*\}\s*$")
ABBR = re.compile(r"^\*\[([^\]]+)\]:\s*(.*)$")
DEF_LINE = re.compile(r"^(\s*):[ \t]{1,3}(.*)$")
SNIPPET_LINE = re.compile(r'^(\s*)(;?)--8<--\s+(["\'])(.+?)\3\s*$')
SNIPPET_BLOCK = re.compile(r"^(\s*)--8<--\s*$")
SNIPPET_SECTION = re.compile(r"--8<--\s*\[(start|end):([\w-]+)\]")
BLOCK_START = re.compile(r"^(\s*)(/{3,})\s*([\w-]+)\s*(?:\|\s*(.*?))?\s*$")
FANCY_ITEM = re.compile(r"^(\s{0,3})([a-zA-Z]|[ivxlcdmIVXLCDM]+|#)([.)])(\s{1,4})(\S.*)$")
BLOCK_ADMONITION_TYPES = {"note", "attention", "caution", "danger", "error", "tip", "hint", "warning", "important", "info", "success", "question", "failure", "bug", "example", "quote", "abstract", "admonition"}
ATTR_TOKEN = re.compile(r"""([.#])([\w-]+)|([\w-]+)=("[^"]*"|'[^']*'|[^\s"']+)|([\w-]+)""")
BODY_MARK = "@@VYASA_MKDOCS_BODY@@"


def _indent(line: str) -> int:
    return len(line.expandtabs(4)) - len(line.expandtabs(4).lstrip(" "))


def _collect_indented(lines: list[str], start: int, indent: int) -> tuple[list[str], int]:
    """Lines belonging to a block whose body is indented at least `indent`; trailing blanks stay outside."""
    body, i = [], start
    while i < len(lines) and (not lines[i].strip() or _indent(lines[i]) >= indent):
        body.append(lines[i].expandtabs(4))
        i += 1
    while body and not body[-1].strip():
        body.pop()
        i -= 1
    return body, i


def _dedent(lines: list[str], amount: int) -> list[str]:
    return [line[amount:] if line[:amount].strip() == "" else line.lstrip() for line in lines]


def parse_attrs(text: str) -> dict[str, str]:
    """attr_list body to HTML attributes.

    >>> parse_attrs('#top .a .b target=_blank data-x="1 2" download')
    {'id': 'top', 'class': 'a b', 'target': '_blank', 'data-x': '1 2', 'download': ''}
    """
    attrs: dict[str, str] = {}
    classes: list[str] = []
    for prefix, name, key, value, flag in ATTR_TOKEN.findall(text or ""):
        if prefix == "#":
            attrs["id"] = name
        elif prefix == ".":
            classes.append(name)
        elif key:
            attrs[key] = value.strip("\"'")
        elif flag:
            attrs[flag] = ""
    if classes:
        attrs = {**{k: v for k, v in attrs.items() if k == "id"}, "class": " ".join(classes), **{k: v for k, v in attrs.items() if k != "id"}}
    return attrs


def attrs_marker(text: str, target: str = "inline") -> str:
    """Inline placeholder the HTML postprocessor moves onto the preceding element."""
    payload = html.escape(json.dumps(parse_attrs(text)), quote=True)
    return f'<span class="vyasa-mkdocs-attrs" data-mkdocs-target="{target}" data-mkdocs-attrs="{payload}"></span>'


def _callout_shell(kind: str, title: str | None, fold: str | None) -> tuple[str, str]:
    from ..markdown.pipeline import _CALLOUT_ALIASES
    from ..markdown.renderer import _render_callout

    kind = _CALLOUT_ALIASES.get(kind.lower(), kind.lower())
    shell = _render_callout(kind, BODY_MARK, lambda body: body, title=title, fold=fold).replace("\n", " ")
    head, _, tail = shell.partition(BODY_MARK)
    return head, tail


def _shell_lines(prefix: str, head: str, body: list[str], tail: str) -> list[str]:
    return [prefix + head, "", *[(prefix + line) if line.strip() else "" for line in body], "", prefix + tail]


def fancy_list_type(marker: str) -> str:
    """HTML `<ol type>` for a fancylists marker.

    >>> [fancy_list_type(m) for m in ("#", "a", "B", "i", "IV", "c")]
    ['1', 'a', 'A', 'i', 'I', 'a']
    """
    if marker == "#":
        return "1"
    if len(marker) > 1 or marker.lower() == "i":
        return "i" if marker.islower() else "I"
    return "a" if marker.islower() else "A"


class Translator:
    """One translation pass; `extensions` is the normalised `markdown_extensions` map."""

    def __init__(self, extensions: dict[str, dict], *, config_dir: Path | None = None, docs_dir: Path | None = None):
        self.extensions = extensions
        self.config_dir = config_dir
        self.docs_dir = docs_dir
        self.abbreviations: dict[str, str] = {}

    def has(self, *names: str) -> bool:
        return any(name in self.extensions or f"markdown.extensions.{name}" in self.extensions for name in names)

    def has_blocks(self) -> bool:
        return any(name.startswith("pymdownx.blocks.") for name in self.extensions)

    # -- whole document -------------------------------------------------
    def translate(self, markdown: str) -> str:
        if self.has("pymdownx.snippets"):
            markdown = self.expand_snippets(markdown, depth=0)
            for extra in (self.extensions.get("pymdownx.snippets") or {}).get("auto_append") or []:
                included = self.read_snippet(str(extra))
                if included is not None:
                    markdown = f"{markdown}\n\n{included}"
        if self.has("pymdownx.arithmatex"):
            markdown = self.math_delimiters(markdown)
        lines = self.blocks(markdown.split("\n"))
        if self.has("nl2br"):
            lines = self.hard_breaks(lines)
        text = self.inline("\n".join(lines))
        if self.has("toc") and re.search(r"(?m)^\[TOC\][ \t]*$", text):
            text = self.toc_marker(text)
        if self.abbreviations:
            text += f"\n\n<!-- vyasa-mkdocs-abbr {html.escape(json.dumps(self.abbreviations), quote=False)} -->\n"
        return text

    @staticmethod
    def math_delimiters(markdown: str) -> str:
        """arithmatex `\\(..\\)`, `\\[..\\]`, and bare `\\begin{env}` blocks to Vyasa's `$` math.

        >>> Translator.math_delimiters(r"a \\(x\\) b")
        'a $x$ b'
        """
        fences: list[str] = []
        markdown = re.sub(r"(?ms)^(\s*)(`{3,}|~{3,}).*?^\s*\2`*\s*$", lambda m: fences.append(m.group(0)) or f"@@VYASA_MKDOCS_F{len(fences) - 1}@@", markdown)
        markdown = re.sub(r"\\\[(.+?)\\\]", lambda m: f"$${m.group(1)}$$", markdown, flags=re.DOTALL)
        markdown = re.sub(r"\\\((.+?)\\\)", lambda m: f"${m.group(1)}$", markdown)
        markdown = re.sub(r"(?ms)^(\\begin\{([a-z*]+)\}.*?\\end\{\2\})", r"$$\n\1\n$$", markdown)
        for index, fence in enumerate(fences):
            markdown = markdown.replace(f"@@VYASA_MKDOCS_F{index}@@", fence)
        return markdown

    @staticmethod
    def hard_breaks(lines: list[str]) -> list[str]:
        """nl2br: every newline inside a paragraph becomes a line break."""
        block_start = re.compile(r"^\s*([#>|<:*+-]|\d+[.)]|`{3,}|~{3,}|$)")
        out, in_fence = [], False
        for index, line in enumerate(lines):
            if FENCE_OPEN.match(line):
                in_fence = not in_fence
            following = lines[index + 1] if index + 1 < len(lines) else ""
            if not in_fence and line.strip() and not block_start.match(line) and following.strip() and not block_start.match(following) and _indent(line) < 4:
                line = line.rstrip() + "  "
            out.append(line)
        return out

    @staticmethod
    def toc_marker(text: str) -> str:
        """Python-Markdown `[TOC]`: a nested list of the page's headings."""
        from ...sections import markdown_headings

        headings = markdown_headings(text)
        if not headings:
            return re.sub(r"(?m)^\[TOC\][ \t]*$", "", text)
        top = min(level for level, _, _ in headings)
        items = "\n".join(f"{'    ' * (level - top)}- [{title}](#{anchor})" for level, title, anchor in headings)
        return re.sub(r"(?m)^\[TOC\][ \t]*$", lambda _: f'<div class="toc">\n\n{items}\n\n</div>', text)

    # -- snippets ---------------------------------------------------------
    def _snippet_bases(self) -> list[Path]:
        options = self.extensions.get("pymdownx.snippets") or {}
        raw = options.get("base_path", ["."])
        raw = [raw] if isinstance(raw, str) else list(raw or ["."])
        root = self.config_dir or Path.cwd()
        return [(root / str(base)).resolve() for base in raw]

    def read_snippet(self, spec: str) -> str | None:
        name, start, end, section = spec, None, None, None
        match = re.match(r"^(.*?)(?::(\d*)(?::(\d*))?)?$", spec)
        if match and match.group(2) is not None and not re.match(r"^[a-zA-Z]:[\\/]", spec):
            name, start, end = match.group(1), match.group(2), match.group(3)
        elif ":" in spec and not re.match(r"^[a-zA-Z]:[\\/]", spec):
            name, section = spec.rsplit(":", 1)
        if re.match(r"^https?://", name):
            return None
        restrict = (self.extensions.get("pymdownx.snippets") or {}).get("restrict_base_path", True)
        for base in self._snippet_bases():
            path = (base / name).resolve()
            if restrict and not path.is_relative_to(base):
                continue
            if path.is_file():
                text = path.read_text(encoding="utf-8")
                if section:
                    found = re.search(rf"--8<--\s*\[start:{re.escape(section)}\][^\n]*\n(.*?)\n[^\n]*--8<--\s*\[end:{re.escape(section)}\]", text, re.DOTALL)
                    text = textwrap.dedent(found.group(1)) if found else ""
                elif start is not None or end is not None:
                    file_lines = text.split("\n")
                    text = "\n".join(file_lines[int(start or 1) - 1:int(end) if end else None])
                return "\n".join(line for line in text.split("\n") if not SNIPPET_SECTION.search(line))
        return None

    def expand_snippets(self, markdown: str, depth: int) -> str:
        if depth > 8:
            return markdown
        out: list[str] = []
        lines = markdown.split("\n")
        i = 0
        while i < len(lines):
            line = lines[i]
            single = SNIPPET_LINE.match(line)
            if single:
                indent, escaped, _, spec = single.groups()
                if escaped:
                    out.append(line.replace(";--8<--", "--8<--", 1))
                else:
                    included = self.read_snippet(spec)
                    if included is not None:
                        out.extend(indent + l if l else l for l in self.expand_snippets(included, depth + 1).split("\n"))
                i += 1
                continue
            block = SNIPPET_BLOCK.match(line)
            if block:
                j = i + 1
                specs = []
                while j < len(lines) and not SNIPPET_BLOCK.match(lines[j]):
                    specs.append(lines[j].strip())
                    j += 1
                if j < len(lines):
                    for spec in specs:
                        included = self.read_snippet(spec) if spec and not spec.startswith(";") else None
                        if included is not None:
                            out.extend(block.group(1) + l if l else l for l in self.expand_snippets(included, depth + 1).split("\n"))
                    i = j + 1
                    continue
            out.append(line)
            i += 1
        return "\n".join(out)

    # -- blocks -----------------------------------------------------------
    def blocks(self, lines: list[str]) -> list[str]:
        out: list[str] = []
        i = 0
        while i < len(lines):
            line = lines[i]
            fence = FENCE_OPEN.match(line)
            if fence:
                i = self._copy_fence(lines, i, fence, out)
                continue
            handled = self._admonition(lines, i, out) if self.has("admonition", "pymdownx.details") else None
            handled = handled if handled is not None else (self._tabs(lines, i, out) if self.has("pymdownx.tabbed") else None)
            handled = handled if handled is not None else (self._md_in_html(lines, i, out) if self.has("md_in_html", "pymdownx.extra", "extra") else None)
            handled = handled if handled is not None else (self._def_list(lines, i, out) if self.has("def_list", "pymdownx.extra", "extra") else None)
            handled = handled if handled is not None else (self._generic_block(lines, i, out) if self.has_blocks() else None)
            handled = handled if handled is not None else (self._fancy_list(lines, i, out) if self.has("pymdownx.fancylists") else None)
            if handled is not None:
                i = handled
                continue
            if self.has("abbr", "pymdownx.extra", "extra"):
                abbr = ABBR.match(line)
                if abbr:
                    self.abbreviations[abbr.group(1)] = abbr.group(2).strip()
                    i += 1
                    continue
            if self.has("attr_list", "pymdownx.extra", "extra"):
                heading = HEADING_ATTRS.match(line)
                if heading and parse_attrs(heading.group(2)):
                    attrs = parse_attrs(heading.group(2))
                    out.append(f'{heading.group(1)} {{#{attrs["id"]}}}' if attrs.get("id") else heading.group(1))
                    i += 1
                    continue
                block_attrs = BLOCK_ATTRS.match(line)
                if block_attrs and out and out[-1].strip():
                    out[-1] = out[-1] + attrs_marker(block_attrs.group(1), "block")
                    i += 1
                    continue
            out.append(line)
            i += 1
        return out

    def _copy_fence(self, lines: list[str], i: int, fence, out: list[str]) -> int:
        indent, marker, info = fence.groups()
        out.append(f"{indent}{marker}{self.fence_info(info)}")
        j = i + 1
        closer = re.compile(rf"^\s*{re.escape(marker[0])}{{{len(marker)},}}\s*$")
        while j < len(lines):
            out.append(lines[j])
            if closer.match(lines[j]):
                return j + 1
            j += 1
        return j

    def fence_info(self, info: str) -> str:
        """superfences/highlight header to Vyasa's `lang title= hl=` form.

        >>> Translator({}).fence_info(' { .python title="a.py" hl_lines="2 4-5" linenums="1" }')
        'python title="a.py" hl=2,4-5'
        >>> Translator({}).fence_info('py title="x y"')
        'py title="x y"'
        """
        text = info.strip()
        braces = re.match(r"^([\w+#.-]*)\s*\{(.*)\}\s*$", text)
        lang, rest = (braces.group(1), braces.group(2)) if braces else (text.split(None, 1) + [""])[:2] if text else ("", "")
        if lang.startswith("."):
            rest, lang = f"{lang} {rest}", ""
        parts = [lang] if lang else []
        for prefix, name, key, value, flag in ATTR_TOKEN.findall(rest):
            if prefix == "." and not lang and name not in {"no-copy", "copy", "annotate", "select", "no-select"}:
                lang = name.removeprefix("language-")
                parts.insert(0, lang)
            elif key == "title":
                parts.append(f'title="{value.strip(chr(34) + chr(39))}"')
            elif key == "hl_lines":
                parts.append("hl=" + ",".join(value.strip("\"'").split()))
            elif key and key not in {"linenums", "anchor_linenums"}:
                parts.append(f"{key}={value}")
            elif flag and not key and not prefix:
                parts.append(flag)
        return " ".join(parts) if (braces or parts != [text]) else text

    def _admonition(self, lines: list[str], i: int, out: list[str]) -> int | None:
        match = ADMONITION.match(lines[i])
        if not match:
            return None
        indent, marker, kind, _classes, title = match.groups()
        if marker == "!!!" and not self.has("admonition"):
            return None
        if marker != "!!!" and not self.has("pymdownx.details"):
            return None
        base = _indent(lines[i])
        body, end = _collect_indented(lines, i + 1, base + 4)
        fold = None if marker == "!!!" else ("+" if marker.endswith("+") else "-")
        head, tail = _callout_shell(kind, title if title else (None if title is None else kind.title()), fold)
        translated = self.blocks(_dedent(body, base + 4))
        out.extend(_shell_lines(" " * base, head, translated, tail) if translated else [" " * base + head.replace('vyasa-callout-head-with-body', '') + tail])
        return end

    def _tabs(self, lines: list[str], i: int, out: list[str]) -> int | None:
        first = TAB.match(lines[i])
        if not first:
            return None
        base = _indent(lines[i])
        tabs, j, active = [], i, 0
        while j < len(lines):
            match = TAB.match(lines[j])
            if not match or _indent(lines[j]) != base or (tabs and "!" in match.group(2)):
                break
            body, j = _collect_indented(lines, j + 1, base + 4)
            if "+" in match.group(2):
                active = len(tabs)
            tabs.append((match.group(3), self.blocks(_dedent(body, base + 4))))
            k = j
            while k < len(lines) and not lines[k].strip():
                k += 1
            next_tab = TAB.match(lines[k]) if k < len(lines) else None
            if not next_tab or _indent(lines[k]) != base or "!" in next_tab.group(2):
                break
            j = k
        from ..tabs.render import render_tabs_html

        tab_id = hashlib.md5("\n".join(lines[i:j]).encode()).hexdigest()[:8]
        marks = [f"@@VYASA_MKDOCS_TAB_{n}@@" for n in range(len(tabs))]
        shell = render_tabs_html(tab_id, [html.escape(title) for title, _ in tabs], marks, active=active)
        prefix = " " * base
        for line in shell.split("\n"):
            mark = next((m for m in marks if m in line), None)
            if mark is None:
                out.append(prefix + line)
                continue
            head, _, tail = line.partition(mark)
            body = tabs[marks.index(mark)][1]
            out.extend([prefix + head, "", *[(prefix + l) if l.strip() else "" for l in body], "", prefix + tail])
        return j

    def _block_extent(self, lines: list[str], i: int) -> tuple[re.Match, dict, list[str], int] | None:
        """Header match, YAML options, body lines, and next index of a `/// name | arg` block."""
        import yaml

        start = BLOCK_START.match(lines[i])
        if not start:
            return None
        slashes = start.group(2)
        j, option_lines = i + 1, []
        while j < len(lines) and lines[j].strip() and _indent(lines[j]) >= _indent(lines[i]) + 4:
            option_lines.append(lines[j])
            j += 1
        end_re = re.compile(rf"^\s*{re.escape(slashes)}\s*$")
        k = j
        while k < len(lines) and not end_re.match(lines[k]):
            k += 1
        if k >= len(lines):
            return None
        try:
            options = yaml.safe_load(textwrap.dedent("\n".join(option_lines))) if option_lines else {}
        except yaml.YAMLError:
            options = {}
        return start, options if isinstance(options, dict) else {}, lines[j:k], k + 1

    def _generic_block(self, lines: list[str], i: int, out: list[str]) -> int | None:
        """pymdownx.blocks: admonition, details, tab, html, define, caption."""
        extent = self._block_extent(lines, i)
        if not extent:
            return None
        start, options, body, end = extent
        name, argument = start.group(3).lower(), (start.group(4) or "").strip()
        prefix = start.group(1)
        if name == "tab":
            return self._block_tabs(lines, i, out)
        translated = self.blocks(textwrap.dedent("\n".join(body)).split("\n"))
        if name in BLOCK_ADMONITION_TYPES or name == "details":
            kind = str(options.get("type") or ("note" if name in {"admonition", "details"} else name))
            fold = ("+" if options.get("open") else "-") if name == "details" else None
            head, tail = _callout_shell(kind, argument or None, fold)
            out.extend(_shell_lines(prefix, head, translated, tail))
            return end
        if name == "html":
            tag_match = re.match(r"^([\w-]+)((?:[.#][\w-]+)*)((?:\[[^\]]*\])*)$", argument or "div")
            tag = tag_match.group(1) if tag_match else "div"
            attrs = parse_attrs(" ".join(re.findall(r"[.#][\w-]+", tag_match.group(2))) + " " + " ".join(re.findall(r"\[([^\]]*)\]", tag_match.group(3)))) if tag_match else {}
            rendered = "".join(f' {k}="{html.escape(v)}"' for k, v in attrs.items())
            out.extend([f"{prefix}<{tag}{rendered}>", "", *translated, "", f"{prefix}</{tag}>"])
            return end
        if name == "define":
            terms, definitions = [], []
            for line in translated:
                item = re.match(r"^\s*[-*+]\s+(.*)$", line)
                if item:
                    definitions.append(item.group(1))
                elif line.strip() and not definitions:
                    terms.append(line.strip())
            out.extend([f'{prefix}<dl class="vyasa-mkdocs-dl">', *[x for t in terms for x in ("<dt>", "", t, "", "</dt>")], *[x for d in definitions for x in ("<dd>", "", d, "", "</dd>")], f"{prefix}</dl>"])
            return end
        if name in {"caption", "figure-caption", "table-caption"}:
            out.extend([f'{prefix}<div class="vyasa-mkdocs-caption">', "", *translated, "", f"{prefix}</div>"])
            return end
        return None

    def _block_tabs(self, lines: list[str], i: int, out: list[str]) -> int:
        from ..tabs.render import render_tabs_html

        tabs, j, active = [], i, 0
        while j < len(lines):
            extent = self._block_extent(lines, j)
            if not extent or extent[0].group(3).lower() != "tab" or (tabs and extent[1].get("new")):
                break
            start, options, body, j = extent
            if options.get("select"):
                active = len(tabs)
            tabs.append(((start.group(4) or "").strip(), self.blocks(textwrap.dedent("\n".join(body)).split("\n"))))
            k = j
            while k < len(lines) and not lines[k].strip():
                k += 1
            if k >= len(lines) or not BLOCK_START.match(lines[k]):
                break
            j = k
        tab_id = hashlib.md5("\n".join(lines[i:j]).encode()).hexdigest()[:8]
        marks = [f"@@VYASA_MKDOCS_TAB_{n}@@" for n in range(len(tabs))]
        for line in render_tabs_html(tab_id, [html.escape(t) for t, _ in tabs], marks, active=active).split("\n"):
            mark = next((m for m in marks if m in line), None)
            if mark is None:
                out.append(line)
                continue
            head, _, tail = line.partition(mark)
            out.extend([head, "", *tabs[marks.index(mark)][1], "", tail])
        return j

    def _fancy_list(self, lines: list[str], i: int, out: list[str]) -> int | None:
        """pymdownx.fancylists: `a)`, `i.`, `A.` lists become `<ol type=...>`."""
        first = FANCY_ITEM.match(lines[i])
        if not first or first.group(2).isdigit() or (out and out[-1].strip() and not out[-1].strip().startswith("</")):
            return None
        marker = first.group(2)
        if marker.isupper() and len(marker) == 1 and first.group(3) == "." and len(first.group(4)) < 2:
            return None  # pymdownx needs two spaces after `A.` so sentences are not lists
        kind = fancy_list_type(marker)
        items, j = [], i
        while j < len(lines):
            item = FANCY_ITEM.match(lines[j])
            if not item or item.group(3) != first.group(3):
                break
            body, j = _collect_indented(lines, j + 1, len(item.group(1)) + len(item.group(2)) + 1 + len(item.group(4)))
            items.append([item.group(5), *_dedent(body, len(item.group(1)) + len(item.group(2)) + 1 + len(item.group(4)))])
            k = j
            while k < len(lines) and not lines[k].strip():
                k += 1
            following = FANCY_ITEM.match(lines[k]) if k < len(lines) else None
            if following and following.group(3) == first.group(3) and fancy_list_type(following.group(2)) in {kind, kind.lower() if kind in {"I", "A"} else kind}:
                j = k
                continue
            break
        start = "" if marker in {"a", "A", "i", "I", "#"} else f' start="{self._fancy_start(marker, kind)}"'
        out.append(f'<ol type="{kind}"{start}>')
        for item in items:
            out.extend(["<li>", "", *self.blocks(item), "", "</li>"])
        out.append("</ol>")
        return j

    @staticmethod
    def _fancy_start(marker: str, kind: str) -> int:
        if kind in {"a", "A"}:
            return ord(marker.lower()) - ord("a") + 1
        values = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100, "d": 500, "m": 1000}
        total, previous = 0, 0
        for char in reversed(marker.lower()):
            value = values.get(char, 0)
            total, previous = (total - value, previous) if value < previous else (total + value, value)
        return total or 1

    def _md_in_html(self, lines: list[str], i: int, out: list[str]) -> int | None:
        match = MD_IN_HTML.match(lines[i])
        if not match:
            return None
        indent, tag, before, _, after = match.groups()
        open_re = re.compile(rf"<{tag}\b", re.IGNORECASE)
        close_re = re.compile(rf"</{tag}\s*>", re.IGNORECASE)
        depth, j = 1, i + 1
        while j < len(lines):
            depth += len(open_re.findall(lines[j])) - len(close_re.findall(lines[j]))
            if depth <= 0:
                break
            j += 1
        if j >= len(lines):
            return None
        inner = textwrap.dedent("\n".join(lines[i + 1:j])).split("\n")
        closing = lines[j]
        out.extend([f"{indent}<{tag}{before}{after or ''}>", "", *self.blocks(inner), "", closing])
        return j + 1

    def _def_list(self, lines: list[str], i: int, out: list[str]) -> int | None:
        line = lines[i]
        if not line.strip() or line.startswith((" ", "\t", "#", ">", "-", "*", "+", "|", "<", ":")) or (out and out[-1].strip()):
            return None
        nxt = i + 1 if i + 1 < len(lines) and DEF_LINE.match(lines[i + 1]) else None
        if nxt is None:
            return None
        items: list[tuple[str, list[list[str]]]] = []
        j = i
        while j < len(lines) and lines[j].strip() and not DEF_LINE.match(lines[j]) and j + 1 < len(lines) and DEF_LINE.match(lines[j + 1]):
            term, definitions = lines[j].strip(), []
            j += 1
            while j < len(lines) and (definition := DEF_LINE.match(lines[j])):
                first = definition.group(2)
                body, j = _collect_indented(lines, j + 1, 4)
                definitions.append([first, *_dedent(body, 4)])
                k = j
                while k < len(lines) and not lines[k].strip():
                    k += 1
                if k < len(lines) and DEF_LINE.match(lines[k]):
                    j = k
            items.append((term, definitions))
            k = j
            while k < len(lines) and not lines[k].strip():
                k += 1
            if k + 1 < len(lines) and lines[k].strip() and DEF_LINE.match(lines[k + 1]) and not lines[k].startswith((" ", "\t")):
                j = k
                continue
            break
        out.append('<dl class="vyasa-mkdocs-dl">')
        for term, definitions in items:
            out.extend(["<dt>", "", term, "", "</dt>"])
            for definition in definitions:
                out.extend(["<dd>", "", *self.blocks(definition), "", "</dd>"])
        out.append("</dl>")
        return j

    # -- inline -----------------------------------------------------------
    def inline(self, text: str) -> str:
        protected: list[str] = []

        def protect(match):
            protected.append(match.group(0))
            return f"@@VYASA_MKDOCS_P{len(protected) - 1}@@"

        text = re.sub(r"(?ms)^(\s*)(`{3,}|~{3,}).*?^\s*\2`*\s*$", protect, text)
        text = re.sub(r"<!--.*?-->", protect, text, flags=re.DOTALL)
        text = re.sub(r"</?[a-zA-Z][^>\n]*>", protect, text)
        text = re.sub(r"(`+)(.+?)\1", lambda m: protect(m) if not self.has("pymdownx.inlinehilite") else (protected.append(self._inline_code(m)) or f"@@VYASA_MKDOCS_P{len(protected) - 1}@@"), text)
        if self.has("pymdownx.emoji"):
            text = re.sub(r":([a-z0-9_+-]+):(\{[^}\n]*\})?", self._emoji, text)
        if self.has("attr_list", "pymdownx.extra", "extra"):
            text = re.sub(r"(!?\[[^\]\n]*(?:\[[^\]\n]*\][^\]\n]*)*\]\([^)\s]*(?:\s+\"[^\"]*\")?\))\{:?\s*([^{}\n]*)\}", lambda m: m.group(1) + attrs_marker(m.group(2)), text)
        if self.has("pymdownx.critic"):
            text = re.sub(r"\{~~(.+?)~>(.+?)~~\}", r'<del class="critic">\1</del><ins class="critic">\2</ins>', text, flags=re.DOTALL)
            text = re.sub(r"\{\+\+(.+?)\+\+\}", r'<ins class="critic">\1</ins>', text, flags=re.DOTALL)
            text = re.sub(r"\{--(.+?)--\}", r'<del class="critic">\1</del>', text, flags=re.DOTALL)
            text = re.sub(r"\{==(.+?)==\}", r'<mark class="critic">\1</mark>', text, flags=re.DOTALL)
            text = re.sub(r"\{>>(.+?)<<\}", r'<span class="critic comment">\1</span>', text, flags=re.DOTALL)
        if self.has("pymdownx.keys"):
            text = re.sub(r"\+\+((?:[\w\"'-]+)(?:\+[\w\"'-]+)*)\+\+", self._keys, text)
        if self.has("pymdownx.caret"):
            text = re.sub(r"\^\^(?=\S)(.+?)(?<=\S)\^\^", r"<ins>\1</ins>", text)
            text = re.sub(r"(?<=\w)\^([A-Za-z0-9.+-]{1,32})\^", r"<sup>\1</sup>", text)
        if self.has("pymdownx.tilde"):
            text = re.sub(r"(?<=\w)~([A-Za-z0-9.+-]{1,32})~(?!~)", r"<sub>\1</sub>", text)
        if self.has("pymdownx.progressbar"):
            text = re.sub(r'\[=\s*(\d+(?:\.\d+)?%|\d+(?:\.\d+)?/\d+(?:\.\d+)?)(?:\s+"([^"]*)")?\s*\](\{[^}\n]*\})?', self._progress, text)
        if self.has("smarty"):
            text = "\n".join(line if re.fullmatch(r"[\s|:+*=-]*", line) else re.sub(r"(?<![-<!])--(?![->])", "&ndash;", re.sub(r"(?<![-<!])---(?![->])", "&mdash;", line)) for line in text.split("\n"))
            text = re.sub(r"(?<=\S)\.\.\.(?!\.)", "&hellip;", text)
        if self.has("pymdownx.magiclink"):
            text = re.sub(r"(?<![<(\[\"'=/\w])(https?://[^\s<>()\[\]]*[^\s<>()\[\].,;:!?'\"])", r"<\1>", text)
        if self.has("pymdownx.smartsymbols"):
            for pattern, symbol in ((r"\(tm\)", "&trade;"), (r"\(c\)", "&copy;"), (r"\(r\)", "&reg;"), (r"(?<![\w/])c/o(?![\w/])", "&#8453;"), (r"\+/-", "&plusmn;"), (r"<-->", "&harr;"), (r"(?<!-)-->", "&rarr;"), (r"<--(?!-)", "&larr;"), (r"=/=", "&ne;"), (r"(?<![\d/])1/2(?![\d/])", "&frac12;"), (r"(?<![\d/])1/4(?![\d/])", "&frac14;"), (r"(?<![\d/])3/4(?![\d/])", "&frac34;")):
                text = re.sub(pattern, symbol, text)
            text = re.sub(r"\b(\d+)(st|nd|rd|th)\b", r"\1<sup>\2</sup>", text)
        for index in range(len(protected) - 1, -1, -1):
            text = text.replace(f"@@VYASA_MKDOCS_P{index}@@", protected[index])
        return text

    def _inline_code(self, match) -> str:
        ticks, code = match.group(1), match.group(2)
        hilite = re.match(r"^\s?(?:#!|:::)([\w+#.-]+)\s+(.*?)\s?$", code)
        return f"{ticks}{hilite.group(2)}{ticks}" if hilite else match.group(0)

    def _emoji(self, match) -> str:
        from .icons import emoji_html, icon_html

        name, attrs = match.group(1), match.group(2)
        rendered = icon_html(name, parse_attrs(attrs[1:-1]) if attrs else {}) or emoji_html(name)
        return rendered if rendered else match.group(0)

    def _keys(self, match) -> str:
        from .icons import key_label

        keys = match.group(1).split("+")
        return '<span class="keys">' + "<span>+</span>".join(f"<kbd>{html.escape(key_label(key))}</kbd>" for key in keys) + "</span>"

    def _progress(self, match) -> str:
        value, label, attrs = match.groups()
        if value.endswith("%"):
            percent = float(value[:-1])
        else:
            numerator, denominator = value.split("/")
            percent = float(numerator) / float(denominator) * 100 if float(denominator) else 0.0
        percent = max(0.0, min(100.0, percent))
        extra = parse_attrs(attrs[1:-1]).get("class", "") if attrs else ""
        level = int(percent // 20) * 20
        label_html = f'<span class="progress-label">{html.escape(label)}</span>' if label is not None else ""
        cls = f"progress progress-{level}plus {extra}".strip()
        return f'<span class="{cls}"><span class="progress-bar" style="width:{percent:.2f}%">{label_html}</span></span>'
