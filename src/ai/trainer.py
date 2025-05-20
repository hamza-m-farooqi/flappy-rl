from __future__ import annotations

import threading
import time
from pathlib import Path

import neat

from src.ai.genome_io import (
    CHAMPION_PATH,
    TRAINING_CHECKPOINT_PREFIX,
    champion_exists,
    latest_training_checkpoint,
    load_champion,
    load_champion_metadata,
    save_champion,
)
from src.ai.sensors import build_inputs
from src.config import load_game_config
from src.game.world import World
from src.server.ws_handler import connection_manager


NEAT_CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "neat.cfg"


class NeatTrainer:
    """Run NEAT training and broadcast live swarm updates."""

    def __init__(self, resume: bool = False) -> None:
        self.game_config = load_game_config()
        self.training_config = self.game_config["training"]
        self.stop_event = threading.Event()
        self.generation = 0
        self.best_fitness = 0.0
        self.best_pipes = 0
        self.best_genome_id: int | None = None
        self.last_saved_generation: int | None = None
        self.last_checkpoint_path: str | None = None
        self.checkpoint_generation_interval = int(
            self.training_config.get("checkpoint_generation_interval", 5)
        )
        self.population = self._build_population(resume=resume)
        self.population.add_reporter(neat.StdOutReporter(False))
        self.population.add_reporter(neat.StatisticsReporter())
        self.population.add_reporter(
            neat.Checkpointer(
                generation_interval=self.checkpoint_generation_interval,
                filename_prefix=str(CHAMPION_PATH.parent / TRAINING_CHECKPOINT_PREFIX),
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
        return neat.Config(
            neat.DefaultGenome,
            neat.DefaultReproduction,
            neat.DefaultSpeciesSet,
            neat.DefaultStagnation,
            str(NEAT_CONFIG_PATH),
        )

    def _build_population(self, resume: bool) -> neat.Population:
        config = self._build_config()
        if not resume:
            return neat.Population(config)

        checkpoint_path = latest_training_checkpoint()
        if checkpoint_path is None:
            return neat.Population(config)

        # Resume with the saved NEAT config embedded in the checkpoint so internal
        # indexers like genome/node innovation state continue correctly.
        return neat.Checkpointer.restore_checkpoint(str(checkpoint_path))

    def _bootstrap_champion_state(self) -> None:
        if champion_exists():
            champion = load_champion()
            self.best_fitness = float(champion.fitness or 0.0)
            self.best_genome_id = getattr(champion, "key", None)

        metadata = load_champion_metadata()
        if metadata is None:
            self.generation = self.population.generation
            return

        self.best_pipes = int(metadata.get("score", 0))
        self.last_saved_generation = int(metadata.get("generation", 0))
        self.last_checkpoint_path = str(metadata.get("checkpoint_path", CHAMPION_PATH))
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

            connection_manager.broadcast_state(
                {
                    "type": "training_frame",
                    "generation": self.generation,
                    "alive_count": world.alive_count,
                    "total_birds": len(world.birds),
                    "generation_best_fitness": generation_best_fitness,
                    "generation_best_pipes": generation_best_pipes,
                    "best_fitness": self.best_fitness,
                    "best_pipes": self.best_pipes,
                    "best_genome_id": self.best_genome_id,
                    "champion_available": champion_exists(),
                    "champion_path": str(CHAMPION_PATH),
                    "champion_saved_this_generation": False,
                    "last_saved_generation": self.last_saved_generation,
                    "last_checkpoint_path": self.last_checkpoint_path,
                    **world.serialize(),
                }
            )
            time.sleep(frame_delay_ms / 1000)

        if (
            generation_best_genome is not None
            and generation_best_fitness > self.best_fitness
        ):
            checkpoint_path = save_champion(
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
                    "type": "training_frame",
                    "generation": self.generation,
                    "alive_count": world.alive_count,
                    "total_birds": len(world.birds),
                    "generation_best_fitness": generation_best_fitness,
                    "generation_best_pipes": generation_best_pipes,
                    "best_fitness": self.best_fitness,
                    "best_pipes": self.best_pipes,
                    "best_genome_id": self.best_genome_id,
                    "champion_available": True,
                    "champion_path": str(CHAMPION_PATH),
                    "champion_saved_this_generation": True,
                    "last_saved_generation": self.last_saved_generation,
                    "last_checkpoint_path": self.last_checkpoint_path,
                    **world.serialize(),
                }
            )
