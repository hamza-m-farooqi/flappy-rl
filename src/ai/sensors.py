from __future__ import annotations

from src.game.bird import Bird
from src.game.world import World


def build_inputs(world: World, bird: Bird) -> list[float]:
    """Build the seven normalized inputs expected by the NEAT network.

    Inputs (all normalized to roughly [-1, 1] or [0, 1]):
      0. bird_y           — bird's vertical position (0=top, 1=bottom)
      1. pipe_distance    — distance to leading edge of next pipe [0, 1]
      2. gap_center_y     — vertical center of the next pipe gap [0, 1]
      3. bird_to_gap      — signed offset: (bird.y - gap_center) / height
                            positive → bird is below center (needs to jump)
                            negative → bird is above center (don't jump)
      4. bird_velocity    — current vertical velocity, normalized
      5. pickup_distance  — distance to next pickup [0, 1], 0 if none
      6. active_effect    — 1.0 (feather), -1.0 (anvil), 0.0 (none)
    """
    next_pipe = world.get_next_pipe(bird.x)
    next_pickup = world.get_next_pickup(bird.x)
    screen_height = float(world.world_config["screen_height"])
    screen_width = float(world.world_config["screen_width"])
    max_fall_speed = float(world.bird_config["max_fall_speed"])

    # Bird position and velocity
    bird_y = bird.y / screen_height
    bird_velocity = bird.velocity / max_fall_speed  # normalized to [-1, 1] approx

    # Pipe sensors
    pipe_distance = 1.0
    gap_center_y = 0.5
    bird_to_gap = 0.0
    if next_pipe is not None:
        pipe_distance = max(next_pipe.left - bird.x, 0.0) / screen_width
        gap_center_y = next_pipe.gap_y / screen_height
        bird_to_gap = (bird.y - next_pipe.gap_y) / screen_height

    # Pickup sensor: distance only. The AI just needs to know something is
    # ahead; it doesn't need to actively navigate toward pickups.
    pickup_distance = 0.0
    pickups_on = bool(world.mode_config.get("pickups_enabled", False))
    if next_pickup is not None and pickups_on:
        pickup_distance = max(next_pickup.x - bird.x, 0.0) / screen_width

    # Active effect on this bird
    active_effect = 0.0
    if bird.active_effect == "feather":
        active_effect = 1.0
    elif bird.active_effect == "anvil":
        active_effect = -1.0

    return [
        bird_y,
        pipe_distance,
        gap_center_y,
        bird_to_gap,
        bird_velocity,
        pickup_distance,
        active_effect,
    ]
