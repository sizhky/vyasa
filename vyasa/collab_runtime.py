import asyncio
import json


class CollabRuntime:
    def __init__(self):
        self.rooms = {}
        self.scenes = {}
        self.lock = asyncio.Lock()

    async def broadcast(self, room, payload, exclude=None):
        msg = json.dumps(payload)
        for sock in list(self.rooms.get(room, set())):
            if exclude is not None and sock is exclude:
                continue
            try:
                await sock.send_text(msg)
            except Exception:
                pass

    async def connect(self, ws):
        room = ws.path_params.get("path", "")
        async with self.lock:
            self.rooms.setdefault(room, set()).add(ws)
            scene = self.scenes.get(room)
        if scene is not None:
            await ws.send_text(json.dumps({"type": "scene", "room": room, "scene": scene}))

    async def disconnect(self, ws):
        room = ws.path_params.get("path", "")
        peer_id = ws.scope.get("collab_id")
        async with self.lock:
            peers = self.rooms.get(room, set())
            peers.discard(ws)
            if not peers:
                self.rooms.pop(room, None)
        if peer_id:
            await self.broadcast(room, {"type": "presence_remove", "id": peer_id}, exclude=ws)
