from __future__ import annotations

import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "vyasa-map.json"
OUTPUT = ROOT / "vyasa-map.cytree"


def split_url(url: str) -> tuple[str, str]:
    base, sep, fragment = url.partition("#")
    return base, f"#{fragment}" if sep else ""


def marker_for_state(state: str) -> str:
    if state == "explored":
        return "! "
    if state == "frontier":
        return "* "
    return ""


def choose_base(child_ids: list[str], nodes: dict[str, dict], inherited_url: str | None) -> str | None:
    bases = [split_url(nodes[child_id]["url"])[0] for child_id in child_ids if nodes[child_id].get("url")]
    if not bases:
        return None
    base, count = Counter(bases).most_common(1)[0]
    inherited_base = split_url(inherited_url)[0] if inherited_url else None
    if count < 2 or base == inherited_base:
        return None
    return base


def compress_url(url: str, block_base: str | None, inherited_url: str | None) -> str:
    url_base, url_fragment = split_url(url)
    inherited_base = split_url(inherited_url)[0] if inherited_url else None
    active_base = block_base or inherited_base
    if active_base and url_base == active_base:
        return "=" if not url_fragment else url_fragment
    return url


def main() -> None:
    data = json.loads(INPUT.read_text())
    nodes = {node["id"]: node for node in data["nodes"]}
    children: dict[str, list[str]] = {node_id: [] for node_id in nodes}
    for edge in data["edges"]:
        children.setdefault(edge["source"], []).append(edge["target"])

    lines = [
        "# Compact Cytograph tree source",
        "# indent = parent/child",
        "# ids are derived from the full label path",
        "# state markers: ! explored, * frontier, blank unexplored",
        "# @base <path> sets the URL base for following sibling lines in the same block",
        "# url forms: -> full path, -> #fragment (same base as nearest ancestor/base), -> = (same base, no fragment)",
        "",
    ]

    def visit(node_id: str, depth: int, inherited_url: str | None) -> None:
        node = nodes[node_id]
        label = node.get("label", node_id)
        line = f'{"  " * depth}{marker_for_state(node.get("state", ""))}{label}'
        node_url = node.get("url")
        if node_url:
            line += f" -> {compress_url(node_url, None, inherited_url)}"
            inherited_url = node_url
        lines.append(line)
        visit_children(node_id, depth, inherited_url)

    def visit_children(node_id: str, depth: int, inherited_url: str | None) -> None:
        child_ids = children.get(node_id, [])
        if not child_ids:
            return
        block_base = choose_base(child_ids, nodes, inherited_url)
        if block_base:
            lines.append(f'{"  " * (depth + 1)}@base {block_base}')
        for child_id in child_ids:
            child = nodes[child_id]
            child_label = child.get("label", child_id)
            child_line = f'{"  " * (depth + 1)}{marker_for_state(child.get("state", ""))}{child_label}'
            child_url = child.get("url")
            child_inherited = inherited_url
            if child_url:
                child_line += f" -> {compress_url(child_url, block_base, inherited_url)}"
                child_inherited = child_url
            lines.append(child_line)
            visit_children(child_id, depth + 1, child_inherited)

    visit("root", 0, None)
    OUTPUT.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
