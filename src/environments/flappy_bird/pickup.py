from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Pickup:
    """A collectible pickup that applies a temporary effect on contact."""

    x: float
    y: float
    kind: str
    radius: int

    def update(self, speed: float) -> None:
        """Move the pickup left by one simulation tick."""
        self.x -= speed

    @property
    def left(self) -> float:
        return self.x - self.radius

    @property
    def right(self) -> float:
        return self.x + self.radius
