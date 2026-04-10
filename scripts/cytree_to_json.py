from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "vyasa-map.cytree"
OUTPUT = ROOT / "vyasa-map.from-cytree.json"


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "node"


def parse_node_line(raw: str) -> tuple[int, str, str, str | None]:
    indent = len(raw) - len(raw.lstrip(" "))
    depth = indent // 2
    text = raw.strip()
    state = "unexplored"
    if text.startswith("! "):
        state = "explored"
        text = text[2:]
    elif text.startswith("* "):
        state = "frontier"
        text = text[2:]
    label, _, target = text.partition(" -> ")
    return depth, state, label.strip(), target.strip() or None


def resolve_target(target: str, block_base: str | None, inherited_url: str | None) -> str:
    inherited_base = inherited_url.split("#", 1)[0] if inherited_url else None
    active_base = block_base or inherited_base
    if target == "=":
        if not active_base:
            raise ValueError("'=' requires a block base or inherited URL")
        return active_base
    if target.startswith("#"):
        if not active_base:
            raise ValueError("'#fragment' requires a block base or inherited URL")
        return f"{active_base}{target}"
    return target


def main() -> None:
    nodes = []
    edges = []
    node_stack: list[tuple[int, str, str | None, tuple[str, ...]]] = []
    base_stack: dict[int, str] = {}

    for raw in INPUT.read_text().splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        depth = indent // 2

        if raw.strip().startswith("@base "):
            base_stack[depth] = raw.strip()[6:].strip()
            continue

        for key in list(base_stack):
            if key > depth:
                del base_stack[key]

        depth, state, label, target = parse_node_line(raw)
        while node_stack and node_stack[-1][0] >= depth:
            node_stack.pop()

        parent_id = node_stack[-1][1] if node_stack else None
        inherited_url = node_stack[-1][2] if node_stack else None
        block_base = base_stack.get(depth)
        path = (*node_stack[-1][3], slugify(label)) if node_stack else (slugify(label),)
        node_id = "__".join(path)
        url = resolve_target(target, block_base, inherited_url) if target else None

        node = {"id": node_id, "label": label}
        if state != "unexplored":
            node["state"] = state
        if url:
            node["url"] = url
        nodes.append(node)
        if parent_id:
            edges.append({"source": parent_id, "target": node_id})
        node_stack.append((depth, node_id, url or inherited_url, path))

    OUTPUT.write_text(json.dumps({"nodes": nodes, "edges": edges}, indent=2) + "\n")


if __name__ == "__main__":
    main()
