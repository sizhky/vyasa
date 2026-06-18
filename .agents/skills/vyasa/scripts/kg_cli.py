#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from pathlib import Path


def node_block(node_id, label, description):
    return f"{node_id}: {label}\n\tdescription={description}\n"


def upsert_node(path, node_id, label, description):
    text = path.read_text(encoding="utf-8")
    block = node_block(node_id, label, description)
    pattern = rf"^{re.escape(node_id)}: .*(?:\n[ \t].*)*\n?"
    text, count = re.subn(pattern, block, text, flags=re.M)
    path.write_text(text if count else text.rstrip() + "\n" + block, encoding="utf-8")


def delete_node(path, node_id):
    text = path.read_text(encoding="utf-8")
    text = re.sub(rf"^{re.escape(node_id)}: .*(?:\n[ \t].*)*\n?", "", text, flags=re.M)
    path.write_text(text, encoding="utf-8")


def remove_id_from_attrs(path, node_id):
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith(" ") and ":" in line:
            value, ids = line.split(":", 1)
            kept = [item for item in ids.split() if item != node_id]
            line = f"{value}: {' '.join(kept)}" if kept else ""
        if line:
            out.append(line)
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def bulk_set_attr(path, key, value, ids):
    lines = path.read_text(encoding="utf-8").splitlines()
    start = next((i for i, line in enumerate(lines) if line == f"{key}:"), -1)
    if start < 0:
        insert = next(i for i, line in enumerate(lines) if line == "@edge_attrs")
        lines[insert:insert] = [f"{key}:", f"  {value}: {' '.join(ids)}"]
    else:
        end = next((i for i in range(start + 1, len(lines)) if lines[i] and not lines[i].startswith(" ")), len(lines))
        row = next((i for i in range(start + 1, end) if lines[i].strip().startswith(f"{value}:")), -1)
        if row < 0:
            lines.insert(end, f"  {value}: {' '.join(ids)}")
        else:
            lines[row] = f"  {value}: {' '.join(ids)}"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def prune_edges_touching(pack, node_id):
    for path in list(pack.glob("*.kg.edges")) + [pack / "kg.edges"]:
        if not path.exists():
            continue
        kept = [line for line in path.read_text(encoding="utf-8").splitlines() if f" {node_id} " not in f" {line} "]
        path.write_text("\n".join(kept) + ("\n" if kept else ""), encoding="utf-8")


def replace_edges(path, edges):
    path.write_text("\n".join(edges) + "\n", encoding="utf-8")


def upsert_edge(path, edge_id, source, relation, target):
    line = f"{edge_id}: {source} -> {target} {relation}"
    lines = path.read_text(encoding="utf-8").splitlines()
    prefix = f"{edge_id}:"
    for index, existing in enumerate(lines):
        if existing.startswith(prefix):
            lines[index] = line
            break
    else:
        lines.append(line)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def delete_edge(path, edge_id):
    prefix = f"{edge_id}:"
    lines = [line for line in path.read_text(encoding="utf-8").splitlines() if not line.startswith(prefix)]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def redirect_node_in_edges(pack, old_id, new_id):
    for path in list(pack.glob("*.kg.edges")) + [pack / "kg.edges"]:
        if not path.exists():
            continue
        out = []
        for line in path.read_text(encoding="utf-8").splitlines():
            line = re.sub(rf"(?<=\s){re.escape(old_id)}(?=\s|$)", new_id, line)
            parts = line.split()
            if len(parts) >= 5 and parts[1] == new_id and parts[3] == new_id:
                continue
            out.append(line)
        path.write_text("\n".join(out) + ("\n" if out else ""), encoding="utf-8")


def ensure_relation(path, relation):
    text = path.read_text(encoding="utf-8")
    if f"\n{relation}\n" not in text:
        text = text.replace("\n@views\n", f"\n{relation}\n\n@views\n")
    path.write_text(text, encoding="utf-8")


parser = argparse.ArgumentParser()
sub = parser.add_subparsers(dest="cmd", required=True)
for name in ("upsert-node", "delete-node"):
    p = sub.add_parser(name); p.add_argument("path", type=Path); p.add_argument("id")
    if name == "upsert-node":
        p.add_argument("label"); p.add_argument("description")
    else:
        p.add_argument("--attrs", type=Path); p.add_argument("--pack", type=Path)
p = sub.add_parser("bulk-set-attr"); p.add_argument("path", type=Path); p.add_argument("key"); p.add_argument("value"); p.add_argument("ids", nargs="+")
p = sub.add_parser("replace-edges"); p.add_argument("path", type=Path); p.add_argument("edges", nargs="+")
p = sub.add_parser("upsert-edge"); p.add_argument("path", type=Path); p.add_argument("id"); p.add_argument("source"); p.add_argument("relation"); p.add_argument("target")
p = sub.add_parser("delete-edge"); p.add_argument("path", type=Path); p.add_argument("id")
p = sub.add_parser("redirect-node"); p.add_argument("pack", type=Path); p.add_argument("old_id"); p.add_argument("new_id")
p = sub.add_parser("ensure-relation"); p.add_argument("path", type=Path); p.add_argument("relation")
args = parser.parse_args()
if args.cmd == "upsert-node": upsert_node(args.path, args.id, args.label, args.description)
elif args.cmd == "delete-node":
    delete_node(args.path, args.id)
    if args.attrs: remove_id_from_attrs(args.attrs, args.id)
    if args.pack: prune_edges_touching(args.pack, args.id)
elif args.cmd == "bulk-set-attr": bulk_set_attr(args.path, args.key, args.value, args.ids)
elif args.cmd == "replace-edges": replace_edges(args.path, args.edges)
elif args.cmd == "upsert-edge": upsert_edge(args.path, args.id, args.source, args.relation, args.target)
elif args.cmd == "delete-edge": delete_edge(args.path, args.id)
elif args.cmd == "redirect-node": redirect_node_in_edges(args.pack, args.old_id, args.new_id)
elif args.cmd == "ensure-relation": ensure_relation(args.path, args.relation)
