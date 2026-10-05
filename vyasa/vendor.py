"""Offline mirror of the CDN libraries Vyasa loads.

`python -m vyasa.vendor` downloads every library into VENDOR_DIR and writes
`index.json`, which is an import map: {"imports": {cdn_url_or_prefix: local_url}}.
The server mounts VENDOR_DIR at /static/vendor and emits the map before any module
script, so ESM imports resolve locally; `vendor_url` rewrites classic script/link URLs.
Without a mirror, and in static builds (which never mount it), every URL stays on its CDN.
"""
from __future__ import annotations

import copy
import hashlib
import io
import json
import os
import re
import sys
import tarfile
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path
from typing import Callable

VENDOR_DIR = Path(os.environ.get("VYASA_VENDOR_DIR", Path.home() / ".cache" / "vyasa" / "vendor"))
VENDOR_ROUTE = "/static/vendor"
INDEX_NAME = "index.json"
_mounted = False
BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

# (CDN prefix, npm spec, package paths to keep). The prefix maps onto the tarball's package/ root.
PACKAGES = (
    ("https://cdn.jsdelivr.net/npm/uikit@3.16.14/", "uikit@3.16.14", ("dist",)),
    ("https://cdn.jsdelivr.net/npm/katex@0.16.9/", "katex@0.16.9", ("dist",)),
    ("https://cdn.jsdelivr.net/npm/mermaid@11/", "mermaid@11", ("dist",)),
    ("https://unpkg.com/react@18/", "react@18", ("umd",)),
    ("https://unpkg.com/react-dom@18/", "react-dom@18", ("umd",)),
    ("https://unpkg.com/@xyflow/react@12.8.4/", "@xyflow/react@12.8.4", ("dist/umd", "dist/style.css")),
    ("https://unpkg.com/@excalidraw/excalidraw@0.17.6/", "@excalidraw/excalidraw@0.17.6", ("dist",)),
    ("https://unpkg.com/@babel/standalone/", "@babel/standalone", ("babel.min.js",)),
    ("https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/", "@highlightjs/cdn-assets@11.9.0", ("highlight.min.js", "styles")),
)
# Single files: (url, extension the local copy needs for its MIME type).
FILES = (
    ("https://unpkg.com/hyperscript.org@0.9.12", ".js"),
    ("https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio,container-queries", ".js"),
)
# esm.sh entry modules; their absolute "/..." imports are crawled and rewritten to https://esm.sh/...
ESM_ENTRIES = (
    "https://esm.sh/vega-embed@6.26.0?bundle",
    "https://esm.sh/elkjs@0.10.0",
    "https://esm.sh/@terrastruct/d2@0.1.33?bundle",
)
FONT_CSS = (
    "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap",
)


@lru_cache(maxsize=1)
def _index(mtime_ns: int) -> dict[str, str]:
    try:
        return json.loads((VENDOR_DIR / INDEX_NAME).read_text()).get("imports", {})
    except (OSError, ValueError):
        return {}


def vendor_imports() -> dict[str, str]:
    try:
        return _index((VENDOR_DIR / INDEX_NAME).stat().st_mtime_ns)
    except OSError:
        return {}


def resolve(url: str, imports: dict[str, str]) -> str:
    """Resolve like a browser import map: exact key first, then the longest "/" prefix.

    >>> resolve("https://x/a@1/dist/a.js", {"https://x/a@1/": "/v/a@1/"})
    '/v/a@1/dist/a.js'
    >>> resolve("https://x/b.js", {"https://x/a@1/": "/v/a@1/"})
    'https://x/b.js'
    """
    if url in imports:
        return imports[url]
    prefixes = [key for key in imports if key.endswith("/") and url.startswith(key)]
    if not prefixes:
        return url
    prefix = max(prefixes, key=len)
    return imports[prefix] + url[len(prefix):]


def vendor_url(url: str) -> str:
    """Return the local mirror URL for a CDN URL when the server mounts the mirror and the file exists."""
    if not _mounted:
        return url
    local = resolve(url, vendor_imports())
    if local == url or not (VENDOR_DIR / local.removeprefix(VENDOR_ROUTE + "/").split("?")[0]).is_file():
        return url
    return local


def vendor_hdrs(hdrs: list) -> list:
    """Prepend the import map and point every CDN src/href header at the mirror."""
    from fasthtml.common import Script

    localized = []
    for hdr in hdrs:
        attrs = getattr(hdr, "attrs", None) or {}
        changed = {key: vendor_url(attrs[key]) for key in ("src", "href") if str(attrs.get(key, "")).startswith("http")}
        if any(changed[key] != attrs[key] for key in changed):
            hdr = copy.copy(hdr)
            hdr.attrs = {**attrs, **changed}
        localized.append(hdr)
    imports = vendor_imports() if _mounted else {}
    import_map = Script(json.dumps({"imports": imports}), type="importmap", id="vyasa-vendor-imports")
    return [import_map, *localized] if imports else localized


def mount_vendor(app) -> None:
    """Serve the mirror before the package /static mount, which would shadow it."""
    global _mounted
    from starlette.routing import Mount
    from starlette.staticfiles import StaticFiles

    if (VENDOR_DIR / INDEX_NAME).is_file():
        app.router.routes.insert(0, Mount(VENDOR_ROUTE, StaticFiles(directory=str(VENDOR_DIR)), name="vendor"))
        _mounted = True


# Downloader

