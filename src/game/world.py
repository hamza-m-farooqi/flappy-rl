"""Backward-compat shim — re-exports from src.environments.flappy_bird.

All imports of ``from src.game.world import World`` continue to work.
"""

from src.environments.flappy_bird.world import World  # noqa: F401
