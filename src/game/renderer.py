"""Backward-compat shim — re-exports from src.environments.flappy_bird.

All imports of ``from src.game.renderer import PygameRenderer`` continue to work.
"""

from src.environments.flappy_bird.renderer import PygameRenderer  # noqa: F401
