from __future__ import annotations

from src.game.bird import Bird
from src.game.world import World


def build_inputs(world: World, bird: Bird) -> list[float]:
    """Build the three normalized inputs expected by the NEAT network."""
    next_pipe = world.get_next_pipe(bird.x)
    screen_height = float(world.world_config["screen_height"])
    screen_width = float(world.world_config["screen_width"])

    if next_pipe is None:
        return [bird.y / screen_height, 1.0, 0.5]

    distance_to_pipe = max(next_pipe.right - bird.x, 0.0)
    return [
        bird.y / screen_height,
        distance_to_pipe / screen_width,
        next_pipe.gap_top / screen_height,
    ]
