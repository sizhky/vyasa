import hashlib
import re
from pathlib import Path

_CALLOUT_ALIASES = {
    "note": "note", "abstract": "abstract", "summary": "abstract", "tldr": "abstract", "info": "info",
    "todo": "todo", "tip": "tip", "hint": "tip", "important": "tip",
    "success": "success", "check": "success", "done": "success", "question": "question",
    "help": "question", "faq": "question", "warning": "warning", "warn": "warning",
    "caution": "warning", "attention": "warning", "failure": "failure", "fail": "failure",
    "missing": "failure", "danger": "danger", "error": "danger", "bug": "bug",
    "example": "example", "quote": "quote", "cite": "quote", "note": "note",
}


def _placeholder_id(text):
    return hashlib.md5(text.encode()).hexdigest()[:8]


def _strip_one_blockquote_level(text):
    return "\n".join(
        re.sub(r"^\s{0,3}>\s?", "", line) if line.strip() else line
        for line in text.splitlines()
    )


def preprocess_super_sub(content):
    protected = []
    def protect(pattern, text, flags=0):
        regex = re.compile(pattern, flags)
        return regex.sub(lambda m: protected.append(m.group(0)) or f"@@VYASA_PROTECT_{len(protected)-1}@@", text)
    content = protect(r"(```+|~~~+)[\s\S]*?\1", content, re.MULTILINE)
    content = protect(r"(`+)([^`]*?)\1", content)
    content = protect(r"\$\$[\s\S]*?\$\$", content, re.MULTILINE)
    content = protect(r"\$(?:\\.|[^$\n])+\$", content)
    content = protect(r"\\\[[\s\S]*?\\\]", content, re.MULTILINE)
    content = protect(r"\\\((?:\\.|[^\\)])*\\\)", content)
    content = re.sub(r"(?<![\\\w$])\^([A-Za-z0-9.+\-]{1,32})\^(?![\w$])", r"<sup>\1</sup>", content)
    content = re.sub(r"(?<![~\\\w$])~([A-Za-z0-9.+\-]{1,32})~(?![~\w$])", r"<sub>\1</sub>", content)
    for i, chunk in enumerate(protected):
        content = content.replace(f"@@VYASA_PROTECT_{i}@@", chunk)
    return content


def extract_footnotes(content):
    pat = re.compile(r"^\[\^([^\]]+)\]:\s*(.+?)(?=(?:^|\n)\[\^|\n\n|\Z)", re.MULTILINE | re.DOTALL)
    defs = {m.group(1): m.group(2).strip() for m in pat.finditer(content)}
    for m in pat.finditer(content):
        content = content.replace(m.group(0), "", 1)
    return content.strip(), defs


def preserve_newlines(md):
    protected = []
    def protect(pattern, text, flags=0):
        regex = re.compile(pattern, flags)
        return regex.sub(lambda m: protected.append(m.group(0)) or f"__VYASA_BLOCK_{len(protected)-1}__", text)
    md = protect(r"(```+|~~~+)[\s\S]*?\1", md, re.MULTILINE)
    md = protect(r"\$\$[\s\S]*?\$\$", md, re.MULTILINE)
    md = protect(r"\\\[[\s\S]*?\\\]", md, re.MULTILINE)
    md = re.sub(r"(?<!\n)\n(?!\n)", "  \n", md)
    for i, block in enumerate(protected):
        md = md.replace(f"__VYASA_BLOCK_{i}__", block)
    return md


def preprocess_callouts(content):
    callout_store = {}
    protected = []
    content = re.sub(r"(```+|~~~+)[\s\S]*?\1", lambda m: protected.append(m.group(0)) or f"@@VYASA_CALLOUT_BLOCK_{len(protected)-1}@@", content, flags=re.MULTILINE)
    pattern = re.compile(r"^///\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*\n(.*?)^///\s*$", re.MULTILINE | re.DOTALL)
    obsidian_header = re.compile(r"^(\s{0,3}(?:>\s*)+)\[!([A-Za-z][A-Za-z0-9_-]*)\]([+-])?\s*(.*)$")
    quote_line = re.compile(r"^(\s{0,3}(?:>\s*)+)(.*)$")

    def replace(match):
        kind = _CALLOUT_ALIASES.get(match.group(1).strip().lower(), match.group(1).strip().lower())
        body = match.group(2).strip()
        if not body:
            return match.group(0)
        callout_id = _placeholder_id(match.group(0))
        callout_store[callout_id] = {"kind": kind, "body": body, "title": None, "fold": None}
        return f'\n\n<div class="vyasa-callout-placeholder" data-callout-id="{callout_id}"></div>\n\n'

    content = pattern.sub(replace, content)
    lines, out, i = content.splitlines(), [], 0
    while i < len(lines):
        header = obsidian_header.match(lines[i])
        if not header:
            out.append(lines[i]); i += 1; continue
        depth = header.group(1).count(">")
        body, i = [], i + 1
        while i < len(lines):
            if not lines[i].strip():
                body.append("")
                i += 1
                continue
            quoted = quote_line.match(lines[i])
            if not quoted:
                break
            line_depth = quoted.group(1).count(">")
            if line_depth < depth:
                break
            if line_depth == depth and obsidian_header.match(lines[i]):
                break
            body.append(lines[i].split(">", 1)[1].lstrip() if line_depth == depth else quoted.group(0).split(">", 1)[1].lstrip())
            i += 1
        callout_id = _placeholder_id("\n".join([lines[i - len(body) - 1], *body]))
        callout_store[callout_id] = {"kind": _CALLOUT_ALIASES.get(header.group(2).lower(), header.group(2).lower()), "body": "\n".join(body).strip(), "title": header.group(4).strip() or None, "fold": header.group(3) or None}
        out.extend(["", f'<div class="vyasa-callout-placeholder" data-callout-id="{callout_id}"></div>', ""])
    content = "\n".join(out)
    for item in callout_store.values():
        for i, block in enumerate(protected):
            item["body"] = item["body"].replace(
                f"@@VYASA_CALLOUT_BLOCK_{i}@@", _strip_one_blockquote_level(block)
            )
    for i, block in enumerate(protected):
        content = content.replace(f"@@VYASA_CALLOUT_BLOCK_{i}@@", block)
    return content, callout_store


def preprocess_code_includes(content, current_path=None, root_folder=None):
    protected = []
    def protect(match):
        protected.append(match.group(0))
        return f"@@VYASA_CODE_BLOCK_{len(protected)-1}@@"

    include_store = {}
    pattern = re.compile(r"^[ \t]*\{\*\s+(.+?)\s+\*\}[ \t]*$", re.MULTILINE)
    base_dir = (Path(root_folder) / Path(current_path).parent) if current_path and root_folder else None
    content = re.sub(r"(```+|~~~+)[\s\S]*?\1", protect, content, flags=re.MULTILINE)

    def replace(match):
        spec = match.group(1).strip()
        path_text = spec.split()[0]
        file_path = (base_dir / path_text).resolve() if base_dir else Path(path_text).resolve()
        include_id = _placeholder_id(match.group(0))
        include_store[include_id] = {"spec": spec, "path_text": path_text, "file_path": file_path}
        return f'<div class="vyasa-code-include-placeholder" data-include-id="{include_id}"></div>'

    content = pattern.sub(replace, content)
    for i, block in enumerate(protected):
        content = content.replace(f"@@VYASA_CODE_BLOCK_{i}@@", block)
    return content, include_store
