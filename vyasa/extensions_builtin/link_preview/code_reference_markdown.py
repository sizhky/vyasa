"""Markdown integration for code references.

A code reference is a normal Markdown link followed by `{key=value ...}` on
the same line. This module consumes those braces before the standard link
token sees them, carries the attributes through the renderer in a private
query parameter, and hands the renderer a clean `href` plus normalized JSON.

It also keeps the build report, so `vyasa build` can fail on author errors
and print one summary line.
"""

from __future__ import annotations

import json
import posixpath
import re
import shlex
from dataclasses import dataclass, field
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit

from .code_reference import (
    ATTRIBUTE_PAYLOAD_LIMIT,
    CODE_REFERENCE_KEYS,
    CodeReference,
    CodeReferenceError,
    Diagnostic,
)

# Private carrier between the preprocessor and `render_link`. It never reaches
# a rendered `href`: `extract_code_reference` strips it again.
CODE_REFERENCE_QUERY = "__vyasa_code_reference"

_REFERENCE_RE = re.compile(
    r"\[(?P<label>[^\]\n]*)\]\((?P<href>[^)\s\n]+)(?P<title>\s+\"[^\"\n]*\")?\)"
    r"\{(?P<attrs>[^{}\n]+)\}"
)
# Fenced and inline code keep braces literal, so stash them before matching.
_PROTECTED_RE = re.compile(r"(```+|~~~+)[\s\S]*?\1|(`+)[^`\n]*?\2")
_PROTECTED_TOKEN = "VYASACODEREFPROTECTED{index}TOKEN"


def parse_code_reference_attrs(text: str) -> dict[str, str] | None:
    """Parse `{change=abc show=file focus="ln[1,4]"}` into a dict.

    Returns None when the braces are not a code-reference list, so ordinary
    text such as `[a](b){not a reference}` stays untouched.

    >>> parse_code_reference_attrs('change=dc4967f show=file')
    {'change': 'dc4967f', 'show': 'file'}
    >>> parse_code_reference_attrs('some prose') is None
    True
    """
    try:
        parts = shlex.split(str(text).strip())
    except ValueError:
        return None
    if not parts:
        return None
    attrs: dict[str, str] = {}
    for part in parts:
        key, sep, value = part.partition("=")
        if not sep or key not in CODE_REFERENCE_KEYS or not value:
            return None
        attrs[key] = value
    return attrs


def embed_code_reference(href: str, attrs: dict[str, str]) -> str:
    """Attach the normalized payload to `href` for the renderer to pick up."""
    parsed = urlsplit(href)
    query = parse_qsl(parsed.query, keep_blank_values=True)
    query.append((CODE_REFERENCE_QUERY, normalized_payload(attrs)))
    return urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment)
    )


def normalized_payload(attrs: dict[str, str]) -> str:
    """Stable JSON for one attribute list."""
    payload = json.dumps(attrs, separators=(",", ":"), sort_keys=True)
    if len(payload.encode("utf-8")) > ATTRIBUTE_PAYLOAD_LIMIT:
        raise CodeReferenceError("limit_exceeded", "Attribute payload is larger than 4 KiB")
    return payload


def extract_code_reference(href: str) -> tuple[str, str]:
    """Split a rendered `href` into (clean href, code-reference JSON)."""
    if CODE_REFERENCE_QUERY not in (href or ""):
        return href, ""
    parsed = urlsplit(href)
    payload = ""
    clean_query: list[tuple[str, str]] = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        if key == CODE_REFERENCE_QUERY:
            payload = unquote(value)
        else:
            clean_query.append((key, value))
    clean = urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, urlencode(clean_query), parsed.fragment)
    )
    return clean, payload


def parse_code_reference_json(payload: str) -> CodeReference:
    """Validate a JSON payload and return normalized author intent."""
    if len(str(payload).encode("utf-8")) > ATTRIBUTE_PAYLOAD_LIMIT:
        raise CodeReferenceError("limit_exceeded", "Attribute payload is larger than 4 KiB")
    try:
        value = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise CodeReferenceError("invalid_attribute", "Invalid code reference JSON") from exc
    if not isinstance(value, dict) or not all(
        isinstance(key, str) and isinstance(item, str) for key, item in value.items()
    ):
        raise CodeReferenceError(
            "invalid_attribute", "Code reference JSON must be an object of strings"
        )
    return CodeReference.parse(value)


# --- build report -------------------------------------------------------


