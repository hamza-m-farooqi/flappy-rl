from __future__ import annotations

from fastapi import APIRouter

from src.game.world import World


router = APIRouter(prefix="/game", tags=["game"])
WORLD = World.from_config()


@router.get("/state")
async def get_game_state() -> dict[str, object]:
    """Advance the shared world by one tick and return its state."""
    return WORLD.step()
