from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Track connected browser clients and broadcast training frames."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self.loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a new websocket client."""
        await websocket.accept()
        self.loop = asyncio.get_running_loop()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a websocket client."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, payload: Mapping[str, Any]) -> None:
        """Send a JSON payload to all connected clients."""
        disconnected: list[WebSocket] = []
        for connection in self.active_connections:
            try:
                await connection.send_json(dict(payload))
            except RuntimeError:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(connection)

    def broadcast_state(self, payload: Mapping[str, Any]) -> None:
        """Bridge sync training code into the async websocket broadcaster."""
        if not self.active_connections or self.loop is None:
            return

        asyncio.run_coroutine_threadsafe(self.broadcast(payload), self.loop)


connection_manager = ConnectionManager()
