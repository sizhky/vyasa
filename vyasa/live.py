"""Reusable live-channel transport primitives for Vyasa core.

Extensions push resource-change events to open pages without per-second HTTP
polling. The change source is a transport-agnostic async generator (``watch_path``);
``sse_stream`` and ``serve_ws`` are the two deliveries over it. Add a new transport
by writing another consumer of the same generator -- components never change.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Callable
from pathlib import Path

from starlette.responses import StreamingResponse
from starlette.websockets import WebSocketDisconnect

_HEARTBEAT_SECONDS = 25


def file_revision(file_path: Path) -> str:
    """Monotonic change token for a file: its mtime in nanoseconds (``"0"`` if absent).

    Returned as a string: mtime_ns exceeds JavaScript's safe-integer range, so a
    numeric JSON value would lose precision on the client and break round-trips.
    """
    try:
        return str(file_path.stat().st_mtime_ns)
    except FileNotFoundError:
        return "0"


async def watch_path(
    file_path: Path,
    *,
    revision: Callable[[Path], str] = file_revision,
) -> AsyncIterator[dict]:
    """Yield ``{"type": "change", "revision": ...}`` whenever ``file_path`` changes.

    Emits a ``ready`` event first, then one ``change`` per revision transition.
    Starlette cancels this generator when the client disconnects. Falls back to a
    keepalive-only stream when ``watchfiles`` is unavailable.
    """
    last = revision(file_path)
    yield {"type": "ready", "revision": last}
    try:
        from watchfiles import awatch
    except ImportError:
        while True:
            await asyncio.sleep(_HEARTBEAT_SECONDS)
            yield {"type": "ping"}
    async for _changes in awatch(str(file_path.parent)):
        current = revision(file_path)
        if current != last:
            last = current
            yield {"type": "change", "revision": current}


def _encode_sse(event: dict) -> str:
    kind = event.get("type", "message")
    if kind == "ping":
        return ": ping\n\n"
    payload = json.dumps({key: value for key, value in event.items() if key != "type"})
    return f"event: {kind}\ndata: {payload}\n\n"


def sse_stream(events: AsyncIterator[dict]) -> StreamingResponse:
    """Deliver a change-event generator as a Server-Sent Events response."""

    async def body() -> AsyncIterator[str]:
        async for event in events:
            yield _encode_sse(event)

    return StreamingResponse(
        body(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


async def serve_ws(websocket, events: AsyncIterator[dict]) -> None:
    """Deliver the same change-event generator over a WebSocket (future transport)."""
    await websocket.accept()
    try:
        async for event in events:
            if event.get("type") == "ping":
                continue
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except RuntimeError:
            pass
