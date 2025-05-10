from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

from src.config import load_game_config
from src.game.bird import Bird
from src.game.pipe import Pipe


@dataclass
class World:
    """Manage bird state, pipes, scoring, and collision checks."""

    config: dict[str, Any]
    rng: random.Random = field(default_factory=random.Random)
    frame_count: int = 0
    score: int = 0
    game_over: bool = False
    bird: Bird = field(init=False)
    pipes: list[Pipe] = field(init=False)

    def __post_init__(self) -> None:
        self.world_config = self.config["world"]
        self.bird_config = self.config["bird"]
        self.pipe_config = self.config["pipes"]
        self.reset()

    @classmethod
    def from_config(cls) -> World:
        """Create a world using the shared game configuration file."""
        return cls(config=load_game_config())

    def reset(self) -> None:
        """Reset the world to its starting state."""
        self.frame_count = 0
        self.score = 0
        self.game_over = False
        self.bird = Bird(
            x=float(self.bird_config["start_x"]),
            y=float(self.bird_config["start_y"]),
            radius=int(self.bird_config["radius"]),
        )
        self.pipes = [self._spawn_pipe()]

    def jump(self) -> None:
        """Trigger a player jump."""
        self.bird.jump(float(self.bird_config["jump_velocity"]))

    def step(self) -> dict[str, Any]:
        """Advance the world by one tick and return the serialized state."""
        if self.game_over:
            return self.serialize()

        self.frame_count += 1
        self.bird.update(
            gravity=float(self.bird_config["gravity"]),
            max_fall_speed=float(self.bird_config["max_fall_speed"]),
        )

        for pipe in self.pipes:
            pipe.update(speed=float(self.pipe_config["speed"]))

        self._spawn_pipe_if_needed()
        self._remove_offscreen_pipes()
        self._update_score()
        self._check_collisions()
        return self.serialize()

    def serialize(self) -> dict[str, Any]:
        """Return the canonical JSON-serializable world state."""
        return {
            "frame": self.frame_count,
            "score": self.score,
            "game_over": self.game_over,
            "world": {
                "screen_width": int(self.world_config["screen_width"]),
                "screen_height": int(self.world_config["screen_height"]),
                "ground_height": int(self.world_config["ground_height"]),
            },
            "bird": {
                "x": self.bird.x,
                "y": self.bird.y,
                "radius": self.bird.radius,
                "velocity": self.bird.velocity,
                "alive": self.bird.alive,
            },
            "pipes": [
                {
                    "x": pipe.x,
                    "width": pipe.width,
                    "gap_y": pipe.gap_y,
                    "gap_size": pipe.gap_size,
                }
                for pipe in self.pipes
            ],
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
            gap_size=int(self.pipe_config["gap_size"]),
        )

    def _spawn_pipe_if_needed(self) -> None:
        """Spawn a new pipe at a fixed frame interval."""
        spawn_interval = int(self.pipe_config["spawn_interval"])
        if self.frame_count % spawn_interval == 0:
            self.pipes.append(self._spawn_pipe())

    def _remove_offscreen_pipes(self) -> None:
        """Drop pipes that have fully scrolled off the screen."""
        self.pipes = [pipe for pipe in self.pipes if pipe.right >= 0]

    def _update_score(self) -> None:
        """Increment score when the bird fully passes a pipe."""
        for pipe in self.pipes:
            if not pipe.passed and pipe.right < self.bird.x:
                pipe.passed = True
                self.score += 1

    def _check_collisions(self) -> None:
        """Mark the bird dead when it collides with the world or pipes."""
        screen_height = float(self.world_config["screen_height"])
        ground_height = float(self.world_config["ground_height"])
        floor_y = screen_height - ground_height

        if (
            self.bird.y - self.bird.radius <= 0
            or self.bird.y + self.bird.radius >= floor_y
        ):
            self._set_game_over()
            return

        bird_left = self.bird.x - self.bird.radius
        bird_right = self.bird.x + self.bird.radius
        bird_top = self.bird.y - self.bird.radius
        bird_bottom = self.bird.y + self.bird.radius

        for pipe in self.pipes:
            overlaps_x = bird_right >= pipe.left and bird_left <= pipe.right
            in_gap = bird_top >= pipe.gap_top and bird_bottom <= pipe.gap_bottom
            if overlaps_x and not in_gap:
                self._set_game_over()
                return

    def _set_game_over(self) -> None:
        """Stop the world and mark the bird dead."""
        self.game_over = True
        self.bird.alive = False
