import { useEffect, useRef } from 'react';

export type GameState = {
  frame: number;
  score: number;
  game_over: boolean;
  alive_count?: number;
  total_birds?: number;
  world: {
    screen_width: number;
    screen_height: number;
    ground_height: number;
  };
  bird: {
    x: number;
    y: number;
    radius: number;
    velocity: number;
    alive: boolean;
    genome_id?: string | null;
  };
  birds?: Array<{
    x: number;
    y: number;
    radius: number;
    velocity: number;
    alive: boolean;
    genome_id?: string | null;
    pipes_passed?: number;
  }>;
  pipes: Array<{
    x: number;
    width: number;
    gap_y: number;
    gap_size: number;
  }>;
};

export type TrainingFrame = GameState & {
  type: 'training_frame';
  run_name: string;
  generation: number;
  alive_count: number;
  total_birds: number;
  generation_best_fitness: number;
  generation_best_pipes: number;
  best_fitness: number;
  best_pipes: number;
  best_genome_id?: number | null;
  champion_available: boolean;
  champion_path: string;
  champion_saved_this_generation: boolean;
  generation_complete: boolean;
  generation_end_reason?: 'all_birds_dead' | 'frame_cap' | 'stopped' | null;
  last_saved_generation?: number | null;
  last_checkpoint_path?: string | null;
  generation_stats?: {
    max_fitness: number | null;
    avg_fitness: number | null;
    species_count: number;
  } | null;
  best_network?: {
    nodes: Array<{ id: number; type: 'input' | 'hidden' | 'output'; bias?: number; response?: number; activation?: string }>;
    connections: Array<{ in: number; out: number; weight: number; enabled: boolean }>;
  } | null;
};

type GameCanvasProps = {
  gameState: GameState;
  overlayText?: string;
};

export function GameCanvas({ gameState, overlayText }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const { screen_width, screen_height, ground_height } = gameState.world;
    canvas.width = screen_width;
    canvas.height = screen_height;

    context.clearRect(0, 0, screen_width, screen_height);
    context.fillStyle = '#eef7ff';
    context.fillRect(0, 0, screen_width, screen_height);

    context.fillStyle = '#e0cd96';
    context.fillRect(0, screen_height - ground_height, screen_width, ground_height);

    context.fillStyle = '#44a05c';
    const floorY = screen_height - ground_height;
    for (const pipe of gameState.pipes) {
      const gapTop = pipe.gap_y - pipe.gap_size / 2;
      const gapBottom = pipe.gap_y + pipe.gap_size / 2;
      context.fillRect(pipe.x, 0, pipe.width, gapTop);
      context.fillRect(pipe.x, gapBottom, pipe.width, floorY - gapBottom);
    }

    const birds =
      gameState.birds && gameState.birds.length > 0 ? gameState.birds : [gameState.bird];
    const livingBirds = birds.filter((bird) => bird.alive);
    for (const bird of livingBirds) {
      context.beginPath();
      context.arc(bird.x, bird.y, bird.radius, 0, Math.PI * 2);
      context.fillStyle =
        bird.genome_id === 'human'
          ? 'rgba(40, 118, 168, 0.82)'
          : bird.genome_id === 'ai'
            ? 'rgba(218, 90, 42, 0.85)'
            : 'rgba(232, 186, 68, 0.48)';
      context.fill();
    }

    context.fillStyle = '#293338';
    context.font = 'bold 20px Georgia';
    context.fillText(`Score: ${gameState.score}`, 18, 30);

    if (gameState.game_over || overlayText) {
      context.font = 'bold 28px Georgia';
      context.fillText(overlayText ?? 'Game Over', screen_width / 2 - 78, 54);
    }
  }, [gameState, overlayText]);

  return (
    <div className="canvas-shell">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="Game state preview"
      />
    </div>
  );
}
