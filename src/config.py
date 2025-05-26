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


def load_game_config() -> dict[str, Any]:
    """Load the shared game configuration from TOML."""
    with GAME_CONFIG_PATH.open("rb") as config_file:
        return tomllib.load(config_file)


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
