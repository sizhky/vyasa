from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Iterable, cast

from starlette.responses import Response

from .layout import build_collapsed_graph
from .items_pack import _tmp_view_sidecar_dir
from .model import parse_tasks_text
from .render import _attach_rendered_node_attrs, _attach_rendered_slide_attrs

ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"


def _base62_digest(text: str, length: int = 8) -> str:
    value = int.from_bytes(hashlib.sha256(text.encode("utf-8")).digest(), "big")
    chars = []
    for _ in range(length):
        value, rem = divmod(value, len(ALNUM))
        chars.append(ALNUM[rem])
    return "".join(chars)


def _quote_schema_value(value: str) -> str:
    text = str(value or "")
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _view_sidecar_text(title: str, pasted: str) -> tuple[str, str]:
    digest = _base62_digest(f"{title}\n{pasted}")
    view_id = f"tmp.{digest}"
    lines = [line for line in str(pasted or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    lines = [line for line in lines if line.strip() and not line.lstrip().startswith("#")]
    start = next((idx for idx, line in enumerate(lines) if not line.startswith((" ", "\t")) and line.strip().endswith(":")), -1)
    body = lines[start + 1:] if start >= 0 else lines
    body = [line.strip() for line in body if line.strip() and not line.strip().startswith("label=")]
    if not body:
        raise ValueError("Pasted view has no settings")
    out = [f"{view_id}:", f"\tlabel={_quote_schema_value(title)}"]
    out.extend(f"\t{line}" for line in body)
    return view_id, "\n".join(out) + "\n"


def _allowed_roots(runtime) -> list[Path]:
    roots = [runtime.config.get_root_folder().resolve()]
    get_extra = getattr(runtime.config, "get_vyasa_roots", None)
    if callable(get_extra):
        roots.extend(path.resolve() for path in cast(Iterable[Path], get_extra()))
    return roots


def _safe_schema_path(runtime, raw_path: str) -> Path:
    schema_path = Path(str(raw_path or "")).expanduser().resolve()
    if not schema_path.exists() or not (schema_path.name == "kg.schema" or schema_path.name.endswith(".kg.schema")):
        raise ValueError("Unknown KG schema")
    if not any(schema_path == root or root in schema_path.parents for root in _allowed_roots(runtime)):
        raise ValueError("KG schema outside configured roots")
    return schema_path


def _compile_schema_payload(schema_path: Path, current_path: str = "", context_id: str = "") -> tuple[dict, dict]:
    context_line = f"kg_context_id: {context_id}\n" if context_id else ""
    source = f"```items\n---\nitems_schema: {schema_path}\n{context_line}---\n```"
    model = parse_tasks_text(source, current_path=current_path or schema_path)
    _attach_rendered_node_attrs(model, current_path or str(schema_path))
    _attach_rendered_slide_attrs(model, current_path or str(schema_path))
    return model, build_collapsed_graph(model)


def _perf_log_path(host: str, path: str) -> Path:
    safe_host = "".join(ch if ch.isalnum() or ch in ".-" else "-" for ch in str(host or "unknown"))[:80]
    digest = hashlib.sha256(f"{host}\n{path}".encode("utf-8")).hexdigest()[:12]
    return Path("/tmp") / f"vyasa-tasks-perf-{safe_host}-{digest}.ndjson"


def register_tasks_routes(rt, runtime) -> None:
    @rt("/api/tasks/views", methods=["POST"])
    async def save_tmp_view(request):
        try:
            payload = json.loads((await request.body()).decode("utf-8"))
            title = str(payload.get("title") or "").strip()
            pasted = str(payload.get("content") or "").strip()
            schema_path = _safe_schema_path(runtime, str(payload.get("schema_path") or ""))
            if not title or not pasted:
                return Response("Missing title or view content", status_code=400)
            view_id, view_text = _view_sidecar_text(title, pasted)
            view_dir = cast(Path, _tmp_view_sidecar_dir(schema_path))
            view_dir.mkdir(parents=True, exist_ok=True)
            view_path = view_dir / f"{view_id}.view"
            view_path.write_text(view_text, encoding="utf-8")
            model, graph = _compile_schema_payload(schema_path, str(payload.get("current_path") or ""))
        except ValueError as exc:
            return Response(str(exc), status_code=400)
        except Exception as exc:
            runtime.logger.exception("[tasks] failed to save tmp view")
            return Response(str(exc), status_code=500)
        return Response(
            json.dumps({"ok": True, "projection_id": view_id, "file": view_path.name, "model": model, "graph": graph}),
            media_type="application/json",
            headers={"Cache-Control": "no-store"},
        )

    @rt("/api/tasks/context", methods=["POST"])
    async def switch_context(request):
        try:
            payload = json.loads((await request.body()).decode("utf-8"))
            schema_path = _safe_schema_path(runtime, str(payload.get("schema_path") or ""))
            context_id = str(payload.get("context_id") or "").strip()
            if not context_id:
                return Response("Missing context id", status_code=400)
            model, graph = _compile_schema_payload(schema_path, str(payload.get("current_path") or ""), context_id)
        except ValueError as exc:
            return Response(str(exc), status_code=400)
        except Exception as exc:
            runtime.logger.exception("[tasks] failed to switch context")
            return Response(str(exc), status_code=500)
        return Response(
            json.dumps({"ok": True, "context_id": context_id, "model": model, "graph": graph}),
            media_type="application/json",
            headers={"Cache-Control": "no-store"},
        )

    @rt("/api/tasks/perf-log", methods=["POST"])
    async def write_perf_log(request):
        try:
            payload = json.loads((await request.body()).decode("utf-8"))
            host = str(payload.get("host") or "")
            path = str(payload.get("path") or "")
            event = {
                "label": str(payload.get("label") or ""),
                "at": str(payload.get("at") or ""),
                "payload": payload.get("payload") if isinstance(payload.get("payload"), dict) else {},
            }
            log_path = _perf_log_path(host, path)
            if payload.get("reset") is True:
                log_path.write_text("", encoding="utf-8")
            with log_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(event, separators=(",", ":")) + "\n")
        except Exception as exc:
            runtime.logger.exception("[tasks] failed to write perf log")
            return Response(str(exc), status_code=500)
        return Response(
            json.dumps({"ok": True, "file": str(log_path)}),
            media_type="application/json",
            headers={"Cache-Control": "no-store"},
        )
