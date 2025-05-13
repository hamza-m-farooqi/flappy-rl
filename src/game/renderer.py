from __future__ import annotations

import pygame

from src.game.world import World


class PygameRenderer:
    """Render the current world state into a Pygame window."""

    SKY = (238, 247, 255)
    GROUND = (224, 205, 150)
    PIPE = (68, 160, 92)
    BIRD = (232, 186, 68)
    TEXT = (41, 51, 56)

    def __init__(self, world: World) -> None:
        self.world = world
        self.screen_width = int(world.world_config["screen_width"])
        self.screen_height = int(world.world_config["screen_height"])
        self.ground_height = int(world.world_config["ground_height"])

        pygame.init()
        pygame.display.set_caption("flappy-rl")
        self.screen = pygame.display.set_mode((self.screen_width, self.screen_height))
        self.font = pygame.font.SysFont("arial", 28)

    def render(self) -> None:
        """Draw the current world state."""
        self.screen.fill(self.SKY)
        self._draw_ground()
        self._draw_pipes()
        self._draw_bird()
        self._draw_hud()
        pygame.display.flip()

    def close(self) -> None:
        """Release Pygame resources."""
        pygame.quit()

    def _draw_ground(self) -> None:
        pygame.draw.rect(
            self.screen,
            self.GROUND,
            (
                0,
                self.screen_height - self.ground_height,
                self.screen_width,
                self.ground_height,
            ),
        )

    def _draw_pipes(self) -> None:
        floor_y = self.screen_height - self.ground_height
        for pipe in self.world.pipes:
            top_rect = pygame.Rect(pipe.x, 0, pipe.width, pipe.gap_top)
            bottom_rect = pygame.Rect(
                pipe.x,
                pipe.gap_bottom,
                pipe.width,
                floor_y - pipe.gap_bottom,
            )
            pygame.draw.rect(self.screen, self.PIPE, top_rect, border_radius=10)
            pygame.draw.rect(self.screen, self.PIPE, bottom_rect, border_radius=10)

    def _draw_bird(self) -> None:
        for bird in self.world.birds:
            if not bird.alive:
                continue

            pygame.draw.circle(
                self.screen,
                self.BIRD,
                (int(bird.x), int(bird.y)),
                bird.radius,
            )

    def _draw_hud(self) -> None:
        score_surface = self.font.render(f"Score: {self.world.score}", True, self.TEXT)
        self.screen.blit(score_surface, (20, 20))

        if self.world.game_over:
            game_over_surface = self.font.render(
                "Game Over - Press R to restart",
                True,
                self.TEXT,
            )
            rect = game_over_surface.get_rect(center=(self.screen_width / 2, 50))
            self.screen.blit(game_over_surface, rect)
