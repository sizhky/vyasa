import re


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
