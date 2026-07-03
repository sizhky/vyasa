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


def parse_display_attrs(path):
    """Return the set of node-attr keys any view groups or colours by.

    These are the dimensions a node must have a value for, or it drops out of
    (or into a null bucket in) that view. Covers `group_by`, `color_by`, the
    combined `group_by,color_by=`, and graph-level `default_color_by`. Edge
    display keys (`edge_color_by`, `edge_label_from`) are intentionally skipped.
    """
    keys = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        m = re.match(r"([A-Za-z_,]+)\s*=\s*(\S+)", s)
        if not m:
            continue
        lhs = m.group(1).split(",")
        if any(k in ("group_by", "color_by", "default_color_by") for k in lhs):
            keys.add(m.group(2))
    return keys


def parse_node_attr_coverage(path):
    """Return {node_attr_key: set(node_ids assigned any value under it)}."""
    cov, mode, key = {}, "node", None
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s:
            continue
        if s == "@node_attrs":
            mode, key = "node", None
            continue
        if s == "@edge_attrs":
            mode, key = "edge", None
            continue
        if s.startswith("@") or mode != "node":
            continue
        head, _, rest = s.partition(":")
        if rest.strip() == "":
            key = head.strip()
            cov.setdefault(key, set())
        elif key is not None:
            cov[key].update(rest.split())
    return cov


def parse_schema(path):
    """Return (declared_relations, referenced_source_files, fold_mode, grammar_ref).

    grammar_ref is the path declared by an `@grammar path=...` line (or a
    `grammar=...` line inside @sources), or None. A CLI `--grammar` flag overrides
    it. The grammar is what layers dialect-specific invariants on top of the
    generic structural checks; without one, only the structural checks run.
    """
    relations, sources, fold_mode, grammar_ref = set(), {}, "union", None
    section = ""
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if s.startswith("@"):
            section = s.split()[0]
            fm = re.search(r"fold_mode\s*=\s*(\S+)", s)      # @graph ... fold_mode=delta
            if fm:
                fold_mode = fm.group(1)
            if section == "@grammar":                        # @grammar path=...
                gm = re.search(r"\bpath\s*=\s*(\S+)", s)
                if gm:
                    grammar_ref = gm.group(1)
            continue
        if not s:
            continue
        fm = re.match(r"fold_mode\s*=\s*(\S+)", s)            # standalone line form
        if fm:
            fold_mode = fm.group(1)
            continue
        if section == "@grammar":
            gm = re.match(r"path\s*=\s*(\S+)", s)             # @grammar on its own line
            if gm:
                grammar_ref = gm.group(1)
        elif section == "@relations":
            relations.add(s.split()[0])
        elif section == "@sources":
            m = re.match(r"(nodes|edges|attrs|palette|cache|grammar)\s*=\s*(\S+)", s)
            if m:
                if m.group(1) == "grammar":
                    grammar_ref = m.group(2)
                else:
                    sources[m.group(1)] = m.group(2)
    return relations, sources, fold_mode, grammar_ref


def parse_context_edges(pack):
    """Scan *.context @edges blocks -> list of (ctx, src, tgt, rel, op)."""
    out = []
    for cf in sorted(pack.glob("*.context")):
        ctx, section = cf.stem, None
        for line in cf.read_text(encoding="utf-8").splitlines():
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            if s.startswith("@context"):
                m = re.search(r"\bid\s*=\s*(\S+)", s)
                ctx, section = (m.group(1) if m else ctx), "@context"
                continue
            if s.startswith("@"):
                section = s.split()[0]
                continue
            if section == "@edges" and "->" in s:
                left, right = s.split("->", 1)
                parts = right.split()
                src, tgt = left.strip(), parts[0]
                rel = parts[1] if len(parts) > 1 else "rel"
                op = re.search(r"\bop\s*=\s*(\S+)", s)
                out.append((ctx, src, tgt, rel, op.group(1) if op else "+"))
    return out


def parse_node_attr_values(path):
    """Return {attr_key: {value: set(node_ids)}} for the @node_attrs section.

    Unlike parse_node_attr_coverage (which collapses to nodes-per-key), this keeps
    the value each node holds, so the grammar layer can check closed vocabularies,
    stage ordering on edges, and conditional attribute presence.
    """
    vals, mode, key = {}, "node", None
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s:
            continue
        if s == "@node_attrs":
            mode, key = "node", None
            continue
        if s == "@edge_attrs":
            mode, key = "edge", None
            continue
        if s.startswith("@") or mode != "node":
            continue
        head, _, rest = s.partition(":")
        if rest.strip() == "":
            key = head.strip()
            vals.setdefault(key, {})
        elif key is not None:
            vals[key].setdefault(head.strip(), set()).update(rest.split())
    return vals


