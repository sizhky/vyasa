#!/usr/bin/env python3
"""Query engine over a kg.index fact log. A small pipeline DSL.

    kg_query.py <kg.index> 'nodes | where kind=deliverable status!=done | select id label owner'

Stages are separated by `|`. Sources: nodes (folded entity records), facts
(raw triples), contexts. Stages: where, join, follow[*], incoming[*], with, without,
select, group, count, countd, sum, avg, rate, sort, limit.
Folding (latest-context-wins for scalars, union for relations) lives in `nodes`.
"""
from __future__ import annotations
import re, sys
from collections import defaultdict
from pathlib import Path
from typing import Any

TOKEN = re.compile(r'(\w+)=("(?:[^"\\]|\\.)*"|\S+)')
COND = re.compile(r'(\w+)\s*(!=|<=|>=|~|=)\s*("[^"]*"|\S+)')
Fact = dict[str, Any]
Row = dict[str, Any]


def unquote(raw: str) -> str:
    if raw.startswith('"'):
        raw = raw[1:-1]
    return raw.replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\")


def parse_fact(line: str) -> Fact:
    d: Fact = {}
    for k, raw in TOKEN.findall(line):
        d[k] = unquote(raw)
    v = d.get("v", "")
    d["ref"] = v.startswith("@")
    if d["ref"]:
        d["v"] = v[1:]
    return d


class Index:
    def __init__(self, path: Path, viewer: str = "") -> None:
        self.raw_facts: list[Fact] = [parse_fact(ln) for ln in path.read_text().splitlines() if ln.strip()]
        self.facts = self._visible_facts(viewer)
        self.seq = {f["e"]: int(f["v"]) for f in self.facts if f["a"] == "seq"}
        self.fold_mode = next((f["v"] for f in self.facts if f["a"] == "fold_mode"), "union")
        self.relations = {f["e"] for f in self.facts if f["a"] == "kind" and f["v"] == "relation"}
        self.lifecycle = next((f["e"] for f in self.facts if f["a"] == "is_lifecycle"), None)
        self.defaults = {f["e"]: f["v"] for f in self.facts if f["a"] == "lifecycle_default"}
        self.by_e: dict[str, list[Fact]] = defaultdict(list)
        for f in self.facts:
            self.by_e[f["e"]].append(f)

    def _acl_classes_by_entity(self) -> dict[str, set[str]]:
        out = defaultdict(set)
        for f in self.raw_facts:
            if f["a"] == "cls":
                out[f["e"]].add(f["v"])
        return out

    def _viewer_classes(self, viewer: str) -> set[str]:
        viewer = str(viewer or "").strip()
        if not viewer:
            return set()
        class_ids = {f["e"] for f in self.raw_facts if f["a"] == "kind" and f["v"] == "acl_class"}
        seeds = {viewer}
        seeds |= {f["v"] for f in self.raw_facts if f["e"] == viewer and f["a"] == "role" and f["ref"]}
        seen, frontier, grants = set(), set(seeds), set()
        while frontier:
            seen |= frontier
            nxt = set()
            for item in frontier:
                for f in self.raw_facts:
                    if f["e"] == item and f["a"] == "can_see" and f["ref"]:
                        if f["v"] in class_ids:
                            grants.add(f["v"])
                        else:
                            nxt.add(f["v"])
            frontier = nxt - seen
        return grants

    def _visible_facts(self, viewer: str) -> list[Fact]:
        if not str(viewer or "").strip():
            return list(self.raw_facts)
        grants = self._viewer_classes(viewer)
        class_ids = {f["e"] for f in self.raw_facts if f["a"] == "kind" and f["v"] == "acl_class"}
        if class_ids and grants >= class_ids:
            return [f for f in self.raw_facts if not (f["a"] in {"role", "can_see"} or (f["a"] == "kind" and f["v"] == "acl_class"))]
        classes_by_entity = self._acl_classes_by_entity()
        return [f for f in self.raw_facts if classes_by_entity.get(f["e"], set()) & grants]

    def _seq(self, ctx: str | None) -> int:
        return self.seq.get(ctx, 0)

    def fold(self, e: str, bound: int | None = None) -> Row:
        """Collapse one entity's facts into a record. bound = max context seq (asof)."""
        rec: Row = {"id": e}
        groups: dict[str, list[Fact]] = defaultdict(list)
        for f in self.by_e[e]:
            if bound is not None and f.get("c") and self._seq(f["c"]) > bound:
                continue
            groups[f["a"]].append(f)
        for a, fs in groups.items():
            if a in self.relations or a == "cls":
                if self.fold_mode == "delta":                   # last-op-wins per target
                    live: dict[str, str] = {}
                    for f in sorted(fs, key=lambda f: self._seq(f.get("c", ""))):
                        live[f["v"]] = f.get("op", "+")
                    rec[a] = sorted(t for t, op in live.items() if op != "-")
                else:
                    rec[a] = sorted({f["v"] for f in fs})      # edges: union of targets
            else:
                rec[a] = max(fs, key=lambda f: self._seq(f.get("c", "")))["v"]  # scalar: latest
        if self.lifecycle and self.lifecycle not in rec and rec.get("kind") in self.defaults:
            rec[self.lifecycle] = self.defaults[rec["kind"]]    # schema-declared lifecycle fallback
        return rec

    def nodes(self, bound: int | None = None) -> list[Row]:
        out: list[Row] = []
        for e, fs in self.by_e.items():
            if not any(f["a"] == "label" for f in fs):
                continue
            rec = self.fold(e, bound)
            if rec.get("kind") in ("context", "slide", "relation"):
                continue
            out.append(rec)
        return out


