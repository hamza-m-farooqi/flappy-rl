from __future__ import annotations

import threading
from typing import Any

from src.ai.genome_io import (
    list_available_champions,
    list_training_runs,
    normalize_run_name,
)
from src.ai.trainer import NeatTrainer


class TrainingManager:
    """Manage a single active named training run inside the API server."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._trainer: NeatTrainer | None = None
        self._thread: threading.Thread | None = None
        self._active_run_name: str | None = None

    def start(self, run_name: str, resume: bool, overrides: dict[str, Any] | None = None) -> dict[str, Any]:
        """Start a named training run if none is already active."""
        normalized_name = normalize_run_name(run_name)

        with self._lock:
            if self.is_running():
                raise RuntimeError("A training run is already active.")

            trainer = NeatTrainer(run_name=normalized_name, resume=resume, config_overrides=overrides)
            thread = threading.Thread(target=trainer.run, daemon=True)
            thread.start()

            self._trainer = trainer
            self._thread = thread
            self._active_run_name = normalized_name

        return self.status()

    def stop(self) -> dict[str, Any]:
        """Request that the active training run stop."""
        with self._lock:
            trainer = self._trainer

        if trainer is not None:
            trainer.stop()

        return self.status()

    def is_running(self) -> bool:
        """Return whether a training thread is currently alive."""
        return self._thread is not None and self._thread.is_alive()

    def status(self) -> dict[str, Any]:
        """Return the active training status plus discovered run metadata."""
        if self._thread is not None and not self._thread.is_alive():
            self._thread = None
            self._trainer = None
            self._active_run_name = None

        return {
            "is_running": self.is_running(),
            "active_run_name": self._active_run_name,
            "runs": list_training_runs(),
            "champions": list_available_champions(),
        }


training_manager = TrainingManager()
