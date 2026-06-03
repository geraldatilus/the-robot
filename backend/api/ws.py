import json
import logging
from typing import Set
from fastapi import WebSocket, WebSocketDisconnect

log = logging.getLogger(__name__)


class WS:
    def __init__(self):
        self._clients: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._clients.add(ws)

    def disconnect(self, ws: WebSocket):
        self._clients.discard(ws)

    async def broadcast(self, msg: dict):
        dead = set()
        text = json.dumps(msg)
        for ws in list(self._clients):
            try:
                await ws.send_text(text)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._clients.discard(ws)


ws = WS()
