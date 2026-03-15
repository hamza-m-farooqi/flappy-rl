from __future__ import annotations

from src.game.bird import Bird
from src.game.world import World


def test_bird_update_applies_gravity_and_caps_fall_speed() -> None:
    bird = Bird(x=100.0, y=200.0, radius=18)

    bird.update(gravity=0.45, max_fall_speed=1.0)
    assert bird.velocity == 0.45
    assert bird.y == 200.45
    assert bird.frames_alive == 1

    bird.update(gravity=0.8, max_fall_speed=1.0)
    assert bird.velocity == 1.0
    assert bird.y == 201.45
    assert bird.frames_alive == 2


def test_world_marks_bird_dead_when_hitting_floor() -> None:
    world = World.from_config()
    floor_y = world.world_config["screen_height"] - world.world_config["ground_height"]
    world.bird.y = floor_y - world.bird.radius
    world.bird.velocity = 5.0

    state = world.step()

    assert state["game_over"] is True
    assert state["bird"]["alive"] is False
    assert world.alive_count == 0


def test_world_marks_bird_dead_when_colliding_with_pipe_box() -> None:
    world = World.from_config()
    pipe = world.pipes[0]
    pipe.x = world.bird.x - (pipe.width / 2)
    pipe.gap_y = world.bird.y + 120
    pipe.gap_size = 80
    world.bird.velocity = 0.0

    state = world.step()

    assert state["game_over"] is True
    assert state["bird"]["alive"] is False


def test_world_mode_affects_initial_gap_and_speed() -> None:
    easy_world = World.from_config(mode="easy")
    hard_world = World.from_config(mode="hard")
    ultra_world = World.from_config(mode="ultra")

    assert (
        easy_world.current_pipe_speed
        < hard_world.current_pipe_speed
        < ultra_world.current_pipe_speed
    )
    assert (
        easy_world.current_gap_size
        > hard_world.current_gap_size
        > ultra_world.current_gap_size
    )


def test_dynamic_modes_increase_difficulty_as_score_rises() -> None:
    hard_world = World.from_config(mode="hard")
    ultra_world = World.from_config(mode="ultra")

    hard_initial_speed = hard_world.current_pipe_speed
    ultra_initial_gap = ultra_world.current_gap_size

    hard_world.score = 6
    ultra_world.score = 8

    assert hard_world.current_pipe_speed > hard_initial_speed
    assert ultra_world.current_gap_size < ultra_initial_gap
