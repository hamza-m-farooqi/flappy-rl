"""Environment registry — maps env_id strings to their concrete env classes.

To register a new environment, import its class here and add it to REGISTRY.
"""

from __future__ import annotations

from src.core.environment import BaseEnvironment
from src.environments.flappy_bird.env import FlappyBirdEnv

# Central registry: env_id → concrete class
REGISTRY: dict[str, type[BaseEnvironment]] = {
    "flappy_bird": FlappyBirdEnv,
}


def get_env_class(env_id: str) -> type[BaseEnvironment]:
    """Return the environment class for the given env_id.

    Raises:
        ValueError: If the env_id is not registered.
    """
    cls = REGISTRY.get(env_id)
    if cls is None:
        available = ", ".join(sorted(REGISTRY.keys()))
        raise ValueError(f"Unknown environment '{env_id}'. Available: {available}")
    return cls


def make_env(env_id: str, **kwargs: object) -> BaseEnvironment:
    """Instantiate an environment by its env_id.

    Args:
        env_id:  Registered environment identifier.
        **kwargs: Passed directly to the environment constructor.

    Returns:
        A fresh, unstarted environment instance (call reset() to begin).
    """
    return get_env_class(env_id)(**kwargs)


def list_envs() -> list[dict[str, str]]:
    """Return metadata for all registered environments."""
    return [
        {"env_id": env_id, "class": cls.__name__} for env_id, cls in REGISTRY.items()
    ]
