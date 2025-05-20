from __future__ import annotations

import json
import pickle
import re
from pathlib import Path

import neat


CHECKPOINTS_DIR = Path(__file__).resolve().parent.parent.parent / "checkpoints"
CHAMPION_PATH = CHECKPOINTS_DIR / "champion.pkl"
CHAMPION_METADATA_PATH = CHECKPOINTS_DIR / "champion.json"
TRAINING_CHECKPOINT_PREFIX = "neat-checkpoint-"
HISTORICAL_CHAMPION_PATTERN = re.compile(
    r"^generation(?P<generation>\d+)-(?P<score>\d+)\.pkl$"
)


def save_champion(
    genome: neat.DefaultGenome,
    generation: int,
    score: int,
) -> Path:
    """Persist the current best genome to disk and snapshot the generation best."""
    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    checkpoint_path = CHECKPOINTS_DIR / f"generation{generation}-{score}.pkl"

    with checkpoint_path.open("wb") as checkpoint_file:
        pickle.dump(genome, checkpoint_file)

    with CHAMPION_PATH.open("wb") as champion_file:
        pickle.dump(genome, champion_file)

    CHAMPION_METADATA_PATH.write_text(
        json.dumps(
            {
                "generation": generation,
                "score": score,
                "fitness": float(genome.fitness or 0.0),
                "genome_id": getattr(genome, "key", None),
                "checkpoint_path": str(checkpoint_path),
                "champion_path": str(CHAMPION_PATH),
            },
            indent=2,
        )
    )
    return checkpoint_path


def load_champion() -> neat.DefaultGenome:
    """Load the persisted champion genome."""
    with CHAMPION_PATH.open("rb") as champion_file:
        return pickle.load(champion_file)


def champion_exists() -> bool:
    """Return whether a persisted champion genome is available."""
    return CHAMPION_PATH.exists()


def latest_training_checkpoint() -> Path | None:
    """Return the most recent resumable NEAT population checkpoint, if one exists."""
    checkpoints = []
    for path in CHECKPOINTS_DIR.glob(f"{TRAINING_CHECKPOINT_PREFIX}*"):
        suffix = path.name.removeprefix(TRAINING_CHECKPOINT_PREFIX)
        if suffix.isdigit():
            checkpoints.append((int(suffix), path))

    if not checkpoints:
        return None

    return max(checkpoints, key=lambda item: item[0])[1]


def latest_historical_champion() -> tuple[Path, int, int] | None:
    """Return the latest saved historical champion file and its generation/score."""
    historical = []
    for path in CHECKPOINTS_DIR.glob("generation*.pkl"):
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


def load_champion_metadata() -> dict[str, object] | None:
    """Return persisted champion metadata, if available."""
    if not CHAMPION_METADATA_PATH.exists():
        return None

    return json.loads(CHAMPION_METADATA_PATH.read_text())
