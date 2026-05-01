from __future__ import annotations

import json

from starlette.responses import Response

from .helpers import content_path_for_slug
from .runtime_context import RuntimeContext
from .tasks_rendering import tasks_fence_payload, write_tasks_fence_payload


def _markdown_file_for_api(path: str):
    file_path = content_path_for_slug(path, ".md")
    if not file_path or not file_path.exists():
        return None
    return file_path


def register_tasks_routes(rt, runtime: RuntimeContext) -> None:
    @rt("/api/tasks/blocks/{path:path}", methods=["GET"])
    async def get_tasks_block(path: str, request, block: int = 0):
        file_path = _markdown_file_for_api(path)
        if not file_path:
            return Response(status_code=404)
        if not runtime.can_read_post(path, request):
            return Response("Forbidden", status_code=403)
        try:
            payload = tasks_fence_payload(file_path, block)
        except IndexError:
            return Response(status_code=404)
        return Response(json.dumps(payload), media_type="application/json")

    @rt("/api/tasks/blocks/{path:path}", methods=["PUT"])
    async def put_tasks_block(path: str, request, block: int = 0):
        file_path = _markdown_file_for_api(path)
        if not file_path:
            return Response(status_code=404)
        if not runtime.can_read_post(path, request):
            return Response("Forbidden", status_code=403)
        try:
            payload = json.loads((await request.body()).decode("utf-8"))
            if not isinstance(payload, dict):
                return Response("Expected JSON object", status_code=400)
            write_tasks_fence_payload(file_path, block, payload)
        except IndexError:
            return Response(status_code=404)
        except json.JSONDecodeError:
            return Response("Invalid JSON", status_code=400)
        except Exception as exc:
            runtime.logger.warning(f"Failed to write tasks block '{path}?block={block}': {exc}")
            return Response("Save failed", status_code=500)
        return Response('{"ok":true}', media_type="application/json")
