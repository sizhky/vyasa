from __future__ import annotations

import subprocess
from ipaddress import ip_address
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlencode

from starlette.responses import JSONResponse

from ..api_catalog import publish_api
from ..extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase
from ..runtime_services import get_runtime_services

CODE_SUFFIXES = frozenset({
    ".c", ".cc", ".cpp", ".cs", ".css", ".go", ".h", ".hpp", ".html",
    ".java", ".js", ".jsx", ".json", ".kt", ".mjs", ".php", ".py", ".rb",
    ".rs", ".scss", ".sh", ".sql", ".svelte", ".swift", ".toml", ".ts",
    ".tsx", ".vue", ".yaml", ".yml", ".zsh",
})


def open_in_vscode(
    slug: str,
    *,
    resolve: Callable[[str], Path | None] | None = None,
    launch: Callable[..., object] = subprocess.Popen,
) -> Path:
    resolver = resolve or get_runtime_services().content_path_for_slug
    path = resolver(slug)
    if path is None or not path.is_file():
        raise FileNotFoundError(slug)
    if path.suffix.lower() not in CODE_SUFFIXES:
        raise ValueError(f"Unsupported code file: {path.name}")
    resolved = path.resolve()
    launch(
        ["code", "--goto", str(resolved)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    return resolved


def vscode_symbol_uri(
    slug: str,
    symbol: str,
    *,
    kind: str = "",
    resolve: Callable[[str], Path | None] | None = None,
) -> str:
    resolver = resolve or get_runtime_services().content_path_for_slug
    path = resolver(slug)
    if path is None or not path.is_file():
        raise FileNotFoundError(slug)
    if path.suffix.lower() not in CODE_SUFFIXES:
        raise ValueError(f"Unsupported code file: {path.name}")
    query = {"file": str(path.resolve()), "symbol": symbol}
    if kind:
        query["kind"] = kind
    return f"vscode://yeshwanth.vyasa/open?{urlencode(query)}"


def is_local_request(request: Any) -> bool:
    hostname = str(getattr(request.url, "hostname", "") or "")
    client_host = str(getattr(getattr(request, "client", None), "host", "") or "")

    def is_loopback(value: str) -> bool:
        if value == "localhost":
            return True
        try:
            return ip_address(value).is_loopback
        except ValueError:
            return False

    return is_loopback(hostname) and is_loopback(client_host)


def register_vscode_routes(rt: Callable[..., Any], _runtime: object) -> None:
    @publish_api(
        rt,
        namespace="vscode",
        operation_id="vscode.file.open",
        path="/api/vscode/open",
        methods=("POST",),
        body={
            "path": "Content path such as src/app.py.",
            "symbol": "Optional document symbol name.",
            "kind": "Optional VS Code symbol kind.",
        },
        local_only=True,
    )
    async def open_code(request):
        if not is_local_request(request):
            return JSONResponse({"ok": False, "message": "VS Code opening is local only"}, status_code=403)
        try:
            payload = await request.json()
            if not isinstance(payload, dict):
                raise ValueError("Expected a JSON object")
            slug = str(payload.get("path") or "")
            symbol = str(payload.get("symbol") or "").strip()
            kind = str(payload.get("kind") or "").strip()
            if symbol:
                uri = vscode_symbol_uri(slug, symbol, kind=kind)
                return JSONResponse({"ok": True, "uri": uri}, status_code=202)
            path = open_in_vscode(slug)
        except ValueError as error:
            return JSONResponse({"ok": False, "message": str(error)}, status_code=400)
        except FileNotFoundError:
            return JSONResponse({"ok": False, "message": "Code file not found"}, status_code=404)
        except OSError:
            return JSONResponse({"ok": False, "message": "VS Code command is unavailable"}, status_code=503)
        return JSONResponse({"ok": True, "path": path.name}, status_code=202)


class VSCodeExtension(VyasaExtensionBase):
    def register(self, app: Any) -> None:
        app.routes.add("/api/vscode", register_vscode_routes, methods=("POST",))
        app.assets.bundle(
            AssetBundle(
                "vscode.runtime",
                js=("/static/extensions/vscode/vscode.js",),
                static_dir=Path(__file__).with_name("vscode") / "static",
            )
        )
        app.assets.page(_page_bundles)
        app.layout.main_attrs(_main_attrs)


def _page_bundles(context: dict[str, object]) -> tuple[str, ...]:
    return ("vscode.runtime",) if context.get("mode") == "runtime" else ()


def _main_attrs(_context: dict[str, object]) -> dict[str, str]:
    return {"data-vscode-code-suffixes": ",".join(sorted(CODE_SUFFIXES))}


EXTENSION = VSCodeExtension(
    ExtensionMeta(
        "vscode",
        "route",
        ("cap:route:vscode", "bundle:vscode.runtime", "cap:layout:main_attrs"),
        route_prefixes=("/api/vscode",),
        scope_disable=True,
        description="Opens linked code files in local VS Code.",
    )
)
META = EXTENSION.meta

__all__ = ["CODE_SUFFIXES", "EXTENSION", "META", "is_local_request", "open_in_vscode"]