@dataclass(frozen=True)
class CodeReferenceRecord:
    """One authored reference, with the document that owns it."""

    document: str
    href: str
    attrs: tuple[tuple[str, str], ...]
    diagnostic: Diagnostic | None = None

    @property
    def reference_attrs(self) -> dict[str, str]:
        return dict(self.attrs)

    @property
    def severity(self) -> str:
        return self.diagnostic.severity if self.diagnostic else "valid"


@dataclass
class CodeReferenceReport:
    """Collects references seen while rendering, for the build summary."""

    records: list[CodeReferenceRecord] = field(default_factory=list)
    _index: dict[tuple[str, str, tuple], int] = field(default_factory=dict, repr=False)

    def clear(self) -> None:
        self.records.clear()
        self._index.clear()

    def add(self, record: CodeReferenceRecord) -> int:
        """Record one reference. A re-render of the same link reuses its slot,
        so a long-lived dev server does not grow the report without bound."""
        key = (record.document, record.href, record.attrs)
        if key in self._index:
            return self._index[key]
        self.records.append(record)
        self._index[key] = len(self.records) - 1
        return self._index[key]

    def replace(self, index: int, diagnostic: Diagnostic) -> None:
        record = self.records[index]
        self.records[index] = CodeReferenceRecord(
            record.document, record.href, record.attrs, diagnostic
        )

    @property
    def errors(self) -> list[CodeReferenceRecord]:
        return [item for item in self.records if item.severity == "error"]

    @property
    def warnings(self) -> list[CodeReferenceRecord]:
        return [item for item in self.records if item.severity == "warning"]

    def summary(self) -> str:
        valid = len(self.records) - len(self.errors) - len(self.warnings)
        return (
            f"code references: {valid} valid, {len(self.warnings)} warnings, "
            f"{len(self.errors)} errors"
        )

    def groups(self) -> dict[str, dict[str, int]]:
        """Counts grouped by role, show, focus, and diagnostic code."""
        grouped: dict[str, dict[str, int]] = {
            "role": {}, "show": {}, "focus": {}, "diagnostic": {}
        }
        for record in self.records:
            attrs = record.reference_attrs
            for key, default in (("role", "implementation"), ("show", "file"), ("focus", "all")):
                bucket = grouped[key]
                name = attrs.get(key, default)
                bucket[name] = bucket.get(name, 0) + 1
            if record.diagnostic:
                bucket = grouped["diagnostic"]
                code = record.diagnostic.code
                bucket[code] = bucket.get(code, 0) + 1
        return grouped

    def report_lines(self) -> list[str]:
        lines = [self.summary()]
        for key, counts in self.groups().items():
            if counts:
                joined = ", ".join(f"{name}={count}" for name, count in sorted(counts.items()))
                lines.append(f"  {key}: {joined}")
        for record in self.errors + self.warnings:
            lines.append(
                f"  {record.diagnostic.severity}: {record.diagnostic.code} "
                f"in {record.document or '?'} -> {record.href} ({record.diagnostic.message})"
            )
        return lines


REPORT = CodeReferenceReport()


def reference_slug(document: str, href: str) -> str:
    """Content slug a reference points at, relative to its document."""
    path = unquote(urlsplit(href).path or "")
    if path.startswith("/posts/"):
        return path[len("/posts/"):].strip("/")
    if path.startswith("/"):
        return path.strip("/")
    base = posixpath.dirname(str(document or ""))
    return posixpath.normpath(posixpath.join(base, path)).lstrip("./")


# --- preprocessing ------------------------------------------------------


def preprocess_code_references(markdown: str, context=None, state=None) -> str:
    """Move `{...}` attribute lists off the Markdown and into the href."""
    document = getattr(context, "current_path", "") or ""
    protected: list[str] = []

    def stash(match: re.Match[str]) -> str:
        protected.append(match.group(0))
        return _PROTECTED_TOKEN.format(index=len(protected) - 1)

    safe = _PROTECTED_RE.sub(stash, markdown)

    def replace(match: re.Match[str]) -> str:
        attrs = parse_code_reference_attrs(match.group("attrs"))
        if attrs is None:
            return match.group(0)
        index = REPORT.add(
            CodeReferenceRecord(document, match.group("href"), tuple(sorted(attrs.items())))
        )
        try:
            CodeReference.parse(attrs)
            href = embed_code_reference(match.group("href"), attrs)
        except CodeReferenceError as exc:
            REPORT.replace(index, Diagnostic(exc.code, str(exc)))
            return match.group(0)
        return f'[{match.group("label")}]({href}{match.group("title") or ""})'

    safe = _REFERENCE_RE.sub(replace, safe)
    for index, value in enumerate(protected):
        safe = safe.replace(_PROTECTED_TOKEN.format(index=index), value)
    return safe
