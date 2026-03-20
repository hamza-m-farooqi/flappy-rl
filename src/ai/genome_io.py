from __future__ import annotations

import json
import pickle
import re
from pathlib import Path
from typing import Any

import neat

from src.ai.neat_runtime import load_neat_overrides
from src.config import normalize_game_mode


CHECKPOINTS_DIR = Path(__file__).resolve().parent.parent.parent / "checkpoints"
TRAINING_CHECKPOINT_PREFIX = "neat-checkpoint-"
HISTORICAL_CHAMPION_PATTERN = re.compile(
    r"^generation(?P<generation>\d+)-(?P<score>\d+)\.pkl$"
)
VALID_RUN_NAME_PATTERN = re.compile(r"[^a-z0-9_-]+")
DEFAULT_ENV_ID = "flappy_bird"


def normalize_run_name(run_name: str) -> str:
    """Return a filesystem-safe run name."""
    normalized = VALID_RUN_NAME_PATTERN.sub("-", run_name.strip().lower()).strip("-")
    if not normalized:
        raise ValueError("Training name must contain letters or numbers.")
    return normalized


# ---------------------------------------------------------------------------
# Per-environment checkpoint path helpers
# All helpers now take env_id so paths are checkpoints/{env_id}/{run_name}/
# ---------------------------------------------------------------------------


def run_dir(run_name: str, env_id: str = DEFAULT_ENV_ID) -> Path:
    """Return the checkpoint directory for a named training run under its env."""
    return CHECKPOINTS_DIR / env_id / normalize_run_name(run_name)


def champion_path(run_name: str, env_id: str = DEFAULT_ENV_ID) -> Path:
    """Return the current champion path for a named run."""
    return run_dir(run_name, env_id) / "champion.pkl"


def champion_metadata_path(run_name: str, env_id: str = DEFAULT_ENV_ID) -> Path:
    """Return the champion metadata path for a named run."""
    return run_dir(run_name, env_id) / "champion.json"


def run_metadata_path(run_name: str, env_id: str = DEFAULT_ENV_ID) -> Path:
    """Return the run metadata path for a named run."""
    return run_dir(run_name, env_id) / "run.json"


def training_checkpoint_prefix(run_name: str, env_id: str = DEFAULT_ENV_ID) -> str:
    """Return the full training checkpoint filename prefix for a named run."""
    return str(run_dir(run_name, env_id) / TRAINING_CHECKPOINT_PREFIX)


def ensure_run_dir(run_name: str, env_id: str = DEFAULT_ENV_ID) -> Path:
    """Create the named run directory (under its env) if needed and return it."""
    directory = run_dir(run_name, env_id)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


# ---------------------------------------------------------------------------
# Run metadata
# ---------------------------------------------------------------------------


