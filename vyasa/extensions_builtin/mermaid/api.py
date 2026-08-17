from __future__ import annotations

import hashlib
import json
from pathlib import Path

from starlette.responses import Response


def _debug_log_path(host: str, path: str) -> Path:
    safe_host = "".join(ch if ch.isalnum() or ch in ".-" else "-" for ch in host)[:80]
    digest = hashlib.sha256(f"{host}\n{path}".encode()).hexdigest()[:12]
    return Path("/tmp") / f"vyasa-mermaid-debug-{safe_host}-{digest}.ndjson"


def register_mermaid_routes(rt, runtime) -> None:
    @rt("/api/mermaid/debug-log", methods=["POST"])
    async def write_debug_log(request):
        try:
            raw = await request.body()
            if len(raw) > 64_000:
                return Response("Log event too large", status_code=413)
            payload = json.loads(raw.decode())
            log_path = _debug_log_path(str(payload.get("host") or ""), str(payload.get("path") or ""))
            if payload.get("reset") is True:
                log_path.write_text("", encoding="utf-8")
            event = {key: payload.get(key) for key in ("label", "at", "payload")}
            with log_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(event, separators=(",", ":")) + "\n")
        except Exception as exc:
            runtime.logger.exception("[mermaid] failed to write debug log")
            return Response(str(exc), status_code=500)
        return Response(json.dumps({"ok": True, "file": str(log_path)}), media_type="application/json")
