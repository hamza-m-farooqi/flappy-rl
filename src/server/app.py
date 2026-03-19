from __future__ import annotations

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from src.server.routers.admin import router as admin_router
from src.server.routers.compete import router as compete_router
from src.server.routers.game import router as game_router
from src.server.routers.leaderboard import router as leaderboard_router
from src.server.training_manager import training_manager
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

    @app.get("/training/status")
    async def training_status() -> dict[str, bool | list[str]]:
        """Return the public active training status for the live monitor."""
        status = training_manager.status()
        return {
            "is_running": status["is_running"],
            "active_run_names": status["active_run_names"],
        }

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
    app.include_router(leaderboard_router)
    app.include_router(admin_router)
    app.include_router(compete_router)
    return app


app = create_app()
