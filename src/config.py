from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover - Python 3.10 fallback
    import tomli as tomllib


PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = PROJECT_ROOT / "config"
GAME_CONFIG_PATH = CONFIG_DIR / "game.toml"
BACKEND_ENV_PATH = PROJECT_ROOT / ".env.server"

load_dotenv(BACKEND_ENV_PATH)

# ---------------------------------------------------------------------------
# Environment-specific config helpers
# ---------------------------------------------------------------------------

ENVIRONMENTS_DIR = PROJECT_ROOT / "src" / "environments"


def get_env_config_dir(env_id: str) -> Path:
    """Return the directory that contains config files for a given env."""
    return ENVIRONMENTS_DIR / env_id


def get_neat_config_path(env_id: str = "flappy_bird") -> Path:
    """Return the absolute path to the NEAT config for an environment."""
    env_dir = get_env_config_dir(env_id)
    env_specific = env_dir / "neat.cfg"
    if env_specific.exists():
        return env_specific
    # Fallback to the legacy root config (will be removed in a future cleanup)
    return CONFIG_DIR / "neat.cfg"


def load_env_game_config(env_id: str = "flappy_bird") -> dict[str, Any]:
    """Load the game.toml for a specific environment."""
    env_dir = get_env_config_dir(env_id)
    env_specific = env_dir / "config.toml"
    if env_specific.exists():
        with env_specific.open("rb") as f:
            return tomllib.load(f)
    # Fallback to the legacy root config
    return load_game_config()


def load_game_config() -> dict[str, Any]:
    """Load the shared game configuration from TOML (legacy path).

    Prefer ``load_env_game_config(env_id)`` for new code.
    """
    with GAME_CONFIG_PATH.open("rb") as config_file:
        return tomllib.load(config_file)


def normalize_game_mode(mode: str | None, env_id: str = "flappy_bird") -> str:
    """Return a valid game mode key from config or the default easy mode."""
    game_config = load_env_game_config(env_id)
    modes = game_config.get("modes", {})
    normalized = (mode or "easy").strip().lower()
    if normalized not in modes:
        raise ValueError(f"Unsupported game mode '{normalized}'.")
    return normalized


def list_game_modes(env_id: str = "flappy_bird") -> list[dict[str, Any]]:
    """Return configured game modes for a given environment."""
    game_config = load_env_game_config(env_id)
    modes = game_config.get("modes", {})
    return [
        {
            "key": mode_key,
            "label": mode_config.get("label", mode_key.title()),
            "description": mode_config.get("description", ""),
        }
        for mode_key, mode_config in modes.items()
    ]


def get_mongodb_uri() -> str:
    """Return the backend MongoDB connection URI from the root .env."""
    return os.getenv("MONGODB_URI", "mongodb://localhost:27017")


def get_mongodb_database() -> str:
    """Return the backend MongoDB database name from the root .env."""
    return os.getenv("MONGODB_DATABASE", "flappy_rl")


def get_admin_password() -> str:
    """Return the admin password used for protected admin routes."""
    return os.getenv("ADMIN_PASSWORD", "change-me")


def get_admin_jwt_secret() -> str:
    """Return the signing secret for admin JWT tokens."""
    return os.getenv("ADMIN_JWT_SECRET", "change-me-secret")
