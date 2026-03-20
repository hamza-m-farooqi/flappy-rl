"""Backward-compat shim — re-exports from src.environments.flappy_bird.

All imports of ``from src.game.pickup import Pickup`` continue to work.
"""

from src.environments.flappy_bird.pickup import Pickup  # noqa: F401
