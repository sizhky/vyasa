from __future__ import annotations

from ...helpers import content_url_for_slug
from ...markdown_fence import split_fence_frontmatter


def clean_scalar(value):
    text = str(value or "").strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {'"', "'"}:
        return text[1:-1]
    if text.isdigit():
        return int(text)
    return text


def resolve_fence_source(current_path, source):
    source_text = str(source or "").strip()
    if not source_text:
        return ""
    if source_text.startswith(("/", "http://", "https://")):
        return source_text
    if current_path:
        from pathlib import Path
        base = Path(current_path).parent
        rel = (base / source_text).as_posix() if str(base) != "." else source_text
    else:
        rel = source_text
    return content_url_for_slug(rel, prefix="/download")


def parse_cytograph_body(body):
    try:
        lines = body.splitlines()
        graph = {"nodes": [], "edges": []}
        section = None
        current = None
        for raw in lines:
            if not raw.strip():
                continue
            stripped = raw.strip()
            if not raw.startswith(" "):
                if stripped == "nodes:":
                    section = "nodes"
                    current = None
                    continue
                if stripped == "edges:":
                    section = "edges"
                    current = None
                    continue
                if stripped.endswith(": []"):
                    name = stripped.split(":", 1)[0]
                    if name in graph:
                        graph[name] = []
                        section = name
                        current = None
                        continue
                raise ValueError("invalid top-level graph line")
            if section is None:
                raise ValueError("graph item outside section")
            line = stripped
            if line.startswith("- "):
                current = {}
                graph[section].append(current)
                line = line[2:].strip()
                if line:
                    key, value = line.split(":", 1)
                    current[key.strip()] = clean_scalar(value)
                continue
            if current is None or ":" not in line:
                raise ValueError("invalid graph mapping line")
            key, value = line.split(":", 1)
            current[key.strip()] = clean_scalar(value)
        return graph
    except Exception:
        return {"nodes": [], "edges": []}
