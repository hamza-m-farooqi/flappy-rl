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
    normalize_run_name,
    save_champion,
    training_checkpoint_prefix,
)
from src.ai.neat_runtime import (
    build_neat_config,
    save_neat_overrides,
    serialize_network,
)
from src.ai.sensors import build_inputs
from src.config import load_game_config
from src.game.world import World
from src.server.ws_handler import connection_manager


NEAT_CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "neat.cfg"


class NeatTrainer:
    """Run NEAT training and broadcast live swarm updates."""

    def __init__(
        self,
        run_name: str,
        resume: bool = False,
        neat_overrides: dict[str, int | float] | None = None,
    ) -> None:
        self.game_config = load_game_config()
        self.training_config = self.game_config["training"]
        self.stop_event = threading.Event()
        self.run_name = normalize_run_name(run_name)
        self.neat_overrides = neat_overrides or {}
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
                filename_prefix=training_checkpoint_prefix(self.run_name),
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
            config_path=NEAT_CONFIG_PATH,
            overrides=self.neat_overrides,
            generated_dir=Path(training_checkpoint_prefix(self.run_name)).parent,
        )

    def _build_population(self, resume: bool) -> neat.Population:
        config = self._build_config()
        if not resume:
            save_neat_overrides(
                Path(training_checkpoint_prefix(self.run_name)).parent,
                self.neat_overrides,
            )
            return neat.Population(config)

        checkpoint_path = latest_training_checkpoint(self.run_name)
        if checkpoint_path is None:
            save_neat_overrides(
                Path(training_checkpoint_prefix(self.run_name)).parent,
                self.neat_overrides,
            )
            return neat.Population(config)

        # Resume with the saved NEAT config embedded in the checkpoint so internal
        # indexers like genome/node innovation state continue correctly.
        return neat.Checkpointer.restore_checkpoint(str(checkpoint_path))

    def _bootstrap_champion_state(self) -> None:
        if champion_exists(self.run_name):
            champion = load_champion(self.run_name)
            self.best_fitness = float(champion.fitness or 0.0)
            self.best_genome_id = getattr(champion, "key", None)

        metadata = load_champion_metadata(self.run_name)
        if metadata is not None:
            self.best_pipes = int(metadata.get("score", 0))
            self.last_saved_generation = int(metadata.get("generation", 0))
            self.last_checkpoint_path = str(metadata.get("checkpoint_path"))
            self.generation = self.population.generation
            return

        historical = latest_historical_champion(self.run_name)
        if historical is not None:
            checkpoint_path, generation, score = historical
            self.best_pipes = score
            self.last_saved_generation = generation
            self.last_checkpoint_path = str(checkpoint_path)

        self.generation = self.population.generation

    def _eval_genomes(
        self,
        genomes: list[tuple[int, neat.DefaultGenome]],
        config: neat.Config,
    ) -> None:
        self.generation = self.population.generation
        world = World.from_config(population_size=len(genomes))
        networks: dict[int, neat.nn.FeedForwardNetwork] = {}
        bird_by_genome_id = {}

        for index, (genome_id, genome) in enumerate(genomes):
            genome.fitness = 0.0
            world.birds[index].genome_id = str(genome_id)
            bird_by_genome_id[genome_id] = world.birds[index]
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
            world.alive_count > 0
            and world.frame_count < max_frames
            and not self.stop_event.is_set()
        ):
            for genome_id, genome in genomes:
                bird = bird_by_genome_id[genome_id]
                if not bird.alive:
                    continue

                output = networks[genome_id].activate(build_inputs(world, bird))[0]
                if output > 0.5:
                    bird.jump(float(world.bird_config["jump_velocity"]))

            world.step()

            for genome_id, genome in genomes:
                bird = bird_by_genome_id[genome_id]
                genome.fitness = float(bird.frames_alive + (bird.pipes_passed * 100))
                if genome.fitness > generation_best_fitness:
                    generation_best_fitness = genome.fitness
                    generation_best_genome = genome
                    generation_best_genome_id = genome_id
                    generation_best_pipes = bird.pipes_passed
                    best_network_snapshot = serialize_network(
                        genome,
                        config,
                        values=networks[genome_id].values,
                    )

            generation_average_fitness = mean(
                float(genome.fitness or 0.0) for _, genome in genomes
            )

            connection_manager.broadcast_state(
                {
                    **self._build_training_payload(
                        world=world,
                        generation_best_fitness=generation_best_fitness,
                        generation_average_fitness=generation_average_fitness,
                        generation_best_pipes=generation_best_pipes,
                        generation_complete=False,
                        generation_end_reason=None,
                    ),
                    **world.serialize(),
                }
            )
            time.sleep(frame_delay_ms / 1000)

        if self.stop_event.is_set():
            generation_end_reason = "stopped"
        elif world.alive_count == 0:
            generation_end_reason = "all_birds_dead"
        elif world.frame_count >= max_frames:
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
                {
                    **self._build_training_payload(
                        world=world,
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
                    **world.serialize(),
                }
            )
        else:
            connection_manager.broadcast_state(
                {
                    **self._build_training_payload(
                        world=world,
                        generation_best_fitness=generation_best_fitness,
                        generation_average_fitness=generation_average_fitness,
                        generation_best_pipes=generation_best_pipes,
                        generation_complete=True,
                        generation_end_reason=generation_end_reason,
                        focus_network=best_network_snapshot,
                        include_history=True,
                    ),
                    **world.serialize(),
                }
            )

    def _build_training_payload(
        self,
        world: World,
        generation_best_fitness: float,
        generation_average_fitness: float,
        generation_best_pipes: int,
        generation_complete: bool,
        generation_end_reason: str | None,
        champion_saved_this_generation: bool = False,
        focus_network: dict[str, object] | None = None,
        include_history: bool = False,
    ) -> dict[str, object]:
        payload: dict[str, object] = {
            "type": "training_frame",
            "run_name": self.run_name,
            "generation": self.generation,
            "alive_count": world.alive_count,
            "total_birds": len(world.birds),
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
