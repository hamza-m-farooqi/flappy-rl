export type GameMode = 'easy' | 'hard' | 'ultra';

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
  mode: GameMode;
  difficulty: {
    pipe_speed: number;
    gap_size: number;
  };
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
    spawn_interval: 90,
    start_offset: 320,
    min_gap_y: 140,
    max_gap_y: 380,
  },
  modes: {
    easy: {
      base_pipe_speed: 3.0,
      base_gap_size: 170,
      dynamic_difficulty: false,
      speed_increase_per_pipe: 0,
      max_speed_bonus: 0,
      gap_shrink_per_pipe: 0,
      max_gap_shrink: 0,
      min_gap_size: 170,
    },
    hard: {
      base_pipe_speed: 3.35,
      base_gap_size: 160,
      dynamic_difficulty: true,
      speed_increase_per_pipe: 0.12,
      max_speed_bonus: 1.4,
      gap_shrink_per_pipe: 4,
      max_gap_shrink: 40,
      min_gap_size: 120,
    },
    ultra: {
      base_pipe_speed: 4.1,
      base_gap_size: 148,
      dynamic_difficulty: true,
      speed_increase_per_pipe: 0.2,
      max_speed_bonus: 2.4,
      gap_shrink_per_pipe: 7,
      max_gap_shrink: 68,
      min_gap_size: 92,
    },
  },
} as const;

const MODE_LABELS: Record<GameMode, string> = {
  easy: 'Easy',
  hard: 'Hard',
  ultra: 'Ultra',
};

function randomGapY() {
  const { min_gap_y, max_gap_y } = CONFIG.pipes;
  return min_gap_y + Math.random() * (max_gap_y - min_gap_y);
}

function currentPipeSpeed(mode: GameMode, score: number) {
  const modeConfig = CONFIG.modes[mode];
  const bonus = modeConfig.dynamic_difficulty
    ? Math.min(score * modeConfig.speed_increase_per_pipe, modeConfig.max_speed_bonus)
    : 0;
  return modeConfig.base_pipe_speed + bonus;
}

function currentGapSize(mode: GameMode, score: number) {
  const modeConfig = CONFIG.modes[mode];
  const shrink = modeConfig.dynamic_difficulty
    ? Math.min(score * modeConfig.gap_shrink_per_pipe, modeConfig.max_gap_shrink)
    : 0;
  return Math.max(modeConfig.base_gap_size - shrink, modeConfig.min_gap_size);
}

function spawnPipe(mode: GameMode, score: number): PlayPipe {
  return {
    x: CONFIG.world.screen_width + CONFIG.pipes.start_offset,
    width: CONFIG.pipes.width,
    gap_y: randomGapY(),
    gap_size: currentGapSize(mode, score),
    passed: false,
  };
}

export function createInitialPlayState(mode: GameMode): PlayState {
  return {
    frame: 0,
    score: 0,
    game_over: false,
    mode,
    difficulty: {
      pipe_speed: currentPipeSpeed(mode, 0),
      gap_size: currentGapSize(mode, 0),
    },
    world: { ...CONFIG.world },
    bird: {
      x: CONFIG.bird.start_x,
      y: CONFIG.bird.start_y,
      radius: CONFIG.bird.radius,
      velocity: 0,
      alive: true,
      pipes_passed: 0,
    },
    pipes: [spawnPipe(mode, 0)],
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

export function resetPlayState(mode: GameMode): PlayState {
  return createInitialPlayState(mode);
}

export function stepPlayState(state: PlayState): PlayState {
  if (state.game_over) {
    return state;
  }

  const pipeSpeed = currentPipeSpeed(state.mode, state.score);
  const nextVelocity = Math.min(
    state.bird.velocity + CONFIG.bird.gravity,
    CONFIG.bird.max_fall_speed,
  );
  const nextBird: PlayBird = {
    ...state.bird,
    velocity: nextVelocity,
    y: state.bird.y + nextVelocity,
  };

  const pipes = state.pipes
    .map((pipe) => ({ ...pipe, x: pipe.x - pipeSpeed }))
    .filter((pipe) => pipe.x + pipe.width >= 0);

  if ((state.frame + 1) % CONFIG.pipes.spawn_interval === 0) {
    pipes.push(spawnPipe(state.mode, state.score));
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
    difficulty: {
      pipe_speed: currentPipeSpeed(state.mode, score),
      gap_size: currentGapSize(state.mode, score),
    },
    bird: {
      ...nextBird,
      alive: !gameOver,
      pipes_passed: score,
    },
    pipes,
  };
}

export function listGameModes() {
  return (Object.keys(CONFIG.modes) as GameMode[]).map((key) => ({
    key,
    label: MODE_LABELS[key],
  }));
}
