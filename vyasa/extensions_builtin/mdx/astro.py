from __future__ import annotations

from functools import lru_cache
import json
from pathlib import Path
import subprocess


ASTRO_CONFIG_NAMES = ("astro.config.js", "astro.config.mjs", "astro.config.ts", "astro.config.mts")
ASTRO_RUNNER = Path(__file__).parent / "static" / "astro_render.mjs"


class AstroMdxError(RuntimeError):
    pass


def astro_project_for(document: Path) -> Path | None:
    """1.1 Find the Astro project that owns a document."""
    for candidate in (document.parent, *document.parents):
        if any((candidate / name).is_file() for name in ASTRO_CONFIG_NAMES):
            return candidate
    return None


def astro_source_fingerprint(project: Path) -> tuple[int, int]:
    """1.1 Report the current source-tree state for the Astro render cache."""
    newest_mtime = 0
    count = 0
    for name in (*ASTRO_CONFIG_NAMES, "package.json"):
        try:
            newest_mtime = max(newest_mtime, (project / name).stat().st_mtime_ns)
            count += 1
        except OSError:
            continue
    source = project / "src"
    if not source.is_dir():
        return (newest_mtime, count)
    for path in source.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".astro", ".css", ".js", ".jsx", ".md", ".mdx", ".ts", ".tsx"}:
            continue
        try:
            newest_mtime = max(newest_mtime, path.stat().st_mtime_ns)
            count += 1
        except OSError:
            continue
    return (newest_mtime, count)


def render_astro_mdx_body(document: Path) -> str:
    """1.2 Render an Astro-importing MDX document to server HTML."""
    project = astro_project_for(document)  # kg:e1 1.1 -> 1.2
    if project is None:
        raise AstroMdxError("Astro MDX requires an astro.config file above the document.")
    return _render_astro_mdx_cached(project, document.resolve(), astro_source_fingerprint(project))


@lru_cache(maxsize=32)
def _render_astro_mdx_cached(project: Path, document: Path, fingerprint: tuple[int, int]) -> str:
    """1.2 Run the Astro project once for each source-tree state."""
    request = json.dumps({"project": str(project), "document": str(document)})
    try:
        completed = subprocess.run(
            ["node", str(ASTRO_RUNNER)],
            cwd=project,
            input=request,
            capture_output=True,
            check=False,
            text=True,
            timeout=120,
        )
    except FileNotFoundError as error:
        raise AstroMdxError("Astro MDX requires Node.js on the Vyasa host.") from error
    except subprocess.TimeoutExpired as error:
        raise AstroMdxError("Astro MDX did not finish within 120 seconds.") from error
    result = _result_from_output(completed.stdout)
    if result is None:
        detail = completed.stderr.strip() or completed.stdout.strip() or "Astro returned no result."
        raise AstroMdxError(detail)
    if completed.returncode or not result.get("html"):
        raise AstroMdxError(str(result.get("error") or completed.stderr.strip() or "Astro did not render the document."))
    return str(result["html"])


def _result_from_output(output: str) -> dict[str, object] | None:
    for line in reversed(output.splitlines()):
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return value
    return None
