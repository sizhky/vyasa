#!/usr/bin/env python3
"""Validate a Vyasa KG Pack sidecar for referential integrity.

Catches the failure mode where an edge or an attr assignment points at a node id
that was never defined (or an edge id that does not exist), and where the schema
references source files that are missing. These are the mistakes that make a KG
silently render empty or drop nodes.

Usage:
    validate_kg_pack.py <path>

<path> may be either:
  - a KG Pack directory ending in `.kg` (e.g. foo-mom.kg/), or
  - a MOM markdown file (e.g. foo-mom.md); the pack dir `foo-mom.kg/` is inferred
    and the `items` fence is checked to point at the pack's schema.

Exit code 0 = clean. Non-zero = at least one error. Warnings never fail the run.
"""
import json
import re
import sys
from pathlib import Path

NODE_ID = re.compile(r"^(\S+):")           # `n1: Label`
NODE_ID_BARE = re.compile(r"^(\S+)\s")      # `n1 Label key=val`
CHILD_NODE = re.compile(r"^([^\s=]+):(?:\s|$)")  # indented `id: Label`; excludes `key=value` attrs
EDGE_LINE = re.compile(r"^(\S+):\s+(\S+)\s*->\s*(\S+)\s+(\S+)")


def parse_nodes(path):
    ids = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("@"):
            continue
        if line[:1].isspace():
            # indented: either a child node (`id: Label`) or an attr (`key=value`)
            m = CHILD_NODE.match(s)
            if m:
                ids.add(m.group(1))
            continue
        m = NODE_ID.match(line) or NODE_ID_BARE.match(line)
        if m:
            ids.add(m.group(1))
    return ids


def parse_edges(path):
    """Return (edge_ids, list of (edge_id, src, tgt, relation))."""
    edge_ids, edges = set(), []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("@"):
            continue
        m = EDGE_LINE.match(line)
        if m:
            eid, src, tgt, rel = m.groups()
            edge_ids.add(eid)
            edges.append((eid, src, tgt, rel))
    return edge_ids, edges


def parse_attr_refs(path):
    """Return (node_attr_ids, edge_attr_ids) referenced in the attrs file."""
    node_refs, edge_refs = set(), set()
    mode = "node"
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s:
            continue
        if s == "@node_attrs":
            mode = "node"
            continue
        if s == "@edge_attrs":
            mode = "edge"
            continue
        if s.startswith("@") or ":" not in line:
            continue
        rhs = line.rsplit(":", 1)[1].strip()
        if not rhs:
            continue  # this is an attr-key line like `kind:`
        ids = rhs.split()
        (node_refs if mode == "node" else edge_refs).update(ids)
    return node_refs, edge_refs


def parse_schema(path):
    """Return (declared_relations, referenced_source_files)."""
    relations, sources = set(), {}
    section = ""
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if s.startswith("@"):
            section = s.split()[0]
            continue
        if not s:
            continue
        if section == "@relations":
            relations.add(s.split()[0])
        elif section == "@sources":
            m = re.match(r"(nodes|edges|attrs|palette|cache)\s*=\s*(\S+)", s)
            if m:
                sources[m.group(1)] = m.group(2)
    return relations, sources


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    target = Path(sys.argv[1])
    errors, warnings = [], []

    mom_md = None
    if target.is_dir():
        pack = target
    elif target.suffix == ".md":
        mom_md = target
        pack = target.with_suffix("").with_name(target.stem + ".kg")
        if not pack.is_dir():
            pack = Path(str(target)[:-3] + ".kg")
    else:
        pack = target

    if not pack.is_dir():
        print(f"ERROR: KG pack directory not found: {pack}")
        return 1

    need = {"kg.schema": pack / "kg.schema",
            "kg.nodes": pack / "kg.nodes",
            "kg.edges": pack / "kg.edges",
            "kg.attrs": pack / "kg.attrs",
            "kg.palette": pack / "kg.palette"}
    for name, p in need.items():
        if not p.exists():
            errors.append(f"missing pack file: {name}")
    if errors:
        for e in errors:
            print(f"ERROR: {e}")
        return 1

    node_ids = parse_nodes(need["kg.nodes"])
    edge_ids, edges = parse_edges(need["kg.edges"])
    node_refs, edge_refs = parse_attr_refs(need["kg.attrs"])
    relations, sources = parse_schema(need["kg.schema"])

    if not node_ids:
        errors.append("kg.nodes defines no nodes")

    for eid, src, tgt, rel in edges:
        if src not in node_ids:
            errors.append(f"edge {eid}: source '{src}' is not a defined node")
        if tgt not in node_ids:
            errors.append(f"edge {eid}: target '{tgt}' is not a defined node")
        if relations and rel not in relations:
            warnings.append(f"edge {eid}: relation '{rel}' is not declared in @relations")

    for nid in sorted(node_refs - node_ids):
        errors.append(f"kg.attrs references undefined node '{nid}'")
    for eid in sorted(edge_refs - edge_ids):
        errors.append(f"kg.attrs references undefined edge '{eid}'")

    orphans = sorted(node_ids - {s for _, s, _, _ in edges} - {t for _, _, t, _ in edges})
    for nid in orphans:
        warnings.append(f"node '{nid}' has no edges (orphan)")

    for key in ("nodes", "edges", "attrs", "palette"):
        ref = sources.get(key)
        if ref and not (pack / ref).exists():
            errors.append(f"kg.schema points {key}={ref} but that file is missing")
    if "cache" in sources and not (pack / sources["cache"]).exists():
        warnings.append("kg.schema references a cache file; it is generated at render and may be absent")

    palette_path = need["kg.palette"]
    try:
        json.loads(palette_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as ex:
        errors.append(f"kg.palette is not valid JSON: {ex}")

    if mom_md and mom_md.exists():
        text = mom_md.read_text(encoding="utf-8")
        if "```items" not in text:
            errors.append(f"{mom_md.name} has no ```items knowledge-graph fence")
        elif f"{pack.name}/kg.schema" not in text:
            warnings.append(f"{mom_md.name} items fence does not reference {pack.name}/kg.schema")

    for w in warnings:
        print(f"WARN:  {w}")
    for e in errors:
        print(f"ERROR: {e}")

    if errors:
        print(f"\nFAILED: {len(errors)} error(s), {len(warnings)} warning(s).")
        return 1
    print(f"OK: {len(node_ids)} nodes, {len(edge_ids)} edges, "
          f"{len(relations)} relations. {len(warnings)} warning(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
