"""Shared body grammar for every visual in the registry.

One grammar serves the whole registry. Options live in the fence info string.
The body is one row per line, with `|` between cells and trailing `@flag`
tokens.

Pro: a new visual costs one registry entry, and an author learns the syntax
once.
Con: a visual that needs nested data cannot express it inline, so it reads the
data from `src=` instead.
"""

from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

DATA_SUFFIXES = {".json", ".yaml", ".yml", ".csv"}


class VisualError(ValueError):
    """A block the author can fix. Rendered as a visible card, never raised."""


@dataclass(frozen=True)
class Row:
    """One row, addressed by field name rather than by position.

    Inline rows map cells onto the visual's `cell_names`. External rows arrive
    already named. Both reach the renderer in the same shape.
    """

    fields: Mapping[str, str]
    flags: frozenset[str] = frozenset()

    def get(self, name: str, default: str = "") -> str:
        return str(self.fields.get(name, default) or default)


def parse_number(text: object) -> float | None:
    """Read a human-written number, or None when the cell is not numeric.

    >>> parse_number("1,264")
    1264.0
    >>> parse_number("20.1%")
    20.1
    >>> parse_number("n/a") is None
    True
    """
    cleaned = str(text or "").strip().replace(",", "").replace("_", "").rstrip("%")
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def split_flags(line: str) -> tuple[str, frozenset[str]]:
    """Strip trailing `@flag` tokens so a label may still contain an `@`.

    >>> body, flags = split_flags("a@b.com | 3 @accent @wide")
    >>> body, sorted(flags)
    ('a@b.com | 3', ['accent', 'wide'])
    """
    flags: set[str] = set()
    body = line.rstrip()
    while True:
        head, sep, tail = body.rpartition(" @")
        if not sep or not tail or " " in tail:
            break
        flags.add(tail.strip().lower())
        body = head.rstrip()
    if body.startswith("@") and " " not in body:
        flags.add(body[1:].lower())
        body = ""
    return body.strip(), frozenset(flags)


def parse_rows(code: str, cell_names: Sequence[str]) -> list[Row]:
    """Turn the fence body into named rows.

    >>> rows = parse_rows("0-7 days | 117\\n# skipped\\n8-30 | 106 @accent", ("label", "value"))
    >>> [(r.get("label"), r.get("value")) for r in rows]
    [('0-7 days', '117'), ('8-30', '106')]
    >>> sorted(rows[1].flags)
    ['accent']
    """
    rows: list[Row] = []
    for raw in (code or "").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        body, flags = split_flags(line)
        if not body:
            continue
        cells = [cell.strip() for cell in body.split("|")]
        fields = {name: cells[index] for index, name in enumerate(cell_names) if index < len(cells)}
        rows.append(Row(fields, flags))
    return rows


def _dig(payload: Any, dotted: str) -> Any:
    """Walk a dotted path into loaded data so one file can hold many series."""
    current = payload
    for part in (dotted or "").split(".") if dotted else []:
        if isinstance(current, Mapping):
            current = current.get(part)
        elif isinstance(current, Sequence) and part.isdigit():
            current = current[int(part)]
        else:
            return None
    return current


def _load_payload(path: Path) -> Any:
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".json":
        return json.loads(text)
    if path.suffix == ".csv":
        return list(csv.DictReader(io.StringIO(text)))
    import yaml  # frontmatter already depends on PyYAML

    return yaml.safe_load(text)


def rows_from_payload(payload: Any, cell_names: Sequence[str], attrs: Mapping[str, Any]) -> list[Row]:
    """Shape loaded data into rows.

    Accepts a list of objects, a list of pairs, or a mapping of label to value.

    >>> names = ("label", "value")
    >>> [r.get("value") for r in rows_from_payload({"a": 1, "b": 2}, names, {})]
    ['1', '2']
    >>> [r.get("label") for r in rows_from_payload([["a", 1]], names, {})]
    ['a']
    """
    primary, secondary = (list(cell_names) + ["label", "value"])[:2]
    label_key = str(attrs.get("label_key") or "")
    value_key = str(attrs.get("value_key") or "")
    if isinstance(payload, Mapping):
        payload = [[key, value] for key, value in payload.items()]
    if not isinstance(payload, Sequence) or isinstance(payload, (str, bytes)):
        raise VisualError("data must be a list or a mapping")
    rows: list[Row] = []
    for entry in payload:
        if isinstance(entry, Mapping):
            keys = list(entry.keys())
            label = label_key or next((k for k in keys if k in cell_names), keys[0] if keys else "")
            value = value_key or next((k for k in keys[1:] if k != label), label)
            fields = {"label": str(entry.get(label, "")), "value": str(entry.get(value, ""))}
            fields.update({name: str(entry[name]) for name in cell_names if name in entry})
            flags = frozenset(str(entry.get("flags", "")).replace("@", "").split())
        elif isinstance(entry, Sequence) and not isinstance(entry, (str, bytes)):
            cells = list(entry)
            fields = {"label": str(cells[0] if cells else ""), "value": str(cells[1] if len(cells) > 1 else "")}
            flags = frozenset()
        else:
            fields, flags = {"label": str(entry), "value": ""}, frozenset()
        fields.setdefault(primary, fields.get("label", ""))
        fields.setdefault(secondary, fields.get("value", ""))
        rows.append(Row(fields, flags))
    return rows


def resolve_data_path(src: str, current_path: object) -> Path:
    """Thin wrapper so a path problem reaches the author as a visual error."""
    from ...markdown_fence import resolve_fence_data_path

    try:
        return resolve_fence_data_path(src, current_path, DATA_SUFFIXES)
    except ValueError as error:
        raise VisualError(str(error)) from error


def load_rows(attrs: Mapping[str, Any], cell_names: Sequence[str], current_path: object) -> list[Row]:
    path = resolve_data_path(str(attrs.get("src")), current_path)
    payload = _load_payload(path)
    selected = _dig(payload, str(attrs.get("select") or "")) if attrs.get("select") else payload
    if selected is None:
        raise VisualError(f"select path not found: {attrs.get('select')}")
    return rows_from_payload(selected, cell_names, attrs)
