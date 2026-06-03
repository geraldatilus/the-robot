import logging
import sys
import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from core.engine import engine
from api.routes  import router
from api.ws      import ws

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

DIST = Path(__file__).parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine.set_broadcast(ws.broadcast)
    await engine.init()
    log.info("RoBot ready — http://localhost:8080")
    yield
    await engine.stop()


app = FastAPI(title="RoBot", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws.connect(websocket)
    try:
        await websocket.send_text(json.dumps({
            "type": "init", "data": engine.status()
        }))
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        ws.disconnect(websocket)


if DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")))

    @app.get("/{full_path:path}")
    async def spa(full_path: str = ""):
        return FileResponse(str(DIST / "index.html"))