def match(rec: Row, key: str, op: str, val: str) -> bool:
    cur = rec.get(key)
    if val == "_none":                                       # absence test: k=_none / k!=_none
        return (cur is None) == (op == "=")
    if cur is None:
        return op == "!="
    vals = cur if isinstance(cur, list) else [cur]
    opts = val.split(",")                                   # comma = OR set
    if op == "=":
        return any(o in vals for o in opts)
    if op == "!=":
        return not any(o in vals for o in opts)
    if op == "~":
        return any(val.lower() in str(x).lower() for x in vals)
    if op in ("<=", ">=", ">", "<"):
        try:
            a, b = float(vals[0]), float(val)
        except ValueError:
            return False
        return {"<=": a <= b, ">=": a >= b, ">": a > b, "<": a < b}[op]
    return False


def num(x: Any) -> float | None:
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def values(v: Any) -> list[str]:
    return v if isinstance(v, list) else ([v] if v else [])


def relation_targets(idx: Index, entity: str, rel: str, bound: int | None = None) -> set[str]:
    return set(values(idx.fold(entity, bound).get(rel)))


def incoming_sources(idx: Index, targets: set[str], rel: str, bound: int | None = None) -> set[str]:
    target_ids = set(targets)
    return {entity for entity in idx.by_e if relation_targets(idx, entity, rel, bound) & target_ids}


def closure(idx: Index, seeds: set[str], rel: str, inward: bool, bound: int | None) -> set[str]:
    """Transitive follow*/incoming* from seeds along rel. Returns reached ids minus seeds."""
    seen, frontier = set(), set(seeds)
    while frontier:
        seen |= frontier
        nxt = set()
        for i in frontier:
            if inward:
                nxt |= incoming_sources(idx, {i}, rel, bound)
            else:
                nxt |= relation_targets(idx, i, rel, bound)
        frontier = nxt - seen
    return seen - set(seeds)


def stage_options(rest: str) -> tuple[list[str], dict[str, str]]:
    parts, opts = [], {}
    for token in rest.split():
        if "=" in token:
            key, value = token.split("=", 1)
            opts[key] = value
        else:
            parts.append(token)
    return parts, opts


def row_ids(rows: list[Row]) -> set[str]:
    return {item for r in rows if isinstance((item := r.get("id")), str)}


def impact_layers(
    idx: Index,
    seeds: set[str],
    rels: list[str],
    inward: bool = True,
    bound: int | None = None,
    max_depth: int = 3,
    max_width: int = 200,
) -> list[Row]:
    seen, frontier, out = set(seeds), set(seeds), []
    for depth in range(1, max_depth + 1):
        nxt, via = set(), {}
        for rel in rels:
            reached = incoming_sources(idx, frontier, rel, bound) if inward else set().union(
                *(relation_targets(idx, item, rel, bound) for item in frontier)
            )
            for item in reached - seen:
                via.setdefault(item, rel)
                nxt.add(item)
        if not nxt:
            break
        layer = sorted(nxt)[:max_width]
        out.extend({"id": item, "impact_depth": depth, "impact_via": via[item]} for item in layer)
        seen |= set(layer)
        frontier = set(layer)
        if len(nxt) > max_width:
            break
    return out


