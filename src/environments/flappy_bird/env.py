"""FlappyBirdEnv — BaseEnvironment wrapper around the Flappy Bird World.

This is the concrete implementation of the BaseEnvironment interface for the
Flappy Bird game. The underlying World simulation remains unchanged; this class
is purely an adapter that makes it compatible with the generic NeatTrainer and
any future RL algorithm.
"""

from __future__ import annotations

import random
from typing import Any

from src.core.environment import BaseEnvironment, Info, Observation
from src.core.spaces import Box, Discrete
from src.environments.flappy_bird.sensors import build_inputs
from src.environments.flappy_bird.world import World


class FlappyBirdEnv(BaseEnvironment):
    """Flappy Bird multi-agent environment implementing BaseEnvironment.

    Supports any population size — each bird is an independent agent
    addressed by its index (0 … population_size-1).
    """

    # ------------------------------------------------------------------ #
    # Class-level constants                                                #
    # ------------------------------------------------------------------ #

    _ENV_ID = "flappy_bird"

    # 7 normalised sensor inputs per agent (see sensors.py for full spec)
    _OBS_SPACE = Box(low=-1.0, high=1.0, shape=(7,))

    # Binary action per agent: 0 = do nothing, 1 = jump
    _ACT_SPACE = Discrete(n=2)

    # ------------------------------------------------------------------ #
    # BaseEnvironment properties                                           #
    # ------------------------------------------------------------------ #

    @property
    def env_id(self) -> str:
        return self._ENV_ID

    @property
    def observation_space(self) -> Box:
        return self._OBS_SPACE

    @property
    def action_space(self) -> Discrete:
        return self._ACT_SPACE

    # ------------------------------------------------------------------ #
    # Lifecycle                                                            #
    # ------------------------------------------------------------------ #

    def __init__(self, population_size: int = 1, mode: str = "easy") -> None:
        self._population_size = population_size
        self._mode = mode
        self._world: World | None = None

    def reset(
        self,
        seed: int | None = None,
        options: dict[str, Any] | None = None,
    ) -> tuple[Observation, Info]:
        """Reset the Flappy Bird world and return the initial state."""
        mode = (options or {}).get("mode", self._mode)
        population_size = (options or {}).get("population_size", self._population_size)

        self._world = World.from_config(
            population_size=int(population_size), mode=str(mode)
        )

        if seed is not None:
            self._world.rng = random.Random(seed)

        return self._world.serialize(), {}

    def step(
        self,
        actions: dict[int, int] | int,
    ) -> tuple[Observation, dict[int, float], bool, bool, Info]:
        """Advance the simulation by one tick.

        Args:
            actions: Either a plain int (single-agent, index 0) or a dict
                     mapping agent_index → action (0=nothing, 1=jump).

        Returns:
            (observation, rewards, terminated, truncated, info)
        """
        if self._world is None:
            raise RuntimeError("Call reset() before step().")

        # Normalise actions to dict[int, int]
        if isinstance(actions, int):
            actions = {0: actions}

        # Apply jumps before advancing the physics tick
        jump_velocity = float(self._world.bird_config["jump_velocity"])
        for agent_idx, action in actions.items():
            if action == 1:
                bird = self._world.birds[agent_idx]
                bird.jump(jump_velocity)

        state = self._world.step()

        # Compute per-agent rewards (frames_alive + 100 × pipes_passed)
        rewards: dict[int, float] = {
            i: float(
                self._world.birds[i].frames_alive
                + self._world.birds[i].pipes_passed * 100
            )
            for i in range(len(self._world.birds))
        }

        terminated = self._world.game_over
        return state, rewards, terminated, False, {}

    def get_state(self) -> dict[str, Any]:
        """Return the serialised world state without advancing the simulation."""
        if self._world is None:
            raise RuntimeError("Call reset() before get_state().")
        return self._world.serialize()

    def render(self) -> None:
        """No-op — Pygame rendering is handled by PygameRenderer separately."""

    # ------------------------------------------------------------------ #
    # NEAT integration helpers                                             #
    # ------------------------------------------------------------------ #

    def build_sensor_inputs(self, agent_index: int) -> list[float]:
        """Return the 7-element normalised input vector for a given bird."""
        if self._world is None:
            raise RuntimeError("Call reset() before build_sensor_inputs().")
        bird = self._world.birds[agent_index]
        return build_inputs(self._world, bird)

    def compute_fitness(self, agent_index: int) -> float:
        """Return the current accumulated fitness for a bird."""
        if self._world is None:
            raise RuntimeError("Call reset() before compute_fitness().")
        bird = self._world.birds[agent_index]
        return float(bird.frames_alive + bird.pipes_passed * 100)

    @property
    def alive_count(self) -> int:
        """Return the number of alive birds."""
        if self._world is None:
            return 0
        return self._world.alive_count

    @property
    def frame_count(self) -> int:
        """Expose the current frame count for training loop termination."""
        if self._world is None:
            return 0
        return self._world.frame_count

    # ------------------------------------------------------------------ #
    # Flappy-Bird-specific passthrough (used by existing trainer code)    #
    # ------------------------------------------------------------------ #

    @property
    def world(self) -> World:
        """Provide direct access to the underlying World for backward compat."""
        if self._world is None:
            raise RuntimeError("Call reset() before accessing world.")
        return self._world
