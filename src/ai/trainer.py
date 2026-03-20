from __future__ import annotations

import threading
import time
from pathlib import Path
from statistics import mean

import neat

from src.ai.genome_io import (
    champion_exists,
    champion_path,
    latest_historical_champion,
    latest_training_checkpoint,
    load_champion,
    load_champion_metadata,
    load_run_metadata,
    normalize_run_name,
    save_champion,
    save_run_metadata,
    training_checkpoint_prefix,
)
from src.ai.neat_runtime import (
    build_neat_config,
    save_neat_overrides,
    serialize_network,
)
from src.config import get_neat_config_path, normalize_game_mode
from src.environments.registry import get_env_class
from src.server.ws_handler import connection_manager


# Legacy default — resolved dynamically per env_id via get_neat_config_path()
NEAT_CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "neat.cfg"


class NeatTrainer:
    """Run NEAT training and broadcast live swarm updates."""

    def __init__(
        self,
        run_name: str,
        resume: bool = False,
        mode: str | None = None,
        neat_overrides: dict[str, int | float] | None = None,
        env_id: str = "flappy_bird",
    ) -> None:
        self.env_id = env_id
        self.env_class = get_env_class(env_id)
        # Load training config via the env's own config.toml
        from src.config import load_env_game_config

        _cfg = load_env_game_config(env_id)
        self.training_config = _cfg["training"]
        self.stop_event = threading.Event()
        self.run_name = normalize_run_name(run_name)
        self.mode = self._resolve_mode(mode=mode, resume=resume)
        self.neat_overrides = self._resolve_neat_overrides(
            neat_overrides=neat_overrides,
            resume=resume,
        )
        self.generation = 0
        self.best_fitness = 0.0
        self.best_pipes = 0
        self.best_genome_id: int | None = None
        self.last_saved_generation: int | None = None
        self.last_checkpoint_path: str | None = None
        self.history: list[dict[str, int | float]] = []
        self.statistics_reporter = neat.StatisticsReporter()
        self.checkpoint_generation_interval = int(
            self.training_config.get("checkpoint_generation_interval", 5)
        )
        self.population = self._build_population(resume=resume)
        self.population.add_reporter(neat.StdOutReporter(False))
        self.population.add_reporter(self.statistics_reporter)
        self.population.add_reporter(
            neat.Checkpointer(
                generation_interval=self.checkpoint_generation_interval,
                filename_prefix=training_checkpoint_prefix(self.run_name, self.env_id),
            )
        )
        self._bootstrap_champion_state()

    def run(self) -> None:
        """Run training generations until stopped."""
        while not self.stop_event.is_set():
            self.population.run(self._eval_genomes, 1)

    def stop(self) -> None:
        """Request that the training loop stop."""
        self.stop_event.set()

    def _build_config(self) -> neat.Config:
        return build_neat_config(
            config_path=get_neat_config_path(self.env_id),
            overrides=self.neat_overrides,
            generated_dir=Path(
                training_checkpoint_prefix(self.run_name, self.env_id)
            ).parent,
        )

    def _build_population(self, resume: bool) -> neat.Population:
        config = self._build_config()
        save_run_metadata(
            self.run_name,
            mode=self.mode,
            neat_overrides=self.neat_overrides,
            env_id=self.env_id,
        )
        if not resume:
            save_neat_overrides(
                Path(training_checkpoint_prefix(self.run_name, self.env_id)).parent,
                self.neat_overrides,
            )
            return neat.Population(config)

        checkpoint_path = latest_training_checkpoint(self.run_name, self.env_id)
        if checkpoint_path is None:
            save_neat_overrides(
                Path(training_checkpoint_prefix(self.run_name, self.env_id)).parent,
                self.neat_overrides,
            )
            return neat.Population(config)

        return neat.Checkpointer.restore_checkpoint(str(checkpoint_path))

    def _bootstrap_champion_state(self) -> None:
        if champion_exists(self.run_name, self.env_id):
            champion = load_champion(self.run_name, self.env_id)
            self.best_fitness = float(champion.fitness or 0.0)
            self.best_genome_id = getattr(champion, "key", None)

        metadata = load_champion_metadata(self.run_name, self.env_id)
        if metadata is not None:
            self.best_pipes = int(metadata.get("score", 0))
            self.last_saved_generation = int(metadata.get("generation", 0))
            self.last_checkpoint_path = str(metadata.get("checkpoint_path"))
            self.generation = self.population.generation
            return

        historical = latest_historical_champion(self.run_name, self.env_id)
        if historical is not None:
            checkpoint_path, generation, score = historical
            self.best_pipes = score
            self.last_saved_generation = generation
            self.last_checkpoint_path = str(checkpoint_path)

        self.generation = self.population.generation

    def _resolve_mode(self, mode: str | None, resume: bool) -> str:
        if not resume:
            return normalize_game_mode(mode, env_id=self.env_id)

        metadata = load_run_metadata(self.run_name, self.env_id)
        if metadata is not None:
            return normalize_game_mode(
                str(metadata.get("mode", "easy")), env_id=self.env_id
            )
        return normalize_game_mode(mode, env_id=self.env_id)

    def _resolve_neat_overrides(
        self,
        neat_overrides: dict[str, int | float] | None,
        resume: bool,
    ) -> dict[str, int | float]:
        if neat_overrides:
            return neat_overrides

        if not resume:
            return {}

        metadata = load_run_metadata(self.run_name, self.env_id)
        if metadata is None:
            return {}
        return dict(metadata.get("neat_overrides", {}))

    def _eval_genomes(
        self,
        genomes: list[tuple[int, neat.DefaultGenome]],
        config: neat.Config,
    ) -> None:
        self.generation = self.population.generation

        # Instantiate the environment with the correct population size
        env = self.env_class(population_size=len(genomes), mode=self.mode)
        env.reset()

        # Build a mapping from NEAT genome_id → agent index
        networks: dict[int, neat.nn.FeedForwardNetwork] = {}
        genome_id_to_index: dict[int, int] = {}

        for index, (genome_id, genome) in enumerate(genomes):
            genome.fitness = 0.0
            # Tag the underlying bird with the genome_id for WebSocket display
            env.world.birds[index].genome_id = str(genome_id)
            genome_id_to_index[genome_id] = index
            networks[genome_id] = neat.nn.FeedForwardNetwork.create(genome, config)

        max_frames = int(self.training_config["max_frames_per_generation"])
        frame_delay_ms = int(self.training_config["frame_delay_ms"])
        generation_best_genome: neat.DefaultGenome | None = None
        generation_best_genome_id: int | None = None
        generation_best_fitness = float("-inf")
        generation_best_pipes = 0
        generation_average_fitness = 0.0
        generation_end_reason: str | None = None
        best_network_snapshot: dict[str, object] | None = None

        while (
            env.alive_count > 0
            and env.frame_count < max_frames
            and not self.stop_event.is_set()
        ):
            # Build per-agent actions from network outputs
            actions: dict[int, int] = {}
            for genome_id, genome in genomes:
                agent_idx = genome_id_to_index[genome_id]
                bird = env.world.birds[agent_idx]
                if not bird.alive:
                    continue
                inputs = env.build_sensor_inputs(agent_idx)
                output = networks[genome_id].activate(inputs)[0]
                actions[agent_idx] = 1 if output > 0.5 else 0

            # Step the environment
            env.step(actions)

            for genome_id, genome in genomes:
                agent_idx = genome_id_to_index[genome_id]
                genome.fitness = env.compute_fitness(agent_idx)
                if genome.fitness > generation_best_fitness:
                    generation_best_fitness = genome.fitness
                    generation_best_genome = genome
                    generation_best_genome_id = genome_id
                    generation_best_pipes = env.world.birds[agent_idx].pipes_passed
                    best_network_snapshot = serialize_network(
                        genome,
                        config,
                        values=networks[genome_id].values,
                    )

            generation_average_fitness = mean(
                float(genome.fitness or 0.0) for _, genome in genomes
            )

            connection_manager.broadcast_state(
                self.run_name,
                {
                    **self._build_training_payload(
                        env=env,
                        generation_best_fitness=generation_best_fitness,
                        generation_average_fitness=generation_average_fitness,
                        generation_best_pipes=generation_best_pipes,
                        generation_complete=False,
                        generation_end_reason=None,
                    ),
                    "env_id": self.env_id,
                    **env.get_state(),
                },
            )
            time.sleep(frame_delay_ms / 1000)

        if self.stop_event.is_set():
            generation_end_reason = "stopped"
        elif env.alive_count == 0:
            generation_end_reason = "all_birds_dead"
        elif env.frame_count >= max_frames:
            generation_end_reason = "frame_cap"

        self.history.append(
            {
                "generation": self.generation,
                "max_fitness": generation_best_fitness,
                "avg_fitness": generation_average_fitness,
                "species_count": len(self.population.species.species),
                "best_pipes": generation_best_pipes,
            }
        )

        if (
            generation_best_genome is not None
            and generation_best_fitness > self.best_fitness
        ):
            checkpoint_path = save_champion(
                self.run_name,
                generation_best_genome,
                generation=self.generation,
                score=generation_best_pipes,
            )
            self.best_fitness = generation_best_fitness
            self.best_pipes = generation_best_pipes
            self.best_genome_id = generation_best_genome_id
            self.last_saved_generation = self.generation
            self.last_checkpoint_path = str(checkpoint_path)
            connection_manager.broadcast_state(
                self.run_name,
                {
                    **self._build_training_payload(
                        env=env,
                        generation_best_fitness=generation_best_fitness,
                        generation_average_fitness=generation_average_fitness,
                        generation_best_pipes=generation_best_pipes,
                        generation_complete=True,
                        generation_end_reason=generation_end_reason,
                        champion_saved_this_generation=True,
                        focus_network=serialize_network(
                            generation_best_genome,
                            config,
                            values=networks[generation_best_genome_id].values
                            if generation_best_genome_id is not None
                            else None,
                        ),
                        include_history=True,
                    ),
                    "env_id": self.env_id,
                    **env.get_state(),
                },
            )
        else:
            connection_manager.broadcast_state(
                self.run_name,
                {
                    **self._build_training_payload(
                        env=env,
                        generation_best_fitness=generation_best_fitness,
                        generation_average_fitness=generation_average_fitness,
                        generation_best_pipes=generation_best_pipes,
                        generation_complete=True,
                        generation_end_reason=generation_end_reason,
                        focus_network=best_network_snapshot,
                        include_history=True,
                    ),
                    "env_id": self.env_id,
                    **env.get_state(),
                },
            )

    def _build_training_payload(
        self,
        env: object,
        generation_best_fitness: float,
        generation_average_fitness: float,
        generation_best_pipes: int,
        generation_complete: bool,
        generation_end_reason: str | None,
        champion_saved_this_generation: bool = False,
        focus_network: dict[str, object] | None = None,
        include_history: bool = False,
    ) -> dict[str, object]:
        # Access the underlying world for legacy payload fields
        from src.environments.flappy_bird.env import FlappyBirdEnv

        world = env.world if isinstance(env, FlappyBirdEnv) else None  # type: ignore[attr-defined]
        alive = world.alive_count if world else getattr(env, "alive_count", 0)
        total = len(world.birds) if world else 0
        payload: dict[str, object] = {
            "type": "training_frame",
            "run_name": self.run_name,
            "generation": self.generation,
            "mode": self.mode,
            "alive_count": alive,
            "total_birds": total,
            "generation_best_fitness": generation_best_fitness,
            "generation_average_fitness": generation_average_fitness,
            "generation_best_pipes": generation_best_pipes,
            "best_fitness": self.best_fitness,
            "best_pipes": self.best_pipes,
            "best_genome_id": self.best_genome_id,
            "species_count": len(self.population.species.species),
            "champion_available": champion_exists(self.run_name),
            "champion_path": str(champion_path(self.run_name)),
            "champion_saved_this_generation": champion_saved_this_generation,
            "generation_complete": generation_complete,
            "generation_end_reason": generation_end_reason,
            "last_saved_generation": self.last_saved_generation,
            "last_checkpoint_path": self.last_checkpoint_path,
        }
        if include_history:
            payload["history"] = self.history[-60:]
        if focus_network is not None:
            payload["focus_network"] = focus_network
        return payload
