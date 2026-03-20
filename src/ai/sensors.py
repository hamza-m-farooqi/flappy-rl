"""Backward-compat shim — re-exports from src.environments.flappy_bird.

All imports of ``from src.ai.sensors import build_inputs`` continue to work.
"""

from src.environments.flappy_bird.sensors import build_inputs  # noqa: F401
