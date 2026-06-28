#!/usr/bin/env python3
"""Generate kg.index (a flat datom fact log) from a KG Pack.

A fact is one line:  e=<entity> a=<attr> v=<value> [c=<context>] [op=+|-]
- v=@id marks an entity reference (a graph edge / join target).
- c omitted means the base (timeless/immutable) context.
- op omitted means + (assert).

Works with or without *.context files. No contexts -> a flat graph from
kg.nodes + kg.attrs + kg.schema only.
"""
from __future__ import annotations
import re, sys
from pathlib import Path

NODE_RE = re.compile(r"^(\s*)([\w][\w-]*):\s+(.*)$")   # id: label
ATTR_RE = re.compile(r"^(\s*)([\w][\w-]*)=(.*)$")        # key=value (or key=|)


def enc(v: str, ref: bool = False) -> str:
    """Encode a value token. Refs pass through as @id; text is quoted if needed."""
    if ref:
        return "@" + v.lstrip("@")
    v = v.replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')
    if v == "" or re.search(r'[\s="@]', v):
        return f'"{v}"'
    return v


def fact(e, a, v, c=None, ref=False, op=None) -> str:
    out = [f"e={enc(e)}", f"a={enc(a)}", f"v={enc(v, ref)}"]
    if c:
        out.append(f"c={enc(c)}")
    if op and op != "+":
        out.append(f"op={op}")
    return " ".join(out)


def read_blocks(lines):
    """Yield (indent, key, value, block_lines) for `key=value` / `key=|` attrs."""
    i = 0
    while i < len(lines):
        m = ATTR_RE.match(lines[i])
        if not m:
            i += 1
            continue
        indent, key, val = len(m.group(1)), m.group(2), m.group(3)
        if val == "|":  # multiline block: gather deeper-indented lines
            body, i = [], i + 1
            while i < len(lines) and (lines[i].strip() == "" or (len(lines[i]) - len(lines[i].lstrip())) > indent):
                body.append(lines[i])
                i += 1
            # dedent block by the first content line's indent
            base = min((len(b) - len(b.lstrip()) for b in body if b.strip()), default=0)
            yield indent, key, "\n".join(b[base:].rstrip() for b in body).strip(), None
        else:
            yield indent, key, val, None
            i += 1


def parse_nodes(path: Path, facts: list):
    """kg.nodes -> label + immutable inline attrs (c=base)."""
    if not path.exists():
        return
    lines = path.read_text().splitlines()
    cur = None
    for ln in lines:
        s = ln.strip()
        if not s or s.startswith("#"):
            continue
        m = NODE_RE.match(ln)
        if m and "=" not in m.group(2):  # id: label  (not a key=val)
            cur = m.group(2)
            facts.append(fact(cur, "label", m.group(3)))
            continue
    # second pass for attrs (need block handling tied to current node)
    cur = None
    i = 0
    while i < len(lines):
        ln = lines[i]
        s = ln.strip()
        if not s or s.startswith("#"):
            i += 1
            continue
        m = NODE_RE.match(ln)
        if m and "=" not in m.group(2):
            cur = m.group(2)
            i += 1
            continue
        am = ATTR_RE.match(ln)
        if am and cur:
            for _, key, val, _ in read_blocks(lines[i:i + 1] if am.group(3) != "|" else lines[i:]):
                facts.append(fact(cur, key, val))
                break
            # advance past a consumed multiline block
            if am.group(3) == "|":
                indent = len(am.group(1))
                i += 1
                while i < len(lines) and (lines[i].strip() == "" or (len(lines[i]) - len(lines[i].lstrip())) > indent):
                    i += 1
                continue
        i += 1


def parse_attrs(path: Path, facts: list):
    """kg.attrs -> shared indexed attrs (c=base). `key:` then `  value: id id`."""
    if not path.exists():
        return
    key = None
    for ln in path.read_text().splitlines():
        s = ln.rstrip()
        if not s.strip() or s.lstrip().startswith(("#", "@")):
            continue
        indent = len(s) - len(s.lstrip())
        if indent == 0 and s.rstrip().endswith(":"):
            key = s.strip()[:-1]
        elif key and ":" in s:
            val, ids = s.split(":", 1)
            for nid in ids.split():
                facts.append(fact(nid, key, val.strip()))


