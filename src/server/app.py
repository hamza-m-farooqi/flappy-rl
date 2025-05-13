from __future__ import annotations

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from src.server.routers.game import router as game_router
from src.server.ws_handler import connection_manager


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(title="flappy-rl")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    async def root() -> dict[str, str]:
        """Return the service identity."""
        return {"status": "online", "project": "flappy-rl"}

    @app.get("/health")
    async def health_check() -> dict[str, str]:
        """Return the service health status."""
        return {"status": "ok"}

    @app.websocket("/ws/training")
    async def training_socket(websocket: WebSocket) -> None:
        """Stream live training frames to connected browser clients."""
        await connection_manager.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            connection_manager.disconnect(websocket)

    app.include_router(game_router)
    return app


app = create_app()
