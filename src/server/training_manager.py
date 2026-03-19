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
    """Manage multiple concurrent named training runs inside the API server."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # Maps normalized run_name → (trainer, thread)
        self._runs: dict[str, tuple[NeatTrainer, threading.Thread]] = {}

    def start(
        self,
        run_name: str,
        resume: bool,
        mode: str | None = None,
        neat_overrides: dict[str, int | float] | None = None,
    ) -> dict[str, Any]:
        """Start a named training run.

        Raises RuntimeError if that specific run name is already active.
        Multiple different run names can train concurrently.
        """
        normalized_name = normalize_run_name(run_name)

        with self._lock:
            self._reap_finished()
            if normalized_name in self._runs:
                raise RuntimeError(
                    f"Training run '{normalized_name}' is already active."
                )

            trainer = NeatTrainer(
                run_name=normalized_name,
                resume=resume,
                mode=mode,
                neat_overrides=neat_overrides,
            )
            thread = threading.Thread(target=trainer.run, daemon=True)
            thread.start()
            self._runs[normalized_name] = (trainer, thread)

        return self.status()

    def stop(self, run_name: str) -> dict[str, Any]:
        """Signal a specific named training run to stop."""
        normalized_name = normalize_run_name(run_name)
        with self._lock:
            entry = self._runs.get(normalized_name)

        if entry is not None:
            trainer, _ = entry
            trainer.stop()

        return self.status()

    def stop_all(self) -> None:
        """Signal every active training run to stop (used on server shutdown)."""
        with self._lock:
            entries = list(self._runs.values())
        for trainer, _ in entries:
            trainer.stop()

    def is_running(self, run_name: str | None = None) -> bool:
        """Return whether any (or a specific) run is currently active."""
        with self._lock:
            self._reap_finished()
            if run_name is None:
                return bool(self._runs)
            return normalize_run_name(run_name) in self._runs

    @property
    def active_run_names(self) -> list[str]:
        """Return the names of all currently running training runs."""
        with self._lock:
            self._reap_finished()
            return list(self._runs.keys())

    def status(self) -> dict[str, Any]:
        """Return multi-run training status plus discovered run metadata."""
        active = self.active_run_names
        return {
            "is_running": bool(active),
            "active_run_names": active,
            "runs": list_training_runs(),
            "champions": list_available_champions(),
        }

    def _reap_finished(self) -> None:
        """Remove runs whose threads have finished (must be called under lock)."""
        dead = [name for name, (_, t) in self._runs.items() if not t.is_alive()]
        for name in dead:
            del self._runs[name]


training_manager = TrainingManager()