def parse_schema(path: Path, facts: list):
    """kg.schema -> relation vocab, status defaults, and ACL facts."""
    if not path.exists():
        return
    section, marked = None, set()
    for ln in path.read_text().splitlines():
        s = ln.split("#", 1)[0].rstrip()
        if not s.strip():
            continue
        if s.startswith("@"):
            section = s.strip().split()[0]
            continue
        body = s.strip()
        if section == "@relations":
            facts.append(fact(body.split()[0], "kind", "relation"))
            continue
        if section == "@acl":
            if body.startswith("classes="):
                for cls in [part.strip() for part in body.split("=", 1)[1].split(",") if part.strip()]:
                    facts.append(fact(cls, "kind", "acl_class"))
                continue
            if body.startswith("grant "):
                parts = body.split()
                for cls in parts[2:]:
                    facts.append(fact(parts[1], "can_see", cls, ref=True))
                continue
            if body.startswith("person ") and " = " in body:
                people, role = body[len("person "):].split(" = ", 1)
                for person in [part.strip() for part in people.split(",") if part.strip()]:
                    facts.append(fact(person, "role", role.strip(), ref=True))
                continue
        m = re.match(r"@(\w+)_defaults$", section or "")     # @status_defaults -> lifecycle attr "status"
        if m and "=" in body:
            life = m.group(1)
            if life not in marked:
                facts.append(fact(life, "is_lifecycle", "true"))
                marked.add(life)
            kind, val = body.split("=", 1)
            facts.append(fact(kind.strip(), "lifecycle_default", val.strip()))


def take_attr(lines, i):
    """Read one `key=value` or `key=|` block starting at lines[i]. Returns (key, value, next_i)."""
    m = ATTR_RE.match(lines[i])
    indent, key, val = len(m.group(1)), m.group(2), m.group(3)
    if val == "|":
        body, j = [], i + 1
        while j < len(lines) and (lines[j].strip() == "" or (len(lines[j]) - len(lines[j].lstrip())) > indent):
            body.append(lines[j])
            j += 1
        base = min((len(b) - len(b.lstrip()) for b in body if b.strip()), default=0)
        return key, "\n".join(b[base:].rstrip() for b in body).strip(), j
    return key, val, i + 1


def inline_attrs(s: str) -> dict:
    return {m.group(1): (m.group(2) if m.group(2) is not None else m.group(3))
            for m in re.finditer(r'(\w+)=(?:"([^"]*)"|(\S+))', s)}


def parse_context(path: Path, facts: list):
    """One *.context -> context-entity, status, presence, edge, and slide facts (c=<ctx>)."""
    lines = path.read_text().splitlines()
    ctx, section, akey, slide, present = None, None, None, None, set()
    i, n = 0, len(lines)
    while i < n:
        ln, s = lines[i], lines[i].strip()
        if not s or s.startswith("#"):
            i += 1
            continue
        if s.startswith("@context"):
            a = inline_attrs(s)
            ctx = a.get("id")
            for k in ("seq", "label"):
                if k in a:
                    facts.append(fact(ctx, k, a[k], ctx))
            facts.append(fact(ctx, "kind", "context", ctx))
            section, i = "@context", i + 1
            continue
        if s.startswith("@"):
            section, akey, slide = s.split()[0], None, None
            i += 1
            continue
        if section == "@context" and ATTR_RE.match(ln):       # caption=| etc
            key, val, i = take_attr(lines, i)
            facts.append(fact(ctx, key, val, ctx))
            continue
        if section == "@edges" and "->" in s:                 # src -> tgt rel [k=v]
            left, right = s.split("->", 1)
            src, parts = left.strip(), right.split()
            tgt = parts[0]
            rel = parts[1] if len(parts) > 1 else "rel"
            facts.append(fact(src, rel, tgt, ctx, ref=True))
            present |= {src, tgt}
            i += 1
            continue
        if section == "@attrs":                               # status: \n  value: ids
            if s.endswith(":"):
                akey = s[:-1].strip()
            elif akey and ":" in s:
                val, ids = s.split(":", 1)
                for nid in ids.split():
                    facts.append(fact(nid, akey, val.strip(), ctx))
                    present.add(nid)
            i += 1
            continue
        if section == "@slides":
            m = NODE_RE.match(ln)
            if m and "=" not in m.group(2):                   # slide_id: title
                slide = f"{ctx}:{m.group(2)}"
                facts.append(fact(slide, "kind", "slide", ctx))
                facts.append(fact(slide, "slide_of", ctx, ctx, ref=True))
                facts.append(fact(slide, "title", m.group(3), ctx))
                i += 1
                continue
            if ATTR_RE.match(ln) and slide:
                key, val, i = take_attr(lines, i)
                if key == "nodes":
                    for nid in [x.strip() for x in val.split(",") if x.strip()]:
                        facts.append(fact(slide, "shows", nid, ctx, ref=True))
                        present.add(nid)
                elif key in ("desc", "description"):
                    facts.append(fact(slide, "desc", val, ctx))
                continue
        i += 1
    for nid in sorted(present):
        facts.append(fact(nid, "present", "true", ctx))


def main(argv):
    if len(argv) < 2:
        print("usage: gen_kg_index.py <pack-dir> [out]", file=sys.stderr)
        return 2
    pack = Path(argv[1])
    out = Path(argv[2]) if len(argv) > 2 else pack / "kg.index"
    facts: list[str] = []
    parse_schema(pack / "kg.schema", facts)
    parse_nodes(pack / "kg.nodes", facts)
    parse_attrs(pack / "kg.attrs", facts)
    for cf in sorted(pack.glob("*.context")):
        parse_context(cf, facts)
    out.write_text("\n".join(facts) + "\n")
    print(f"wrote {len(facts)} facts -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
