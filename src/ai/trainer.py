from __future__ import annotations

import threading
import time
from pathlib import Path

import neat

from src.ai.sensors import build_inputs
from src.config import load_game_config
from src.game.world import World
from src.server.ws_handler import connection_manager


NEAT_CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "neat.cfg"


class NeatTrainer:
    """Run NEAT training and broadcast live swarm updates."""

    def __init__(self) -> None:
        self.game_config = load_game_config()
        self.training_config = self.game_config["training"]
        self.stop_event = threading.Event()
        self.generation = 0
        self.best_fitness = 0.0
        self.population = neat.Population(self._build_config())
        self.population.add_reporter(neat.StdOutReporter(False))
        self.population.add_reporter(neat.StatisticsReporter())

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

    def _eval_genomes(
        self,
        genomes: list[tuple[int, neat.DefaultGenome]],
        config: neat.Config,
    ) -> None:
        self.generation += 1
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
                self.best_fitness = max(self.best_fitness, genome.fitness)

            connection_manager.broadcast_state(
                {
                    "type": "training_frame",
                    "generation": self.generation,
                    "alive_count": world.alive_count,
                    "total_birds": len(world.birds),
                    "best_fitness": self.best_fitness,
                    **world.serialize(),
                }
            )
            time.sleep(frame_delay_ms / 1000)
