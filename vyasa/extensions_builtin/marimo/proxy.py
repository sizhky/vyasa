"""Reverse proxy from `/marimo/<name>/...` to a marimo-studio server on a private address.

`.vyasa` names each server:

    [marimo_servers.lln]
    upstream = "http://127.0.0.1:2721"     # started with --base-url /marimo/lln
    token_file = "/secure/path/lln.token"  # optional: the --token-password-file

Access rules:
- Studio serves its view pages without checking marimo's token, then attaches the token itself
  to capability requests. So a view page is the gate: it needs the RBAC role for its path,
  which Vyasa's auth gate checks before this handler runs.
- Capability paths (`/_marimo-studio/presentation/...`) skip the auth gate, because the sandboxed
  frame sends no cookies. Only an unlocked page can mint them, and Studio validates them.
- Websockets are allowed only on capability paths; the auth gate does not run for websockets.
- marimo's cookies are stripped both ways, so locking again takes effect for new pages.
"""
import asyncio
from pathlib import Path

import httpx
import websockets
from starlette.background import BackgroundTask
from starlette.responses import Response, StreamingResponse

PREFIX = "/marimo"
CAPABILITY = "/_marimo-studio/presentation/"
REQUEST_DROP = {"host", "cookie", "authorization", "connection", "keep-alive", "transfer-encoding", "upgrade", "content-length", "accept-encoding"}
RESPONSE_DROP = {"set-cookie", "content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"}
_client: httpx.AsyncClient | None = None


def servers() -> dict:
    from ...config import get_config
    return get_config().get_marimo_servers()


def is_capability(name: str, path: str) -> bool:
    """
    >>> is_capability("lln", "/marimo/lln/_marimo-studio/presentation/d.abc/lln/")
    True
    >>> is_capability("lln", "/marimo/lln/lln/"), is_capability("lln", "/marimo/other/_marimo-studio/presentation/x")
    (False, False)
    """
    return path.startswith(f"{PREFIX}/{name}{CAPABILITY}")


def upstream_headers(conn, server: dict, capability: bool) -> dict:
    """Browser headers minus hop-by-hop, cookies, and websocket handshake; plus marimo's token outside capability paths.

    >>> from types import SimpleNamespace
    >>> conn = SimpleNamespace(headers={"Cookie": "a=1", "Sec-WebSocket-Key": "k", "Accept": "*/*"})
    >>> upstream_headers(conn, {"token": "t"}, capability=False)
    {'Accept': '*/*', 'authorization': 'Bearer t'}
    >>> upstream_headers(conn, {"token": "t"}, capability=True)
    {'Accept': '*/*'}
    """
    headers = {k: v for k, v in conn.headers.items()
               if k.lower() not in REQUEST_DROP and not k.lower().startswith("sec-websocket-")}
    if server.get("token") and not capability:
        headers["authorization"] = f"Bearer {server['token']}"
    return headers


def server_with_token(server: dict) -> dict:
    token_file = server.get("token_file")
    if not token_file:
        return server
    try:
        return {**server, "token": Path(token_file).expanduser().read_text(encoding="utf-8").strip()}
    except OSError:
        return server


async def http_proxy(request):
    global _client
    name = request.path_params["name"]
    server = servers().get(name)
    if not server:
        return Response("Unknown marimo server", status_code=404)
    server = server_with_token(server)
    _client = _client or httpx.AsyncClient(timeout=httpx.Timeout(60, read=None))
    url = httpx.URL(server["upstream"].rstrip("/") + request.url.path, query=request.url.query.encode())
    upstream_request = _client.build_request(
        request.method, url, content=await request.body(),
        headers=upstream_headers(request, server, is_capability(name, request.url.path)))
    try:
        upstream = await _client.send(upstream_request, stream=True)
    except httpx.HTTPError:
        return Response("Marimo server unavailable", status_code=502)
    headers = {k: v for k, v in upstream.headers.items() if k.lower() not in RESPONSE_DROP}
    return StreamingResponse(upstream.aiter_raw(), status_code=upstream.status_code, headers=headers,
                             background=BackgroundTask(upstream.aclose))


async def ws_proxy(websocket):
    name = websocket.path_params["name"]
    server = servers().get(name)
    if not server or not is_capability(name, websocket.url.path):
        await websocket.close(code=4403)
        return
    server = server_with_token(server)
    ws_upstream = server["upstream"].replace("http://", "ws://", 1).replace("https://", "wss://", 1).rstrip("/")
    query = f"?{websocket.url.query}" if websocket.url.query else ""
    try:
        upstream = await websockets.connect(
            f"{ws_upstream}{websocket.url.path}{query}", max_size=None,
            additional_headers=upstream_headers(websocket, server, capability=True),
            subprotocols=websocket.scope.get("subprotocols") or None)
    except Exception:
        await websocket.close(code=4502)
        return
    await websocket.accept(subprotocol=upstream.subprotocol)

    async def browser_to_marimo():
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                return
            await upstream.send(message["text"] if message.get("text") is not None else message.get("bytes"))

    async def marimo_to_browser():
        async for data in upstream:
            await (websocket.send_text(data) if isinstance(data, str) else websocket.send_bytes(data))

    tasks = [asyncio.create_task(browser_to_marimo()), asyncio.create_task(marimo_to_browser())]
    await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    for task in tasks:
        task.cancel()
    await upstream.close()


def register_marimo_proxy(rt, runtime) -> None:
    methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
    rt(f"{PREFIX}/{{name}}/{{path:path}}", methods=methods)(http_proxy)
    rt(f"{PREFIX}/{{name}}", methods=methods)(http_proxy)
    # `rt` is the app's route method; websockets need the Starlette router directly.
    rt.__self__.router.add_websocket_route(f"{PREFIX}/{{name}}/{{path:path}}", ws_proxy)
