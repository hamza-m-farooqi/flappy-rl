from __future__ import annotations

from fastapi import APIRouter
from fastapi import Query

from src.game.world import World


router = APIRouter(prefix="/game", tags=["game"])
WORLDS: dict[str, World] = {}


@router.get("/state")
async def get_game_state(mode: str = Query("easy")) -> dict[str, object]:
    """Advance the shared world for the selected mode and return its state."""
    world = WORLDS.setdefault(mode, World.from_config(mode=mode))
    return world.step()
