"""Lightweight observation/action space descriptors.

These are intentionally minimal — they describe the shape and bounds of
inputs/outputs for each environment so the NEAT trainer and future RL
algorithms know how to construct networks dynamically.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Discrete:
    """A finite set of N discrete actions (indices 0 … n-1)."""

    n: int

    def __repr__(self) -> str:
        return f"Discrete({self.n})"

    def contains(self, x: Any) -> bool:
        return isinstance(x, int) and 0 <= x < self.n


@dataclass
class Box:
    """A continuous, bounded box of shape `shape` with per-dimension bounds.

    Args:
        low:   Lower bound (scalar or list matching shape).
        high:  Upper bound (scalar or list matching shape).
        shape: Tuple describing the dimensionality, e.g. (7,) for 7 inputs.
    """

    low: float | list[float]
    high: float | list[float]
    shape: tuple[int, ...]
    dtype: str = "float32"

    @property
    def n(self) -> int:
        """Total number of elements in the space."""
        result = 1
        for dim in self.shape:
            result *= dim
        return result

    def __repr__(self) -> str:
        return f"Box({self.low}, {self.high}, shape={self.shape}, dtype={self.dtype})"

    def contains(self, x: Any) -> bool:
        if not hasattr(x, "__len__"):
            return False
        if len(x) != self.n:
            return False
        low = self.low if isinstance(self.low, list) else [float(self.low)] * self.n
        high = self.high if isinstance(self.high, list) else [float(self.high)] * self.n
        return all(low[i] <= float(x[i]) <= high[i] for i in range(self.n))


@dataclass
class MultiDiscrete:
    """Multiple independent discrete action dimensions.

    Args:
        nvec: List of sizes for each discrete dimension.
    """

    nvec: list[int] = field(default_factory=list)

    def __repr__(self) -> str:
        return f"MultiDiscrete({self.nvec})"

    @property
    def n(self) -> int:
        return len(self.nvec)
