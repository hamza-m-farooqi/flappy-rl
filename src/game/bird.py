"""Backward-compat shim — re-exports from src.environments.flappy_bird.

All imports of ``from src.game.bird import Bird`` continue to work.
"""

from src.environments.flappy_bird.bird import Bird  # noqa: F401
