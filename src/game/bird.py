from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Bird:
    """A single flappy bird actor within the game world."""

    x: float
    y: float
    radius: int
    velocity: float = 0.0
    alive: bool = True
    genome_id: str | None = None
    frames_alive: int = 0
    pipes_passed: int = 0

    def jump(self, jump_velocity: float) -> None:
        """Apply an immediate upward velocity impulse."""
        if self.alive:
            self.velocity = jump_velocity

    def update(self, gravity: float, max_fall_speed: float) -> None:
        """Advance the bird by one simulation tick."""
        if not self.alive:
            return

        self.velocity = min(self.velocity + gravity, max_fall_speed)
        self.y += self.velocity
        self.frames_alive += 1
