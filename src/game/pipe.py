from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Pipe:
    """A scrolling pipe obstacle with a single vertical gap."""

    x: float
    gap_y: float
    width: int
    gap_size: int
    passed: bool = False

    def update(self, speed: float) -> None:
        """Move the pipe left by one simulation tick."""
        self.x -= speed

    @property
    def left(self) -> float:
        """Return the left edge of the pipe."""
        return self.x

    @property
    def right(self) -> float:
        """Return the right edge of the pipe."""
        return self.x + self.width

    @property
    def gap_top(self) -> float:
        """Return the top edge of the gap."""
        return self.gap_y - (self.gap_size / 2)

    @property
    def gap_bottom(self) -> float:
        """Return the bottom edge of the gap."""
        return self.gap_y + (self.gap_size / 2)
