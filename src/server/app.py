from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


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

    return app


app = create_app()