def _fetch(url: str, headers: dict | None = None) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": BROWSER_UA, **(headers or {})})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def _local_rel(url: str, ext: str = "") -> str:
    """Mirror path for a URL: host/path, plus a query hash and a MIME-safe extension.

    >>> _local_rel("https://unpkg.com/hyperscript.org@0.9.12", ".js")
    'unpkg.com/hyperscript.org@0.9.12.js'
    >>> _local_rel("https://esm.sh/a@1?bundle", ".mjs")
    'esm.sh/a@1-d59795de.mjs'
    """
    parts = urllib.parse.urlsplit(url)
    rel = parts.netloc + (parts.path.rstrip("/") or "/index")
    if parts.query:
        rel += "-" + hashlib.sha1(parts.query.encode()).hexdigest()[:8]
    if ext and not rel.endswith(ext):
        rel += ext
    return rel


def _write(rel: str, data: bytes) -> str:
    target = (VENDOR_DIR / rel).resolve()
    if VENDOR_DIR.resolve() not in target.parents:
        raise ValueError(f"unsafe path {rel}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return f"{VENDOR_ROUTE}/{rel}"


def _version_key(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in version.split("."))


def _resolve_npm(name: str, spec: str) -> str:
    doc = json.loads(_fetch(f"https://registry.npmjs.org/{urllib.parse.quote(name, safe='@')}",
                            {"Accept": "application/vnd.npm.install-v1+json"}))
    if not spec or spec in doc["dist-tags"]:
        return doc["versions"][doc["dist-tags"].get(spec or "latest")]["dist"]["tarball"]
    candidates = [v for v in doc["versions"] if "-" not in v and (v == spec or v.startswith(spec + "."))]
    if not candidates:
        raise ValueError(f"no npm version for {name}@{spec}")
    return doc["versions"][max(candidates, key=_version_key)]["dist"]["tarball"]


def _vendor_package(prefix: str, spec: str, keep: tuple[str, ...]) -> dict[str, str]:
    name, _, version = spec.rpartition("@") if spec.count("@") > spec.startswith("@") else (spec, "", "")
    base = _local_rel(prefix)
    with tarfile.open(fileobj=io.BytesIO(_fetch(_resolve_npm(name, version))), mode="r:gz") as archive:
        for member in archive.getmembers():
            rel = member.name.split("/", 1)[-1]
            data = archive.extractfile(member) if member.isfile() else None
            if data and any(rel == path or rel.startswith(path + "/") for path in keep):
                _write(f"{base}/{rel}", data.read())
    return {prefix: f"{VENDOR_ROUTE}/{base}/"}


ESM_SPECIFIER = re.compile(r"""(\bfrom\s*|\bimport\s*\(?\s*)(["'])((?:https://esm\.sh)?/[^"']+|\.{1,2}/[^"']+)\2""")


def _vendor_esm(entry: str) -> dict[str, str]:
    imports, pending, seen = {}, [entry], set()
    while pending:
        url = pending.pop()
        if url in seen:
            continue
        seen.add(url)
        source = _fetch(url).decode()

        def rewrite(match: re.Match) -> str:
            target = urllib.parse.urljoin(url, match.group(3))
            pending.append(target)
            return f"{match.group(1)}{match.group(2)}{target}{match.group(2)}"

        imports[url] = _write(_local_rel(url, ".mjs"), ESM_SPECIFIER.sub(rewrite, source).encode())
    return imports


def _vendor_font_css(url: str) -> dict[str, str]:
    css = _fetch(url).decode()
    for font_url in set(re.findall(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", css)):
        css = css.replace(font_url, _write(_local_rel(font_url), _fetch(font_url)))
    return {url: _write(_local_rel(url, ".css"), css.encode())}


def _header_files() -> list[tuple[str, str]]:
    """CDN files FastHTML and MonsterUI add to every page head."""
    from fasthtml.core import def_hdrs, htmx_exts
    from monsterui.all import Theme

    hdrs = [*def_hdrs(), *Theme.slate.headers(highlightjs=False)]
    urls = [getattr(h, "attrs", {}).get(key) for h in hdrs for key in ("src", "href")] + [htmx_exts["ws"]]
    return [(u, ".css" if u.endswith(".css") else ".js") for u in urls if isinstance(u, str) and u.startswith("http")]


def _vendor_file(url: str, ext: str) -> dict[str, str]:
    return {url: _write(_local_rel(url, ext), _fetch(url))}


def main() -> int:
    jobs: list[tuple[Callable[..., dict[str, str]], tuple]] = [(_vendor_package, args) for args in PACKAGES]
    jobs += [(_vendor_file, args) for args in (*FILES, *_header_files())]
    jobs += [(_vendor_esm, (url,)) for url in ESM_ENTRIES]
    jobs += [(_vendor_font_css, (url,)) for url in FONT_CSS]
    imports: dict[str, str] = {}
    failures = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fn, *args): args[0] for fn, args in jobs}
        for future, label in futures.items():
            try:
                imports.update(future.result())
                print(f"ok   {label}")
            except Exception as error:
                failures += 1
                print(f"FAIL {label}: {error}", file=sys.stderr)
    VENDOR_DIR.mkdir(parents=True, exist_ok=True)
    (VENDOR_DIR / INDEX_NAME).write_text(json.dumps({"imports": dict(sorted(imports.items()))}, indent=1))
    print(f"{len(imports)} entries -> {VENDOR_DIR / INDEX_NAME}; {failures} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
