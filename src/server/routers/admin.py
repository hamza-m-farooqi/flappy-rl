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
    mode: str = Field(default="easy", min_length=1, max_length=32)
    neat_overrides: dict[str, int | float] = Field(default_factory=dict)


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
    """Return the active training status and discovered named runs."""
    status = training_manager.status()
    status["override_parameters"] = override_parameter_catalog()
    status["game_modes"] = list_game_modes()
    return status


@router.post("/training/start", dependencies=[Depends(require_admin)])
async def start_training(payload: TrainingRequest) -> dict[str, Any]:
    """Start a fresh named training run."""
    try:
        return training_manager.start(
            normalize_run_name(payload.run_name),
            resume=False,
            mode=normalize_game_mode(payload.mode),
            neat_overrides=normalize_neat_overrides(payload.neat_overrides),
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
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post("/training/stop", dependencies=[Depends(require_admin)])
async def stop_training() -> dict[str, Any]:
    """Request that the active training run stop."""
    return training_manager.stop()


@router.get("/champions", dependencies=[Depends(require_admin)])
async def list_champions() -> dict[str, list[dict[str, Any]]]:
    """Return the public champion catalog across named training runs."""
    return {"champions": list_available_champions()}
