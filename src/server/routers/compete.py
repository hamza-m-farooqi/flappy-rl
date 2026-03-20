from __future__ import annotations

import asyncio
from typing import Any

import neat
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi import Query

from src.ai.genome_io import (
    champion_exists,
    list_available_champions,
    load_champion,
    load_run_metadata,
    normalize_run_name,
    resolve_run_mode,
)
from src.ai.neat_runtime import (
    build_neat_config as build_runtime_neat_config,
    serialize_network,
)
from src.ai.sensors import build_inputs
from src.config import get_neat_config_path
from src.game.world import World


router = APIRouter(tags=["compete"])

DEFAULT_ENV_ID = "flappy_bird"


def _get_run_env_id(run_name: str) -> str:
    """Look up the env_id from a run's stored metadata."""
    metadata = load_run_metadata(run_name, DEFAULT_ENV_ID)
    if metadata is None:
        # Try other env directories by searching
        from src.ai.genome_io import CHECKPOINTS_DIR

        for env_dir in CHECKPOINTS_DIR.iterdir():
            if not env_dir.is_dir():
                continue
            candidate = load_run_metadata(run_name, env_dir.name)
            if candidate is not None:
                return str(candidate.get("env_id", env_dir.name))
    return str((metadata or {}).get("env_id", DEFAULT_ENV_ID))


def build_neat_config_for_env(env_id: str = DEFAULT_ENV_ID) -> neat.Config:
    """Build the NEAT config for a given environment."""
    return build_runtime_neat_config(config_path=get_neat_config_path(env_id))


@router.get("/compete/champions")
async def list_compete_champions() -> dict[str, list[dict[str, Any]]]:
    """Return the available named champions for compete mode selection."""
    return {"champions": list_available_champions()}


@router.websocket("/ws/compete")
async def compete_socket(
    websocket: WebSocket,
    run_name: str = Query(...),
) -> None:
    """Run a live compete session between the browser player and the saved champion."""
    await websocket.accept()
    normalized_run_name = normalize_run_name(run_name)

    # Resolve which environment this champion belongs to
    env_id = _get_run_env_id(normalized_run_name)

    if not champion_exists(normalized_run_name, env_id):
        await websocket.send_json(
            {
                "type": "error",
                "message": f"No champion genome available yet for '{normalized_run_name}'.",
            }
        )
        await websocket.close()
        return

    config = build_neat_config_for_env(env_id)
    champion = load_champion(normalized_run_name, env_id)
    network = neat.nn.FeedForwardNetwork.create(champion, config)
    mode = resolve_run_mode(normalized_run_name, env_id)
    world = World.from_config(population_size=2, mode=mode)
    human_bird = world.birds[0]
    human_bird.genome_id = "human"
    ai_bird = world.birds[1]
    ai_bird.genome_id = "ai"
    has_started = False

    try:
        while True:
            try:
                message = await asyncio.wait_for(
                    websocket.receive_json(), timeout=1 / 60
                )
                if (
                    message.get("type") == "jump"
                    and human_bird.alive
                    and not world.game_over
                ):
                    has_started = True
                    human_bird.jump(float(world.bird_config["jump_velocity"]))
                if message.get("type") == "restart":
                    world.reset()
                    human_bird = world.birds[0]
                    human_bird.genome_id = "human"
                    ai_bird = world.birds[1]
                    ai_bird.genome_id = "ai"
                    has_started = False
            except asyncio.TimeoutError:
                pass

            if has_started and ai_bird.alive and not world.game_over:
                output = network.activate(build_inputs(world, ai_bird))[0]
                if output > 0.5:
                    ai_bird.jump(float(world.bird_config["jump_velocity"]))

            state = world.step() if has_started else world.serialize()
            payload = {
                "type": "compete_frame",
                **state,
                "human_bird": state["birds"][0],
                "ai_bird": state["birds"][1],
                "run_name": normalized_run_name,
                "env_id": env_id,
                "mode": mode,
                "has_started": has_started,
                "human_score": world.birds[0].pipes_passed,
                "ai_score": world.birds[1].pipes_passed,
                "winner": determine_winner(world),
                "focus_network": serialize_network(
                    champion,
                    config,
                    values=network.values,
                ),
            }
            await websocket.send_json(payload)
    except WebSocketDisconnect:
        return


def determine_winner(world: World) -> str | None:
    """Return the current compete winner when the race is over."""
    if not world.game_over:
        return None

    human_score = world.birds[0].pipes_passed
    ai_score = world.birds[1].pipes_passed
    if human_score > ai_score:
        return "human"
    if ai_score > human_score:
        return "ai"
    return "tie"
