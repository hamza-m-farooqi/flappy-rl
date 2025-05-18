export type PlayBird = {
  x: number;
  y: number;
  radius: number;
  velocity: number;
  alive: boolean;
  pipes_passed: number;
};

export type PlayPipe = {
  x: number;
  width: number;
  gap_y: number;
  gap_size: number;
  passed: boolean;
};

export type PlayState = {
  frame: number;
  score: number;
  game_over: boolean;
  world: {
    screen_width: number;
    screen_height: number;
    ground_height: number;
    fps: number;
  };
  bird: PlayBird;
  pipes: PlayPipe[];
};

const CONFIG = {
  world: {
    screen_width: 800,
    screen_height: 600,
    ground_height: 80,
    fps: 60,
  },
  bird: {
    start_x: 160,
    start_y: 300,
    radius: 18,
    gravity: 0.45,
    jump_velocity: -8.5,
    max_fall_speed: 10,
  },
  pipes: {
    width: 72,
    gap_size: 170,
    speed: 3,
    spawn_interval: 90,
    start_offset: 320,
    min_gap_y: 140,
    max_gap_y: 380,
  },
} as const;

function randomGapY() {
  const { min_gap_y, max_gap_y } = CONFIG.pipes;
  return min_gap_y + Math.random() * (max_gap_y - min_gap_y);
}

function spawnPipe(): PlayPipe {
  return {
    x: CONFIG.world.screen_width + CONFIG.pipes.start_offset,
    width: CONFIG.pipes.width,
    gap_y: randomGapY(),
    gap_size: CONFIG.pipes.gap_size,
    passed: false,
  };
}

export function createInitialPlayState(): PlayState {
  return {
    frame: 0,
    score: 0,
    game_over: false,
    world: { ...CONFIG.world },
    bird: {
      x: CONFIG.bird.start_x,
      y: CONFIG.bird.start_y,
      radius: CONFIG.bird.radius,
      velocity: 0,
      alive: true,
      pipes_passed: 0,
    },
    pipes: [spawnPipe()],
  };
}

export function jumpBird(state: PlayState): PlayState {
  if (state.game_over) {
    return state;
  }

  return {
    ...state,
    bird: {
      ...state.bird,
      velocity: CONFIG.bird.jump_velocity,
    },
  };
}

export function resetPlayState(): PlayState {
  return createInitialPlayState();
}

export function stepPlayState(state: PlayState): PlayState {
  if (state.game_over) {
    return state;
  }

  const nextBird: PlayBird = {
    ...state.bird,
    velocity: Math.min(state.bird.velocity + CONFIG.bird.gravity, CONFIG.bird.max_fall_speed),
    y: state.bird.y + Math.min(state.bird.velocity + CONFIG.bird.gravity, CONFIG.bird.max_fall_speed),
  };

  const pipes = state.pipes
    .map((pipe) => ({ ...pipe, x: pipe.x - CONFIG.pipes.speed }))
    .filter((pipe) => pipe.x + pipe.width >= 0);

  if ((state.frame + 1) % CONFIG.pipes.spawn_interval === 0) {
    pipes.push(spawnPipe());
  }

  let score = state.score;
  for (const pipe of pipes) {
    if (!pipe.passed && pipe.x + pipe.width < nextBird.x) {
      pipe.passed = true;
      score += 1;
    }
  }

  const floorY = CONFIG.world.screen_height - CONFIG.world.ground_height;
  let gameOver =
    nextBird.y - nextBird.radius <= 0 || nextBird.y + nextBird.radius >= floorY;

  if (!gameOver) {
    const birdLeft = nextBird.x - nextBird.radius;
    const birdRight = nextBird.x + nextBird.radius;
    const birdTop = nextBird.y - nextBird.radius;
    const birdBottom = nextBird.y + nextBird.radius;

    for (const pipe of pipes) {
      const gapTop = pipe.gap_y - pipe.gap_size / 2;
      const gapBottom = pipe.gap_y + pipe.gap_size / 2;
      const overlapsX = birdRight >= pipe.x && birdLeft <= pipe.x + pipe.width;
      const inGap = birdTop >= gapTop && birdBottom <= gapBottom;
      if (overlapsX && !inGap) {
        gameOver = true;
        break;
      }
    }
  }

  return {
    ...state,
    frame: state.frame + 1,
    score,
    game_over: gameOver,
    bird: {
      ...nextBird,
      alive: !gameOver,
      pipes_passed: score,
    },
    pipes,
  };
}
