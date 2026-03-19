from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Track connected browser clients per run_name and broadcast selectively.

    Each training run broadcasts only to clients that have subscribed to it via
    /ws/training/{run_name}.  Runs with no viewers are a no-op — zero event-loop
    pressure, which keeps the game and API endpoints responsive under load.
    """

    def __init__(self) -> None:
        # run_name → list of active websocket connections
        self.connections: dict[str, list[WebSocket]] = {}
        self.loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, websocket: WebSocket, run_name: str) -> None:
        """Accept and register a client for a specific run."""
        await websocket.accept()
        self.loop = asyncio.get_running_loop()
        self.connections.setdefault(run_name, []).append(websocket)

    def disconnect(self, websocket: WebSocket, run_name: str) -> None:
        """Remove a client from a run's subscriber list."""
        subscribers = self.connections.get(run_name, [])
        if websocket in subscribers:
            subscribers.remove(websocket)
        if not subscribers:
            self.connections.pop(run_name, None)

    async def _broadcast(self, run_name: str, payload: Mapping[str, Any]) -> None:
        """Send a JSON payload to all clients watching run_name."""
        subscribers = list(self.connections.get(run_name, []))
        disconnected: list[WebSocket] = []
        for ws in subscribers:
            try:
                await ws.send_json(dict(payload))
            except RuntimeError:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws, run_name)

    def broadcast_state(self, run_name: str, payload: Mapping[str, Any]) -> None:
        """Bridge sync training thread into async broadcaster for a specific run."""
        if not self.connections.get(run_name) or self.loop is None:
            return
        asyncio.run_coroutine_threadsafe(self._broadcast(run_name, payload), self.loop)


connection_manager = ConnectionManager()
