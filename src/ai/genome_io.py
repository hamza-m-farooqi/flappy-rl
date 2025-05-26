from __future__ import annotations

import json
import pickle
import re
from pathlib import Path
from typing import Any

import neat


CHECKPOINTS_DIR = Path(__file__).resolve().parent.parent.parent / "checkpoints"
TRAINING_CHECKPOINT_PREFIX = "neat-checkpoint-"
HISTORICAL_CHAMPION_PATTERN = re.compile(
    r"^generation(?P<generation>\d+)-(?P<score>\d+)\.pkl$"
)
VALID_RUN_NAME_PATTERN = re.compile(r"[^a-z0-9_-]+")


def normalize_run_name(run_name: str) -> str:
    """Return a filesystem-safe run name."""
    normalized = VALID_RUN_NAME_PATTERN.sub("-", run_name.strip().lower()).strip("-")
    if not normalized:
        raise ValueError("Training name must contain letters or numbers.")
    return normalized


def run_dir(run_name: str) -> Path:
    """Return the checkpoint directory for a named training run."""
    return CHECKPOINTS_DIR / normalize_run_name(run_name)


def champion_path(run_name: str) -> Path:
    """Return the current champion path for a named run."""
    return run_dir(run_name) / "champion.pkl"


def champion_metadata_path(run_name: str) -> Path:
    """Return the champion metadata path for a named run."""
    return run_dir(run_name) / "champion.json"


def training_checkpoint_prefix(run_name: str) -> str:
    """Return the full training checkpoint filename prefix for a named run."""
    return str(run_dir(run_name) / TRAINING_CHECKPOINT_PREFIX)


def ensure_run_dir(run_name: str) -> Path:
    """Create the named run directory if needed and return it."""
    directory = run_dir(run_name)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def save_champion(
    run_name: str,
    genome: neat.DefaultGenome,
    generation: int,
    score: int,
) -> Path:
    """Persist the current best genome and metadata for a named run."""
    directory = ensure_run_dir(run_name)
    checkpoint_path = directory / f"generation{generation}-{score}.pkl"
    current_champion_path = champion_path(run_name)
    metadata_path = champion_metadata_path(run_name)

    with checkpoint_path.open("wb") as checkpoint_file:
        pickle.dump(genome, checkpoint_file)

    with current_champion_path.open("wb") as champion_file:
        pickle.dump(genome, champion_file)

    metadata_path.write_text(
        json.dumps(
            {
                "run_name": normalize_run_name(run_name),
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


def load_champion(run_name: str) -> neat.DefaultGenome:
    """Load the persisted champion genome for a named run."""
    with champion_path(run_name).open("rb") as champion_file:
        return pickle.load(champion_file)


def champion_exists(run_name: str) -> bool:
    """Return whether a persisted champion genome is available for a named run."""
    return champion_path(run_name).exists()


def latest_training_checkpoint(run_name: str) -> Path | None:
    """Return the latest resumable NEAT population checkpoint for a named run."""
    checkpoints = []
    for path in run_dir(run_name).glob(f"{TRAINING_CHECKPOINT_PREFIX}*"):
        suffix = path.name.removeprefix(TRAINING_CHECKPOINT_PREFIX)
        if suffix.isdigit():
            checkpoints.append((int(suffix), path))

    if not checkpoints:
        return None

    return max(checkpoints, key=lambda item: item[0])[1]


def load_champion_metadata(run_name: str) -> dict[str, Any] | None:
    """Return persisted champion metadata for a named run, if available."""
    metadata_path = champion_metadata_path(run_name)
    if not metadata_path.exists():
        return None

    return json.loads(metadata_path.read_text())


def list_training_runs() -> list[dict[str, Any]]:
    """Return discovered named training runs with champion metadata when available."""
    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    runs: list[dict[str, Any]] = []

    for directory in sorted(
        (path for path in CHECKPOINTS_DIR.iterdir() if path.is_dir()),
        key=lambda path: path.name,
    ):
        run_name = directory.name
        metadata = load_champion_metadata(run_name)
        runs.append(
            {
                "run_name": run_name,
                "has_champion": champion_exists(run_name),
                "has_training_checkpoint": latest_training_checkpoint(run_name)
                is not None,
                "best_score": int(metadata["score"]) if metadata else None,
                "best_fitness": float(metadata["fitness"]) if metadata else None,
                "last_saved_generation": int(metadata["generation"])
                if metadata
                else None,
                "champion_path": metadata["champion_path"]
                if metadata
                else str(champion_path(run_name)),
                "checkpoint_path": metadata["checkpoint_path"] if metadata else None,
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


def latest_historical_champion(run_name: str) -> tuple[Path, int, int] | None:
    """Return the latest saved historical champion file and its generation/score."""
    historical = []
    for path in run_dir(run_name).glob("generation*.pkl"):
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