def run(idx: Index, query: str) -> list[Row]:
    stages = [s.strip() for s in query.split("|") if s.strip()]
    src = stages[0].split()
    bound = idx._seq(src[src.index("asof") + 1]) if "asof" in src else None
    if src[0] == "diff":
        a, b = src[1], src[2]
        A = {(f["e"], f["a"], f["v"]) for f in idx.facts if f.get("c") == a}
        B = {(f["e"], f["a"], f["v"]) for f in idx.facts if f.get("c") == b}
        stream = [{"change": "+", "e": e, "a": at, "v": v} for (e, at, v) in sorted(B - A)] + \
                 [{"change": "-", "e": e, "a": at, "v": v} for (e, at, v) in sorted(A - B)]
    elif src[0] == "facts":
        stream = list(idx.facts)
    elif src[0] == "contexts":
        stream = [idx.fold(e) for e in idx.seq]
    else:
        stream = idx.nodes(bound)
    grouped: list[Row] | None = None

    def ensure():
        nonlocal grouped
        if grouped is None:
            grouped = [{"group": None, "items": list(stream)}]
        return grouped

    for st in stages[1:]:
        verb, rest = (st.split(None, 1) + [""])[:2]
        if verb == "where":
            for k, op, v in COND.findall(rest):
                stream = [r for r in stream if match(r, k, op, unquote(v))]
        elif verb in ("follow*", "incoming*"):
            seeds = row_ids(stream)
            reached = closure(idx, seeds, rest.strip(), verb == "incoming*", bound)
            stream = [idx.fold(x, bound) for x in sorted(reached)]
        elif verb == "impact":
            parts, opts = stage_options(rest)
            rels = (parts[0] if parts else opts.get("rel", "")).split(",")
            rels = [rel for rel in rels if rel]
            direction = opts.get("direction", "in")
            max_depth = int(opts.get("depth", "3"))
            max_width = int(opts.get("width", "200"))
            seeds = row_ids(stream)
            rows = impact_layers(idx, seeds, rels, direction != "out", bound, max_depth, max_width)
            stream = [idx.fold(row["id"], bound) | row for row in rows]
        elif verb in ("with", "without"):
            rel = rest.strip()
            targeted = {f["v"] for f in idx.facts if f["a"] == rel and f["ref"]}
            keep = (lambda i: i in targeted) if verb == "with" else (lambda i: i not in targeted)
            stream = [r for r in stream if keep(r.get("id"))]
        elif verb in ("count", "countd", "sum", "avg", "rate"):
            ensure()
            f = rest.split()
            for g in grouped or []:
                items = g["items"]
                if verb == "count":
                    g["count"] = len(items)
                elif verb == "countd":
                    g["countd_" + f[0]] = len({x.get(f[0]) for x in items if x.get(f[0]) is not None})
                elif verb == "sum":
                    g["sum_" + f[0]] = round(sum(num(x.get(f[0])) or 0 for x in items), 3)
                elif verb == "avg":
                    vs = [n for x in items if (n := num(x.get(f[0]))) is not None]
                    g["avg_" + f[0]] = round(sum(vs) / len(vs), 3) if vs else None
                elif verb == "rate":
                    a, b = num(g.get(f[0])), num(g.get(f[1]))
                    sc = float(f[2]) if len(f) > 2 else 1.0
                    g["rate"] = round(a / b * sc, 3) if (a is not None and b) else None
            stream = grouped or []
        elif verb == "join":
            keys = rest.split()
            for r in stream:
                entity = r.get("e")
                if isinstance(entity, str):
                    rec = idx.fold(entity, bound)
                    for k in keys:
                        if k in rec:
                            r[k] = rec[k]
        elif verb == "follow":
            ids = row_ids(stream)
            tgt = set()
            for i in ids:
                tgt |= relation_targets(idx, i, rest.strip(), bound)
            stream = [idx.fold(t, bound) for t in sorted(tgt)]
        elif verb == "incoming":
            ids = row_ids(stream)
            srcs = incoming_sources(idx, ids, rest.strip(), bound)
            stream = [idx.fold(s, bound) for s in sorted(srcs)]
        elif verb == "select":
            keys = rest.split()
            stream = [{k: r.get(k) for k in keys if k in r} for r in stream]
        elif verb == "group":
            g = defaultdict(list)
            for r in stream:
                kv = r.get(rest.strip())
                for key in (kv if isinstance(kv, list) else [kv]):
                    g[key].append(r)
            grouped = [{"group": k, "items": v} for k, v in g.items()]
            stream = grouped
        elif verb == "sort":
            parts = rest.split()
            key = parts[0]
            desc = len(parts) > 1 and parts[1] == "desc"
            stream.sort(key=lambda r: (r.get(str(key)) is None, r.get(str(key))), reverse=desc)
        elif verb == "limit":
            stream = stream[:int(rest)]
        else:
            print(f"unknown stage: {verb}", file=sys.stderr)
            return []
    return stream


def fmt(rec: dict) -> str:
    def show(v):
        return ",".join(v) if isinstance(v, list) else str(v)
    return " ".join(f"{k}={show(v)}" for k, v in rec.items()
                    if k != "items" and not (k == "group" and v is None))


def main(argv):
    if len(argv) < 3:
        print("usage: kg_query.py [--viewer <role-or-person>] <kg.index> '<query>'", file=sys.stderr)
        return 2
    viewer = ""
    args = list(argv[1:])
    if args[:1] == ["--viewer"] and len(args) >= 4:
        viewer = args[1]
        args = args[2:]
    if len(args) < 2:
        print("usage: kg_query.py [--viewer <role-or-person>] <kg.index> '<query>'", file=sys.stderr)
        return 2
    idx = Index(Path(args[0]), viewer=viewer)
    rows = run(idx, args[1])
    for r in rows:
        print(fmt(r) if isinstance(r, dict) else r)
    print(f"-- {len(rows)} rows", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
