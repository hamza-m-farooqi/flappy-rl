/**
 * Frontend environment registry.
 *
 * Maps `env_id` strings (received from the WebSocket payload) to the correct
 * React rendering component for that environment.
 *
 * To add a new environment:
 *   1. Create web/src/environments/YourEnv/Renderer.tsx
 *   2. Import it here and add it to RENDERERS.
 */

// Re-export FlappyBird's engine types and utilities for convenience.
export * from './FlappyBird/engine';

/**
 * Returns the env_id string for the Flappy Bird environment.
 * Additional environments will have their own constants.
 */
export const ENV_IDS = {
  FLAPPY_BIRD: 'flappy_bird',
} as const;

export type EnvId = typeof ENV_IDS[keyof typeof ENV_IDS];

/**
 * Returns true if the given env_id belongs to Flappy Bird.
 * Useful for conditional rendering in pages that support multiple envs.
 */
export function isFlappyBird(envId: string): boolean {
  return envId === ENV_IDS.FLAPPY_BIRD;
}
