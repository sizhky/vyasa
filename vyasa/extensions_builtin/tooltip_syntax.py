import re
from textwrap import indent


def extract_tooltips(content: str) -> tuple[str, dict[str, str]]:
    """Remove `[?id]:` blocks and return their de-indented Markdown."""
    lines = content.splitlines()
    output: list[str] = []
    tooltips: dict[str, str] = {}
    index = 0
    fence: tuple[str, int] | None = None
    while index < len(lines):
        fence_marker = re.match(r"^\s{0,3}(`{3,}|~{3,})", lines[index])
        if fence:
            output.append(lines[index])
            if fence_marker and fence_marker.group(1)[0] == fence[0] and len(fence_marker.group(1)) >= fence[1]:
                fence = None
            index += 1
            continue
        if fence_marker:
            marker = fence_marker.group(1)
            fence = (marker[0], len(marker))
            output.append(lines[index])
            index += 1
            continue
        header = re.match(r"^\[\?([^\]]+)\]:[ \t]*(.*)$", lines[index])
        if not header:
            output.append(lines[index])
            index += 1
            continue
        body = [header.group(2)] if header.group(2) else []
        index += 1
        while index < len(lines):
            line = lines[index]
            if not line.strip():
                body.append("")
                index += 1
                continue
            continuation = re.match(r"^(?: {4}|\t)(.*)$", line)
            if not continuation:
                break
            body.append(continuation.group(1))
            index += 1
        tooltips[header.group(1)] = "\n".join(body).strip()
    return "\n".join(output).strip(), tooltips


def format_tooltip_definitions(tooltips: dict[str, str]) -> str:
    return "\n\n".join(
        f"[?{target}]:\n{indent(content, '    ')}"
        for target, content in tooltips.items()
    )
