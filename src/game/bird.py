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
    active_effect: str | None = None
    effect_expires_at: int | None = None

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

    def set_effect(self, effect: str, expires_at: int) -> None:
        """Apply a timed effect to the bird."""
        self.active_effect = effect
        self.effect_expires_at = expires_at

    def clear_effect(self) -> None:
        """Clear any active pickup effect."""
        self.active_effect = None
        self.effect_expires_at = None
