"""Abstract base class for all RL environments in this platform.

All future environments (Flappy Bird, T-Rex, Traffic, Chess, …) must
implement this interface. It is intentionally modelled after the
OpenAI Gymnasium API so that switching between NEAT and any other RL
library requires minimal glue code.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from src.core.spaces import Box, Discrete, MultiDiscrete


# Type aliases for clarity
Observation = dict[str, Any]
Info = dict[str, Any]
ActionType = Any  # int | dict[int, int] | list[int]
RewardType = float | dict[int, float]


class BaseEnvironment(ABC):
    """Abstract interface every environment must implement.

    Environments may be:
    - Single-agent  : `actions` is a plain `int` (e.g. 0 or 1)
    - Multi-agent   : `actions` is a `dict[agent_id, int]`
    - Turn-based    : `actions` carries a single agent's action per step

    The `get_state()` method must always return a JSON-serialisable dict
    suitable for streaming over WebSockets.
    """

    # ------------------------------------------------------------------ #
    # Abstract properties (must be set by each env subclass)              #
    # ------------------------------------------------------------------ #

    @property
    @abstractmethod
    def env_id(self) -> str:
        """Stable machine-readable identifier, e.g. 'flappy_bird'."""
        ...

    @property
    @abstractmethod
    def observation_space(self) -> Box | Discrete | MultiDiscrete:
        """Describes the shape and bounds of observations."""
        ...

    @property
    @abstractmethod
    def action_space(self) -> Box | Discrete | MultiDiscrete:
        """Describes the shape and bounds of actions."""
        ...

    # ------------------------------------------------------------------ #
    # Core environment lifecycle                                           #
    # ------------------------------------------------------------------ #

    @abstractmethod
    def reset(
        self,
        seed: int | None = None,
        options: dict[str, Any] | None = None,
    ) -> tuple[Observation, Info]:
        """Reset the environment and return the initial observation.

        Args:
            seed:    Optional RNG seed for reproducibility.
            options: Optional env-specific configuration overrides.

        Returns:
            (observation, info) — the initial state and auxiliary info.
        """
        ...

    @abstractmethod
    def step(
        self,
        actions: ActionType,
    ) -> tuple[Observation, RewardType, bool, bool, Info]:
        """Advance the environment by one simulation step.

        Args:
            actions: The action(s) to apply.
                     - Single-agent: int (e.g. 0=do_nothing, 1=jump)
                     - Multi-agent:  dict[agent_index, int]

        Returns:
            (observation, reward, terminated, truncated, info)
            - observation:  JSON-serialisable state dict
            - reward:       scalar (single-agent) or dict (multi)
            - terminated:   True when a terminal condition is met
            - truncated:    True when episode is cut short (time limit)
            - info:         auxiliary info dict
        """
        ...

    @abstractmethod
    def get_state(self) -> dict[str, Any]:
        """Return the current state for WebSocket streaming.

        Unlike `step()`, `get_state()` must NOT advance the simulation.
        It should return the same dict that `step()` or `reset()` would
        return as the observation, so the frontend can render it directly.
        """
        ...

    def render(self) -> None:
        """Optional: render the environment via Pygame.

        Environments that support local human play can override this.
        The default implementation is a no-op, permitting headless training.
        """

    def close(self) -> None:
        """Optional: clean up resources (sockets, windows, etc.)."""

    # ------------------------------------------------------------------ #
    # Optional helpers (may be overridden)                                #
    # ------------------------------------------------------------------ #

    def build_sensor_inputs(self, agent_index: int) -> list[float]:
        """Return a flat list of normalised floats for the NEAT network.

        Override this in each environment to define what the neural network
        observes. The length must match the NEAT config's `num_inputs`.

        Args:
            agent_index: Which agent's perspective to compute inputs for.

        Returns:
            List of normalised floats.
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} must implement build_sensor_inputs()."
        )

    def compute_fitness(self, agent_index: int) -> float:
        """Return the current accumulated fitness for one agent.

        Override to customise the fitness function without touching the
        generic NEAT trainer loop.

        Args:
            agent_index: Which agent's fitness to compute.

        Returns:
            A non-negative float (higher is better).
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} must implement compute_fitness()."
        )

    @property
    def alive_count(self) -> int:
        """Return the number of currently active (non-terminated) agents."""
        raise NotImplementedError(
            f"{self.__class__.__name__} must implement the alive_count property."
        )
