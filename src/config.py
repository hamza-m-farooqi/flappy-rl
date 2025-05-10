from __future__ import annotations

from pathlib import Path
from typing import Any

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover - Python 3.10 fallback
    import tomli as tomllib


CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
GAME_CONFIG_PATH = CONFIG_DIR / "game.toml"


def load_game_config() -> dict[str, Any]:
    """Load the shared game configuration from TOML."""
    with GAME_CONFIG_PATH.open("rb") as config_file:
        return tomllib.load(config_file)
