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

TOKEN = re.compile(r'(\w+)=("(?:[^"\\]|\\.)*"|\S+)')
COND = re.compile(r'(\w+)\s*(!=|<=|>=|~|=)\s*("[^"]*"|\S+)')


def unquote(raw: str) -> str:
    if raw.startswith('"'):
        raw = raw[1:-1]
    return raw.replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\")


def parse_fact(line: str) -> dict:
    d = {}
    for k, raw in TOKEN.findall(line):
        d[k] = unquote(raw)
    v = d.get("v", "")
    d["ref"] = v.startswith("@")
    if d["ref"]:
        d["v"] = v[1:]
    return d


class Index:
    def __init__(self, path: Path):
        self.facts = [parse_fact(ln) for ln in path.read_text().splitlines() if ln.strip()]
        self.seq = {f["e"]: int(f["v"]) for f in self.facts if f["a"] == "seq"}
        self.relations = {f["e"] for f in self.facts if f["a"] == "kind" and f["v"] == "relation"}
        self.lifecycle = next((f["e"] for f in self.facts if f["a"] == "is_lifecycle"), None)
        self.defaults = {f["e"]: f["v"] for f in self.facts if f["a"] == "lifecycle_default"}
        self.by_e = defaultdict(list)
        for f in self.facts:
            self.by_e[f["e"]].append(f)

    def _seq(self, ctx):
        return self.seq.get(ctx, 0)

    def fold(self, e, bound=None):
        """Collapse one entity's facts into a record. bound = max context seq (asof)."""
        rec, groups = {"id": e}, defaultdict(list)
        for f in self.by_e[e]:
            if bound is not None and f.get("c") and self._seq(f["c"]) > bound:
                continue
            groups[f["a"]].append(f)
        for a, fs in groups.items():
            if a in self.relations:
                rec[a] = sorted({f["v"] for f in fs})          # edges: union of targets
            else:
                rec[a] = max(fs, key=lambda f: self._seq(f.get("c", "")))["v"]  # scalar: latest
        if self.lifecycle and self.lifecycle not in rec and rec.get("kind") in self.defaults:
            rec[self.lifecycle] = self.defaults[rec["kind"]]    # schema-declared lifecycle fallback
        return rec

    def nodes(self, bound=None):
        out = []
        for e, fs in self.by_e.items():
            if not any(f["a"] == "label" for f in fs):
                continue
            rec = self.fold(e, bound)
            if rec.get("kind") in ("context", "slide", "relation"):
                continue
            out.append(rec)
        return out


def match(rec: dict, key: str, op: str, val: str) -> bool:
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


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def closure(idx: Index, seeds, rel, inward, bound):
    """Transitive follow*/incoming* from seeds along rel. Returns reached ids minus seeds."""
    seen, frontier = set(), set(seeds)
    while frontier:
        seen |= frontier
        nxt = set()
        for i in frontier:
            if inward:
                nxt |= {f["e"] for f in idx.facts if f["a"] == rel and f["ref"] and f["v"] == i}
            else:
                v = idx.fold(i, bound).get(rel)
                if v:
                    nxt |= set(v if isinstance(v, list) else [v])
        frontier = nxt - seen
    return seen - set(seeds)


def run(idx: Index, query: str):
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
    grouped = None

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
            seeds = {r["id"] for r in stream if "id" in r}
            reached = closure(idx, seeds, rest.strip(), verb == "incoming*", bound)
            stream = [idx.fold(x, bound) for x in sorted(reached)]
        elif verb in ("with", "without"):
            rel = rest.strip()
            targeted = {f["v"] for f in idx.facts if f["a"] == rel and f["ref"]}
            keep = (lambda i: i in targeted) if verb == "with" else (lambda i: i not in targeted)
            stream = [r for r in stream if keep(r.get("id"))]
        elif verb in ("count", "countd", "sum", "avg", "rate"):
            ensure()
            f = rest.split()
            for g in grouped:
                items = g["items"]
                if verb == "count":
                    g["count"] = len(items)
                elif verb == "countd":
                    g["countd_" + f[0]] = len({x.get(f[0]) for x in items if x.get(f[0]) is not None})
                elif verb == "sum":
                    g["sum_" + f[0]] = round(sum(num(x.get(f[0])) or 0 for x in items), 3)
                elif verb == "avg":
                    vs = [num(x.get(f[0])) for x in items if num(x.get(f[0])) is not None]
                    g["avg_" + f[0]] = round(sum(vs) / len(vs), 3) if vs else None
                elif verb == "rate":
                    a, b = num(g.get(f[0])), num(g.get(f[1]))
                    sc = float(f[2]) if len(f) > 2 else 1.0
                    g["rate"] = round(a / b * sc, 3) if (a is not None and b) else None
            stream = grouped
        elif verb == "join":
            keys = rest.split()
            for r in stream:
                if "e" in r:
                    rec = idx.fold(r["e"], bound)
                    for k in keys:
                        if k in rec:
                            r[k] = rec[k]
        elif verb == "follow":
            ids = {r["id"] for r in stream if "id" in r}
            tgt = set()
            for i in ids:
                v = idx.fold(i, bound).get(rest.strip())
                if v:
                    tgt |= set(v if isinstance(v, list) else [v])
            stream = [idx.fold(t, bound) for t in sorted(tgt)]
        elif verb == "incoming":
            ids = {r["id"] for r in stream if "id" in r}
            srcs = {f["e"] for f in idx.facts if f["a"] == rest.strip() and f["ref"] and f["v"] in ids}
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
            stream.sort(key=lambda r: (r.get(key) is None, r.get(key)), reverse=desc)
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
        print("usage: kg_query.py <kg.index> '<query>'", file=sys.stderr)
        return 2
    idx = Index(Path(argv[1]))
    rows = run(idx, argv[2])
    for r in rows:
        print(fmt(r) if isinstance(r, dict) else r)
    print(f"-- {len(rows)} rows", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
