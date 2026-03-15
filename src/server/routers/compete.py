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
    normalize_run_name,
    resolve_run_mode,
)
from src.ai.neat_runtime import (
    build_neat_config as build_runtime_neat_config,
    serialize_network,
)
from src.ai.trainer import NEAT_CONFIG_PATH
from src.ai.sensors import build_inputs
from src.game.world import World


router = APIRouter(tags=["compete"])


def build_neat_config() -> neat.Config:
    """Build the NEAT config used to materialize the saved champion network."""
    return build_runtime_neat_config(config_path=NEAT_CONFIG_PATH)


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

    if not champion_exists(normalized_run_name):
        await websocket.send_json(
            {
                "type": "error",
                "message": f"No champion genome available yet for '{normalized_run_name}'.",
            }
        )
        await websocket.close()
        return

    config = build_neat_config()
    champion = load_champion(normalized_run_name)
    network = neat.nn.FeedForwardNetwork.create(champion, config)
    mode = resolve_run_mode(normalized_run_name)
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
