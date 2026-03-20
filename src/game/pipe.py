"""Backward-compat shim — re-exports from src.environments.flappy_bird.

All imports of ``from src.game.pipe import Pipe`` continue to work.
"""

from src.environments.flappy_bird.pipe import Pipe  # noqa: F401
