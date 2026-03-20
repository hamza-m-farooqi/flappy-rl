from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.ai.genome_io import list_available_champions, normalize_run_name
from src.ai.neat_runtime import (
    normalize_neat_overrides,
    override_parameter_catalog,
)
from src.config import list_game_modes, normalize_game_mode
from src.environments.registry import list_envs
from src.server.auth import (
    authenticate_admin_password,
    create_admin_token,
    require_admin,
)
from src.server.training_manager import training_manager


router = APIRouter(prefix="/admin", tags=["admin"])


class TrainingRequest(BaseModel):
    """Incoming admin request for starting or resuming a named training run."""

    run_name: str = Field(min_length=1, max_length=64)
    env_id: str = Field(default="flappy_bird", min_length=1, max_length=64)
    mode: str = Field(default="easy", min_length=1, max_length=32)
    neat_overrides: dict[str, int | float] = Field(default_factory=dict)


class StopRequest(BaseModel):
    """Incoming admin request to stop a specific named training run."""

    run_name: str = Field(min_length=1, max_length=64)


class LoginRequest(BaseModel):
    """Incoming admin login payload."""

    password: str = Field(min_length=1, max_length=256)


@router.post("/login")
async def login(payload: LoginRequest) -> dict[str, str]:
    """Issue an admin bearer token for the configured password."""
    if not authenticate_admin_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid admin password.")

    return {"access_token": create_admin_token(), "token_type": "bearer"}


@router.get("/training/status", dependencies=[Depends(require_admin)])
async def get_training_status() -> dict[str, Any]:
    """Return multi-run training status and discovered named runs."""
    status = training_manager.status()
    # Still include global defaults (flappy_bird) for backward compat
    status["override_parameters"] = override_parameter_catalog()
    status["game_modes"] = list_game_modes("flappy_bird")
    return status


@router.get("/environments", dependencies=[Depends(require_admin)])
async def get_environments() -> dict[str, Any]:
    """Return all registered environments with their modes and NEAT override params."""
    environments = []
    for env_info in list_envs():
        env_id = env_info["env_id"]
        environments.append(
            {
                "env_id": env_id,
                "label": env_id.replace("_", " ").title(),
                "game_modes": list_game_modes(env_id),
                "override_parameters": override_parameter_catalog(env_id),
            }
        )
    return {"environments": environments}


@router.post("/training/start", dependencies=[Depends(require_admin)])
async def start_training(payload: TrainingRequest) -> dict[str, Any]:
    """Start a fresh named training run (multiple may run concurrently)."""
    try:
        return training_manager.start(
            normalize_run_name(payload.run_name),
            resume=False,
            mode=normalize_game_mode(payload.mode, env_id=payload.env_id),
            neat_overrides=normalize_neat_overrides(payload.neat_overrides),
            env_id=payload.env_id,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post("/training/resume", dependencies=[Depends(require_admin)])
async def resume_training(payload: TrainingRequest) -> dict[str, Any]:
    """Resume the latest population checkpoint for a named training run."""
    try:
        return training_manager.start(
            normalize_run_name(payload.run_name),
            resume=True,
            env_id=payload.env_id,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post("/training/stop", dependencies=[Depends(require_admin)])
async def stop_training(payload: StopRequest) -> dict[str, Any]:
    """Request that a specific named training run stop."""
    return training_manager.stop(normalize_run_name(payload.run_name))


@router.get("/champions", dependencies=[Depends(require_admin)])
async def list_champions() -> dict[str, list[dict[str, Any]]]:
    """Return the public champion catalog across named training runs."""
    return {"champions": list_available_champions()}
