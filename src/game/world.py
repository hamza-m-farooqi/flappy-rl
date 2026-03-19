from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Any

from src.config import load_game_config, normalize_game_mode
from src.game.bird import Bird
from src.game.pickup import Pickup
from src.game.pipe import Pipe


@dataclass
class World:
    """Manage birds, pipes, pickups, scoring, and collision checks."""

    config: dict[str, Any]
    mode: str = "easy"
    population_size: int = 1
    rng: random.Random = field(default_factory=random.Random)
    frame_count: int = 0
    score: int = 0
    game_over: bool = False
    birds: list[Bird] = field(init=False)
    pipes: list[Pipe] = field(init=False)
    pickups: list[Pickup] = field(init=False)

    def __post_init__(self) -> None:
        self.world_config = self.config["world"]
        self.bird_config = self.config["bird"]
        self.pipe_config = self.config["pipes"]
        self.pickup_config = self.config["pickups"]
        self.mode = normalize_game_mode(self.mode)
        self.mode_config = self.config["modes"][self.mode]
        self.reset()

    @classmethod
    def from_config(cls, population_size: int = 1, mode: str = "easy") -> World:
        """Create a world using the shared game configuration file."""
        return cls(
            config=load_game_config(),
            mode=mode,
            population_size=population_size,
        )

    def reset(self) -> None:
        """Reset the world to its starting state."""
        self.frame_count = 0
        self.score = 0
        self.game_over = False
        self.birds = [
            Bird(
                x=float(self.bird_config["start_x"]),
                y=float(self.bird_config["start_y"]),
                radius=int(self.bird_config["radius"]),
            )
            for _ in range(self.population_size)
        ]
        self.pipes = [self._spawn_pipe()]
        self.pickups = []
        if bool(self.mode_config.get("pickups_enabled", False)):
            self.pickups.append(self._spawn_pickup())

    def jump(self) -> None:
        """Trigger a player jump."""
        self.bird.jump(float(self.bird_config["jump_velocity"]))

    def step(self) -> dict[str, Any]:
        """Advance the world by one tick and return the serialized state."""
        if self.game_over:
            return self.serialize()

        self.frame_count += 1
        self._update_effects()

        for bird in self.birds:
            bird.update(
                gravity=self.current_gravity_for_bird(bird),
                max_fall_speed=float(self.bird_config["max_fall_speed"]),
            )

        for pipe in self.pipes:
            pipe.update(speed=self.current_pipe_speed)

        for pickup in self.pickups:
            pickup.update(speed=self.current_pipe_speed)

        self._spawn_pipe_if_needed()
        self._spawn_pickup_if_needed()
        self._remove_offscreen_pipes()
        self._remove_offscreen_pickups()
        self._update_score()
        self._collect_pickups()
        self._check_collisions()
        return self.serialize()

    def serialize(self) -> dict[str, Any]:
        """Return the canonical JSON-serializable world state."""
        return {
            "frame": self.frame_count,
            "score": self.score,
            "game_over": self.game_over,
            "mode": self.mode,
            "difficulty": {
                "pipe_speed": self.current_pipe_speed,
                "gap_size": self.current_gap_size,
            },
            "world": {
                "screen_width": int(self.world_config["screen_width"]),
                "screen_height": int(self.world_config["screen_height"]),
                "ground_height": int(self.world_config["ground_height"]),
            },
            "bird": self._serialize_bird(self.bird),
            "birds": [self._serialize_bird(bird) for bird in self.birds],
            "alive_count": self.alive_count,
            "total_birds": len(self.birds),
            "pipes": [
                {
                    "x": pipe.x,
                    "width": pipe.width,
                    "gap_y": pipe.gap_y,
                    "gap_size": pipe.gap_size,
                }
                for pipe in self.pipes
            ],
            "pickups": [
                {
                    "x": pickup.x,
                    "y": pickup.y,
                    "kind": pickup.kind,
                    "radius": pickup.radius,
                }
                for pickup in self.pickups
            ],
        }

    def _serialize_bird(self, bird: Bird) -> dict[str, Any]:
        return {
            "x": bird.x,
            "y": bird.y,
            "radius": bird.radius,
            "velocity": bird.velocity,
            "alive": bird.alive,
            "genome_id": bird.genome_id,
            "pipes_passed": bird.pipes_passed,
            "active_effect": bird.active_effect,
            "effect_remaining_frames": max(
                (bird.effect_expires_at or self.frame_count) - self.frame_count,
                0,
            )
            if bird.active_effect
            else 0,
        }

    def _spawn_pipe(self) -> Pipe:
        """Create a pipe at the standard spawn position."""
        screen_width = float(self.world_config["screen_width"])
        start_offset = float(self.pipe_config["start_offset"])
        gap_y = self.rng.uniform(
            float(self.pipe_config["min_gap_y"]),
            float(self.pipe_config["max_gap_y"]),
        )
        return Pipe(
            x=screen_width + start_offset,
            gap_y=gap_y,
            width=int(self.pipe_config["width"]),
            gap_size=int(round(self.current_gap_size)),
        )

    def _spawn_pipe_if_needed(self) -> None:
        """Spawn a new pipe at a fixed frame interval."""
        spawn_interval = int(self.pipe_config["spawn_interval"])
        if self.frame_count % spawn_interval == 0:
            self.pipes.append(self._spawn_pipe())

    def _spawn_pickup_if_needed(self) -> None:
        """Spawn an ultra-only pickup occasionally, at most one at a time."""
        if not bool(self.mode_config.get("pickups_enabled", False)):
            return

        if len(self.pickups) >= int(self.pickup_config["max_active_pickups"]):
            return

        spawn_interval = int(self.pickup_config["spawn_interval"])
        if self.frame_count % spawn_interval != 0:
            return

        self.pickups.append(self._spawn_pickup())

    def _spawn_pickup(self) -> Pickup:
        """Create a pickup biased toward the upcoming flyable corridor."""
        screen_width = float(self.world_config["screen_width"])
        start_offset = float(self.pickup_config["start_offset"])
        target_pipe = self.pipes[-1] if self.pipes else None
        if target_pipe is not None:
            corridor_center = target_pipe.gap_y
            spread = max(target_pipe.gap_size * 0.22, 18)
            y = self.rng.uniform(corridor_center - spread, corridor_center + spread)
        else:
            y = self.rng.uniform(
                float(self.pickup_config["min_y"]),
                float(self.pickup_config["max_y"]),
            )

        y = max(float(self.pickup_config["min_y"]), y)
        y = min(float(self.pickup_config["max_y"]), y)
        kind = self.rng.choice(["feather", "anvil"])
        return Pickup(
            x=screen_width + start_offset,
            y=y,
            kind=kind,
            radius=int(self.pickup_config["radius"]),
        )

    def _remove_offscreen_pipes(self) -> None:
        """Drop pipes that have fully scrolled off the screen."""
        self.pipes = [pipe for pipe in self.pipes if pipe.right >= 0]

    def _remove_offscreen_pickups(self) -> None:
        """Drop pickups that have fully scrolled off the screen."""
        self.pickups = [pickup for pickup in self.pickups if pickup.right >= 0]

    def _update_score(self) -> None:
        """Increment score when the bird fully passes a pipe."""
        for pipe in self.pipes:
            for bird in self.birds:
                if not bird.alive:
                    continue

                bird_key = bird.genome_id or "player"
                if pipe.right < bird.x and bird_key not in pipe.passed_by:
                    pipe.passed_by.add(bird_key)
                    bird.pipes_passed += 1

            if pipe.passed_by:
                pipe.passed = True

        self.score = max((bird.pipes_passed for bird in self.birds), default=0)

    def _collect_pickups(self) -> None:
        """Apply pickup effects when a bird overlaps a collectible."""
        remaining_pickups: list[Pickup] = []
        for pickup in self.pickups:
            collected = False
            for bird in self.birds:
                if not bird.alive:
                    continue

                distance = math.dist((bird.x, bird.y), (pickup.x, pickup.y))
                if distance <= bird.radius + pickup.radius:
                    duration = int(self.pickup_config[f"{pickup.kind}_duration_frames"])
                    bird.set_effect(pickup.kind, self.frame_count + duration)
                    collected = True
                    break

            if not collected:
                remaining_pickups.append(pickup)

        self.pickups = remaining_pickups

    def _update_effects(self) -> None:
        """Expire pickup effects that have run out."""
        for bird in self.birds:
            if (
                bird.active_effect is not None
                and bird.effect_expires_at is not None
                and self.frame_count >= bird.effect_expires_at
            ):
                bird.clear_effect()

    def _check_collisions(self) -> None:
        """Mark birds dead when they collide with the world or pipes."""
        screen_height = float(self.world_config["screen_height"])
        ground_height = float(self.world_config["ground_height"])
        floor_y = screen_height - ground_height

        for bird in self.birds:
            if not bird.alive:
                continue

            if bird.y - bird.radius <= 0 or bird.y + bird.radius >= floor_y:
                bird.alive = False
                continue

            bird_left = bird.x - bird.radius
            bird_right = bird.x + bird.radius
            bird_top = bird.y - bird.radius
            bird_bottom = bird.y + bird.radius

            for pipe in self.pipes:
                overlaps_x = bird_right >= pipe.left and bird_left <= pipe.right
                in_gap = bird_top >= pipe.gap_top and bird_bottom <= pipe.gap_bottom
                if overlaps_x and not in_gap:
                    bird.alive = False
                    break

        self.game_over = self.alive_count == 0

    @property
    def bird(self) -> Bird:
        """Return the primary bird for single-bird interfaces."""
        return self.birds[0]

    @property
    def alive_count(self) -> int:
        """Return the number of living birds."""
        return sum(1 for bird in self.birds if bird.alive)

    @property
    def current_pipe_speed(self) -> float:
        """Return the current pipe speed for the selected mode."""
        base_speed = float(
            self.mode_config.get("base_pipe_speed", self.pipe_config["speed"])
        )
        if not bool(self.mode_config.get("dynamic_difficulty", False)):
            return base_speed

        bonus = min(
            self.score * float(self.mode_config.get("speed_increase_per_pipe", 0.0)),
            float(self.mode_config.get("max_speed_bonus", 0.0)),
        )
        return base_speed + bonus

    @property
    def current_gap_size(self) -> float:
        """Return the current pipe gap size for the selected mode."""
        base_gap = float(
            self.mode_config.get("base_gap_size", self.pipe_config["gap_size"])
        )
        if not bool(self.mode_config.get("dynamic_difficulty", False)):
            return base_gap

        shrink = min(
            self.score * float(self.mode_config.get("gap_shrink_per_pipe", 0.0)),
            float(self.mode_config.get("max_gap_shrink", 0.0)),
        )
        return max(
            base_gap - shrink,
            float(self.mode_config.get("min_gap_size", base_gap)),
        )

    def current_gravity_for_bird(self, bird: Bird) -> float:
        """Return the current effective gravity for a bird."""
        base_gravity = float(self.bird_config["gravity"])
        if bird.active_effect is None:
            return base_gravity

        multiplier = float(
            self.pickup_config.get(f"{bird.active_effect}_gravity_multiplier", 1.0)
        )
        return base_gravity * multiplier

    def get_next_pipe(self, x_position: float) -> Pipe | None:
        """Return the next upcoming pipe for a given x position."""
        for pipe in self.pipes:
            if pipe.right >= x_position:
                return pipe
        return None

    def get_next_pickup(self, x_position: float) -> Pickup | None:
        """Return the next upcoming pickup for a given x position."""
        for pickup in self.pickups:
            if pickup.right >= x_position:
                return pickup
        return None