def parse_inline_node_attrs(path):
    """Return {attr_key: {value: set(node_ids)}} for inline attrs in kg.nodes.

    Inline attrs are `key=value` lines written directly on a node (e.g.
    `source_ref=...`, `measure=...`), as opposed to the columnar @node_attrs in
    kg.attrs. Both are node attributes; the grammar layer must see both, or a
    rule like measurable-claim-carries-measure would fire on a measure that lives
    inline. A block scalar (`measure=|`) records its key as present (value "")
    so a presence check still fires; its indented continuation lines are skipped
    so prose containing `=` is not mistaken for an attr.
    """
    vals, cur, block_indent = {}, None, None
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("@"):
            continue
        if not line[:1].isspace():                       # node header `id: Label`
            m = NODE_ID.match(line) or NODE_ID_BARE.match(line)
            cur, block_indent = (m.group(1) if m else None), None
            continue
        indent = len(line) - len(line.lstrip())
        if block_indent is not None and indent > block_indent:
            continue                                     # inside a block scalar
        block_indent = None
        if cur is None:
            continue
        m = re.match(r"([A-Za-z_]\w*)=(.*)$", line.strip())
        if not m:
            continue
        k, v = m.group(1), m.group(2).strip()
        if v == "|":                                     # block scalar starts here
            vals.setdefault(k, {}).setdefault("", set()).add(cur)  # record presence; a
            block_indent = indent                        # multiline inline attr (e.g.
            continue                                      # measure=|) still counts as set
        vals.setdefault(k, {}).setdefault(v, set()).add(cur)
    return vals


def _node_value_map(values, attr):
    """Invert {value: nodes} for one attr into {node: value} (last write wins)."""
    out = {}
    for value, nodes in values.get(attr, {}).items():
        for n in nodes:
            out[n] = value
    return out


def _order_index(value, order):
    """Position of a stage value in an ordering. 'numeric' reads the leading int
    (so '20-brd' and '20-business-requirements' both rank 20); a list looks up by
    membership. Returns None when the value can't be placed."""
    if value is None:
        return None
    if order == "numeric":
        m = re.match(r"\s*(\d+)", value)
        return int(m.group(1)) if m else None
    if isinstance(order, list):
        return order.index(value) if value in order else None
    return None


def check_grammar(grammar, node_ids, edges, values):
    """Enforce a dialect grammar. Returns (errors, warnings).

    Grammar violations are warnings, not errors: the structural checks decide
    render-safety; the grammar decides dialect-honesty. A pack with a bad edge
    direction still renders — it just tells the wrong story, which is worth a loud
    warning but not a build-breaking failure.
    """
    errs, warns = [], []

    for attr, allowed in grammar.get("closed_vocab", {}).items():
        seen = set(values.get(attr, {}).keys())
        for bad in sorted(seen - set(allowed)):
            warns.append(f"grammar: '{attr}' value '{bad}' is not in the closed "
                         f"vocabulary {allowed}")

    for rel, spec in grammar.get("edge_direction", {}).items():
        vmap = _node_value_map(values, spec["by"])
        order, want = spec.get("order", "numeric"), spec.get("dir", "downhill")
        for eid, src, tgt, r in edges:
            if r != rel:
                continue
            si, ti = _order_index(vmap.get(src), order), _order_index(vmap.get(tgt), order)
            if si is None or ti is None:
                continue
            uphill = si > ti
            if (want == "downhill" and uphill) or (want == "uphill" and si < ti):
                warns.append(f"grammar: edge {eid} '{rel}' runs {'uphill' if uphill else 'downhill'} "
                             f"({vmap.get(src)} -> {vmap.get(tgt)}) but must flow {want}")

    for rel, spec in grammar.get("edge_cardinality", {}).items():
        into, out = {}, {}
        for eid, src, tgt, r in edges:
            if r != rel:
                continue
            into.setdefault(tgt, []).append(eid)
            out.setdefault(src, []).append(eid)
        if "into_max" in spec:
            for n, es in into.items():
                if len(es) > spec["into_max"]:
                    warns.append(f"grammar: node '{n}' has {len(es)} '{rel}' edges into it "
                                 f"({', '.join(es)}) but at most {spec['into_max']} allowed")
        if "out_max" in spec:
            for n, es in out.items():
                if len(es) > spec["out_max"]:
                    warns.append(f"grammar: node '{n}' has {len(es)} '{rel}' edges out of it "
                                 f"({', '.join(es)}) but at most {spec['out_max']} allowed")

    for rel, spec in grammar.get("edge_endpoints", {}).items():
        for end in ("src", "tgt"):
            for attr, allowed in spec.get(end, {}).items():
                vmap = _node_value_map(values, attr)
                for eid, src, tgt, r in edges:
                    if r != rel:
                        continue
                    node = src if end == "src" else tgt
                    val = vmap.get(node)
                    if val is not None and val not in allowed:
                        warns.append(f"grammar: edge {eid} '{rel}' {end} '{node}' has {attr}="
                                     f"'{val}', but {end} must be one of {allowed}")

    for rule in grammar.get("requires_attr_when", []):
        cond, then = rule.get("if", {}), rule.get("then")
        then_nodes = set().union(*values.get(then, {}).values()) if values.get(then) else set()
        for attr, trigger_vals in cond.items():
            vmap = _node_value_map(values, attr)
            for n, v in vmap.items():
                if v in trigger_vals and n not in then_nodes:
                    warns.append(f"grammar: node '{n}' has {attr}='{v}' but carries no "
                                 f"'{then}' value ({attr} in {trigger_vals} requires '{then}')")

    return errs, warns