def save_run_metadata(
    run_name: str,
    mode: str,
    neat_overrides: dict[str, int | float] | None = None,
    env_id: str = DEFAULT_ENV_ID,
) -> Path:
    """Persist metadata describing the training run itself."""
    ensure_run_dir(run_name, env_id)
    path = run_metadata_path(run_name, env_id)
    payload = {
        "run_name": normalize_run_name(run_name),
        "env_id": env_id,
        "mode": normalize_game_mode(mode, env_id=env_id),
        "neat_overrides": neat_overrides or {},
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def load_run_metadata(
    run_name: str, env_id: str = DEFAULT_ENV_ID
) -> dict[str, Any] | None:
    """Return run metadata for a named training run, if present."""
    metadata_path = run_metadata_path(run_name, env_id)
    if not metadata_path.exists():
        return None
    return json.loads(metadata_path.read_text(encoding="utf-8"))


def resolve_run_env_id(run_name: str, env_id: str = DEFAULT_ENV_ID) -> str:
    """Return the env_id stored in run metadata (falls back to argument or default)."""
    metadata = load_run_metadata(run_name, env_id)
    if metadata is None:
        return env_id
    return str(metadata.get("env_id", env_id))


def resolve_run_mode(run_name: str, env_id: str = DEFAULT_ENV_ID) -> str:
    """Return the persisted mode for a run, defaulting to easy if unknown."""
    metadata = load_run_metadata(run_name, env_id)
    if metadata is None:
        return "easy"
    resolved_env_id = str(metadata.get("env_id", env_id))
    return normalize_game_mode(
        str(metadata.get("mode", "easy")), env_id=resolved_env_id
    )


# ---------------------------------------------------------------------------
# Champion persistence
# ---------------------------------------------------------------------------


def save_champion(
    run_name: str,
    genome: neat.DefaultGenome,
    generation: int,
    score: int,
    env_id: str = DEFAULT_ENV_ID,
) -> Path:
    """Persist the current best genome and metadata for a named run."""
    directory = ensure_run_dir(run_name, env_id)
    checkpoint_path = directory / f"generation{generation}-{score}.pkl"
    current_champion_path = champion_path(run_name, env_id)
    metadata_path = champion_metadata_path(run_name, env_id)

    with checkpoint_path.open("wb") as checkpoint_file:
        pickle.dump(genome, checkpoint_file)

    with current_champion_path.open("wb") as champion_file:
        pickle.dump(genome, champion_file)

    metadata_path.write_text(
        json.dumps(
            {
                "run_name": normalize_run_name(run_name),
                "env_id": env_id,
                "mode": resolve_run_mode(run_name, env_id),
                "generation": generation,
                "score": score,
                "fitness": float(genome.fitness or 0.0),
                "genome_id": getattr(genome, "key", None),
                "checkpoint_path": str(checkpoint_path),
                "champion_path": str(current_champion_path),
            },
            indent=2,
        )
    )

    return checkpoint_path


def load_champion(run_name: str, env_id: str = DEFAULT_ENV_ID) -> neat.DefaultGenome:
    """Load the persisted champion genome for a named run."""
    with champion_path(run_name, env_id).open("rb") as champion_file:
        return pickle.load(champion_file)


def champion_exists(run_name: str, env_id: str = DEFAULT_ENV_ID) -> bool:
    """Return whether a persisted champion genome is available for a named run."""
    return champion_path(run_name, env_id).exists()


def load_champion_metadata(
    run_name: str, env_id: str = DEFAULT_ENV_ID
) -> dict[str, Any] | None:
    """Return persisted champion metadata for a named run, if available."""
    metadata_path = champion_metadata_path(run_name, env_id)
    if not metadata_path.exists():
        return None
    return json.loads(metadata_path.read_text())


# ---------------------------------------------------------------------------
# Training checkpoint helpers
# ---------------------------------------------------------------------------


def latest_training_checkpoint(
    run_name: str, env_id: str = DEFAULT_ENV_ID
) -> Path | None:
    """Return the latest resumable NEAT population checkpoint for a named run."""
    checkpoints = []
    target_dir = run_dir(run_name, env_id)
    if not target_dir.exists():
        return None
    for path in target_dir.glob(f"{TRAINING_CHECKPOINT_PREFIX}*"):
        suffix = path.name.removeprefix(TRAINING_CHECKPOINT_PREFIX)
        if suffix.isdigit():
            checkpoints.append((int(suffix), path))

    if not checkpoints:
        return None

    return max(checkpoints, key=lambda item: item[0])[1]


def latest_historical_champion(
    run_name: str, env_id: str = DEFAULT_ENV_ID
) -> tuple[Path, int, int] | None:
    """Return the latest saved historical champion file and its generation/score."""
    historical = []
    target_dir = run_dir(run_name, env_id)
    if not target_dir.exists():
        return None
    for path in target_dir.glob("generation*.pkl"):
        match = HISTORICAL_CHAMPION_PATTERN.match(path.name)
        if not match:
            continue
        historical.append(
            (
                int(match.group("generation")),
                int(match.group("score")),
                path,
            )
        )

    if not historical:
        return None

    generation, score, path = max(historical, key=lambda item: item[0])
    return path, generation, score


# ---------------------------------------------------------------------------
# Discovery — walk checkpoints/{env_id}/{run_name}/
# ---------------------------------------------------------------------------


def list_training_runs() -> list[dict[str, Any]]:
    """Return all named training runs across all environments.

    Directory layout: checkpoints/{env_id}/{run_name}/
    Falls back to discovering legacy flat runs directly under checkpoints/.
    """
    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    runs: list[dict[str, Any]] = []

    for env_dir in sorted(CHECKPOINTS_DIR.iterdir()):
        if not env_dir.is_dir():
            continue
        env_id_from_path = env_dir.name

        # Skip if this looks like a legacy run dir (has run.json directly inside)
        # Legacy layout: checkpoints/{run_name}/run.json
        # New layout:    checkpoints/{env_id}/{run_name}/run.json
        # Distinguish: if env_dir contains subdirs with run.json → new layout
        # If env_dir itself contains run.json → legacy layout (skip, user deleted them)
        has_run_metadata_directly = (env_dir / "run.json").exists()
        if has_run_metadata_directly:
            # Legacy root-level run dir — skip (user cleared old checkpoints)
            continue

        for run_dir_path in sorted(
            (p for p in env_dir.iterdir() if p.is_dir()),
            key=lambda p: p.name,
        ):
            run_name = run_dir_path.name
            # resolve env_id from stored metadata (authoritative), fall back to dir name
            run_metadata = load_run_metadata(run_name, env_id_from_path) or {}
            env_id = str(run_metadata.get("env_id", env_id_from_path))
            champion_meta = load_champion_metadata(run_name, env_id)
            runs.append(
                {
                    "run_name": run_name,
                    "env_id": env_id,
                    "mode": normalize_game_mode(
                        str(run_metadata.get("mode", "easy")), env_id=env_id
                    ),
                    "has_champion": champion_exists(run_name, env_id),
                    "has_training_checkpoint": latest_training_checkpoint(
                        run_name, env_id
                    )
                    is not None,
                    "neat_overrides": run_metadata.get(
                        "neat_overrides", load_neat_overrides(run_dir_path)
                    ),
                    "best_score": int(champion_meta["score"])
                    if champion_meta
                    else None,
                    "best_fitness": float(champion_meta["fitness"])
                    if champion_meta
                    else None,
                    "last_saved_generation": int(champion_meta["generation"])
                    if champion_meta
                    else None,
                    "champion_path": champion_meta["champion_path"]
                    if champion_meta
                    else str(champion_path(run_name, env_id)),
                    "checkpoint_path": champion_meta.get("checkpoint_path")
                    if champion_meta
                    else None,
                }
            )

    return runs


def list_available_champions() -> list[dict[str, Any]]:
    """Return the named runs that currently have a saved champion."""
    champions = [run for run in list_training_runs() if run["has_champion"]]
    champions.sort(
        key=lambda run: (
            int(run["best_score"] or -1),
            float(run["best_fitness"] or -1),
            run["run_name"],
        ),
        reverse=True,
    )
    return champions
