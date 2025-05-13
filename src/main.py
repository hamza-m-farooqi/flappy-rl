from __future__ import annotations

import argparse
import threading

import pygame
import uvicorn

from src.ai.trainer import NeatTrainer
from src.game.renderer import PygameRenderer
from src.game.world import World


def build_parser() -> argparse.ArgumentParser:
    """Build the CLI parser for local development entry points."""
    parser = argparse.ArgumentParser(description="Run the flappy-rl application.")
    parser.add_argument(
        "--human",
        action="store_true",
        help="Run the local Pygame human-play mode instead of the API server.",
    )
    parser.add_argument(
        "--train",
        action="store_true",
        help="Run NEAT training in the current process.",
    )
    parser.add_argument(
        "--serve",
        action="store_true",
        help="Run the FastAPI server alongside other modes.",
    )
    return parser


def run_human_mode() -> None:
    """Run the local Pygame loop for manual play."""
    world = World.from_config()
    renderer = PygameRenderer(world)
    clock = pygame.time.Clock()
    fps = int(world.world_config["fps"])

    try:
        running = True
        while running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_SPACE and not world.game_over:
                        world.jump()
                    elif event.key == pygame.K_r and world.game_over:
                        world.reset()

            world.step()
            renderer.render()
            clock.tick(fps)
    finally:
        renderer.close()


def run_api_server() -> None:
    """Run the FastAPI development server."""
    uvicorn.run("src.server.app:app", host="0.0.0.0", port=8000, reload=False)


def run_training() -> None:
    """Run headless NEAT training in the foreground."""
    trainer = NeatTrainer()
    trainer.run()


def run_training_with_server() -> None:
    """Run the API server and background trainer together."""
    trainer = NeatTrainer()
    training_thread = threading.Thread(target=trainer.run, daemon=True)
    training_thread.start()
    run_api_server()


def main() -> None:
    """Dispatch to the selected local runtime mode."""
    args = build_parser().parse_args()
    if args.human:
        run_human_mode()
        return

    if args.train and args.serve:
        run_training_with_server()
        return

    if args.train:
        run_training()
        return

    run_api_server()


if __name__ == "__main__":
    main()
