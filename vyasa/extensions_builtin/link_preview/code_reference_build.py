"""Static-build verification for code references.

`vyasa build` renders every document first, which fills the report with the
references it met. This provider then resolves each one and fails the build
on an author error. Warnings are printed and do not stop the build.
"""

from __future__ import annotations

from .code_reference import (
    CodeReference,
    CodeReferenceError,
    Diagnostic,
    resolve_code_reference,
)
from .code_reference_markdown import REPORT, reference_slug


class CodeReferenceBuildError(RuntimeError):
    """Raised when a static build meets an invalid code reference."""


def _resolve_record(record) -> Diagnostic | None:
    from .routes import _resolve_preview_file

    try:
        reference = CodeReference.parse(record.reference_attrs)
    except CodeReferenceError as exc:
        return Diagnostic(exc.code, str(exc))
    slug = reference_slug(record.document, record.href)
    file_path = _resolve_preview_file(slug)
    if file_path is None:
        return Diagnostic("path_not_found", f"No content file for {record.href}")
    try:
        resolved = resolve_code_reference(file_path, reference, allow_worktree=False)
    except CodeReferenceError as exc:
        return Diagnostic(exc.code, str(exc))
    return resolved.diagnostics[0] if resolved.diagnostics else None


def verify_code_references(_context=None) -> None:
    """Resolve every collected reference, print the summary, fail on errors.

    The report is cleared afterwards so a second build in the same process
    starts from the references that build actually rendered.
    """
    for index, record in enumerate(list(REPORT.records)):
        if record.diagnostic is None:
            diagnostic = _resolve_record(record)
            if diagnostic is not None:
                REPORT.replace(index, diagnostic)
    if not REPORT.records:
        return
    for line in REPORT.report_lines():
        print(line)
    errors = REPORT.errors
    first = errors[0] if errors else None
    REPORT.clear()
    if first is not None:
        raise CodeReferenceBuildError(
            f"{len(errors)} invalid code reference(s); first: "
            f"{first.diagnostic.code} in {first.document or '?'} -> {first.href}"
        )