def load_grammar(ref, pack, cli_override):
    """Resolve and load a grammar JSON. CLI flag wins over the schema ref. Path is
    tried as-is, then relative to the pack dir. Returns (grammar|None, note)."""
    raw = cli_override or ref
    if not raw:
        return None, None
    for cand in (Path(raw), pack / raw):
        if cand.exists():
            try:
                return json.loads(cand.read_text(encoding="utf-8")), None
            except json.JSONDecodeError as ex:
                return None, f"grammar file {cand} is not valid JSON: {ex}"
    return None, f"grammar file not found: {raw} (tried as-is and relative to {pack})"


def main():
    args = sys.argv[1:]
    cli_grammar = None
    if "--grammar" in args:
        i = args.index("--grammar")
        try:
            cli_grammar = args[i + 1]
        except IndexError:
            print("ERROR: --grammar needs a path")
            return 2
        del args[i:i + 2]
    if len(args) != 1:
        print(__doc__)
        return 2
    target = Path(args[0])
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
    relations, sources, fold_mode, grammar_ref = parse_schema(need["kg.schema"])
    ctx_edges = parse_context_edges(pack)

    if not node_ids:
        errors.append("kg.nodes defines no nodes")

    for eid, src, tgt, rel in edges:
        if src not in node_ids:
            errors.append(f"edge {eid}: source '{src}' is not a defined node")
        if tgt not in node_ids:
            errors.append(f"edge {eid}: target '{tgt}' is not a defined node")
        if relations and rel not in relations:
            warnings.append(f"edge {eid}: relation '{rel}' is not declared in @relations")

    # context edges: referential integrity + retraction sanity (fold_mode=delta)
    asserted = {(s, r, t) for _, s, t, r in edges}          # base assertions
    for ctx, src, tgt, rel, op in ctx_edges:
        if src not in node_ids:
            errors.append(f"context '{ctx}' edge: source '{src}' is not a defined node")
        if tgt not in node_ids:
            errors.append(f"context '{ctx}' edge: target '{tgt}' is not a defined node")
        if relations and rel not in relations:
            warnings.append(f"context '{ctx}' edge: relation '{rel}' is not declared in @relations")
        if op == "-":
            if fold_mode != "delta":
                warnings.append(f"context '{ctx}': edge {src}-{rel}->{tgt} has op=- but "
                                f"fold_mode is '{fold_mode}' — retraction is IGNORED "
                                f"(set fold_mode=delta in @graph)")
            if (src, rel, tgt) not in asserted:
                errors.append(f"context '{ctx}': op=- retracts {src}-{rel}->{tgt} "
                              f"which was never asserted (dangling retraction)")
        else:
            asserted.add((src, rel, tgt))                   # later contexts can retract this

    for nid in sorted(node_refs - node_ids):
        errors.append(f"kg.attrs references undefined node '{nid}'")
    for eid in sorted(edge_refs - edge_ids):
        errors.append(f"kg.attrs references undefined edge '{eid}'")

    linked = ({s for _, s, _, _ in edges} | {t for _, _, t, _ in edges}
              | {s for _, s, _, _, _ in ctx_edges} | {t for _, _, t, _, _ in ctx_edges})
    orphans = sorted(node_ids - linked)
    for nid in orphans:
        warnings.append(f"node '{nid}' has no edges (orphan)")

    # Coverage: a node missing a value for an attr some view groups/colours by
    # silently drops out of that view. kgval was previously blind to this.
    display_attrs = parse_display_attrs(need["kg.schema"])
    attr_cov = parse_node_attr_coverage(need["kg.attrs"])
    for key in sorted(display_attrs):
        if key not in attr_cov:
            continue
        for nid in sorted(node_ids - attr_cov[key]):
            warnings.append(f"node '{nid}' has no '{key}' value, but a view "
                            f"groups/colours by '{key}' — it drops out of that view")

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

    # Dialect grammar (optional): layers claim-graph invariants over the generic
    # structural checks above. Absent grammar => structural checks only.
    grammar, gnote = load_grammar(grammar_ref, pack, cli_grammar)
    if gnote:
        warnings.append(gnote)
    if grammar:
        attr_values = parse_node_attr_values(need["kg.attrs"])
        for k, vmap in parse_inline_node_attrs(need["kg.nodes"]).items():
            dst = attr_values.setdefault(k, {})
            for v, ids in vmap.items():
                dst.setdefault(v, set()).update(ids)
        gerrs, gwarns = check_grammar(grammar, node_ids, edges, attr_values)
        errors.extend(gerrs)
        warnings.extend(gwarns)

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
