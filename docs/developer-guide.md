# NeuroArena — Developer Guide
> Everything a developer needs to work on the platform locally and extend it with new game environments.
---
## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Local Development Setup](#3-local-development-setup)
4. [Running the Application Locally](#4-running-the-application-locally)
5. [Backend Architecture Deep-Dive](#5-backend-architecture-deep-dive)
6. [Frontend Architecture Deep-Dive](#6-frontend-architecture-deep-dive)
7. [Adding a New Game Environment](#7-adding-a-new-game-environment)
8. [Testing Strategy](#8-testing-strategy)
9. [Code Style and Tooling](#9-code-style-and-tooling)
10. [WebSocket Protocol Reference](#10-websocket-protocol-reference)
11. [Troubleshooting](#11-troubleshooting)
---
## 1. Project Overview
NeuroArena is a **General Multi-Environment RL Sandbox** built around these core ideas:
- **NEAT (NeuroEvolution of Augmenting Topologies)** evolves neural networks to play games.
- A Python **FastAPI** backend runs training in a background thread and streams real-time state over **WebSockets**.
- A **React** frontend renders each frame on an HTML Canvas and charts training progress.
- Any new game can be added by implementing the `BaseEnvironment` interface — the generic trainer, WebSocket layer, and frontend registry all handle the rest automatically.
The current environment: **Flappy Bird** (single-agent, discrete action space).
Planned environments: T-Rex Run, 4-Way Traffic Intersection (multi-agent), Chess (self-play).
---
## 2. Repository Structure
```text
neuro-arena/
├── src/
│   ├── core/
│   │   ├── environment.py       # BaseEnvironment abstract class
│   │   └── spaces.py            # Discrete, Box, MultiDiscrete space classes
│   ├── environments/
│   │   ├── registry.py          # env_id → class registry + make_env()
│   │   └── flappy_bird/
│   │       ├── env.py           # FlappyBirdEnv(BaseEnvironment) adapter
│   │       ├── world.py         # Physics simulation
│   │       ├── bird.py          # Bird actor
│   │       ├── pipe.py          # Pipe obstacle
│   │       ├── pickup.py        # Collectible pickup
│   │       ├── renderer.py      # Pygame local renderer
│   │       ├── sensors.py       # NEAT network inputs (build_inputs)
│   │       ├── config.toml      # Game and difficulty configuration
│   │       └── neat.cfg         # NEAT hyperparameters for this env
│   ├── ai/
│   │   ├── trainer.py           # Generic NeatTrainer (env-agnostic)
│   │   ├── neat_runtime.py      # Config building, network serialisation
│   │   ├── genome_io.py         # Champion/checkpoint persistence helpers
│   │   └── sensors.py           # Backward-compat shim → flappy_bird/sensors.py
│   ├── db/                      # MongoDB async client helpers
│   ├── server/
│   │   ├── app.py               # FastAPI app factory + WebSocket endpoints
│   │   ├── auth.py              # JWT auth helpers
│   │   ├── training_manager.py  # Manages multiple concurrent NeatTrainer instances
│   │   ├── ws_handler.py        # ConnectionManager for per-run WebSocket subscribers
│   │   └── routers/             # admin.py, compete.py, game.py, leaderboard.py
│   ├── config.py                # Config loading helpers (env-aware)
│   └── main.py                  # CLI entrypoint (--serve, --human, --train, --resume)
├── src/game/                    # Backward-compat shims → src/environments/flappy_bird/
├── web/
│   └── src/
│       ├── environments/
│       │   ├── index.ts         # Frontend registry (ENV_IDS + isFlappyBird())
│       │   └── FlappyBird/
│       │       └── engine.ts    # Client-side Flappy Bird physics (zero-latency play)
│       ├── game/
│       │   └── engine.ts        # Shim → environments/FlappyBird/engine.ts
│       ├── pages/               # AdminPage, TrainingPage, CompetePage, etc.
│       ├── hooks/               # React hooks (WebSocket, game state, etc.)
│       ├── components/          # Shared UI components
│       ├── config/              # Frontend config (API URLs)
│       └── App.tsx              # Routes
├── config/                      # Legacy config root (still read as fallback)
│   ├── game.toml
│   └── neat.cfg
├── checkpoints/                 # Created at runtime. Named run dirs + champion files
├── docs/
│   └── developer-guide.md       # This file
├── assets/                      # Screenshots for README
├── scripts/                     # dev.sh helper
├── tests/
│   ├── conftest.py
│   ├── test_physics.py          # World / Bird / sensors unit tests
│   └── test_api.py              # FastAPI endpoint tests
├── pyproject.toml
├── .env.server.example
└── .env.web.example
```
### Key design decision: backward-compat shims
`src/game/*.py` and `src/ai/sensors.py` are one-liner re-exports:
```python
# src/game/world.py
from src.environments.flappy_bird.world import World  # noqa: F401
```
This means the existing tests, server routers, and any external code importing from `src.game` continue to work without modification during and after the migration.
---
## 3. Local Development Setup
### Prerequisites
| Tool | Version | Purpose |
|---|---|---|
| Python | 3.10+ | Backend runtime |
| `uv` | latest | Python package manager |
| Node.js | 18+ | Frontend dev server |
| npm | 9+ | Frontend package manager |
| MongoDB | 6+ | Leaderboard persistence (optional for dev) |
### Install dependencies
```bash
# Clone
git clone https://github.com/your-username/neuro-arena.git
cd neuro-arena
# Python backend
uv sync
# React frontend
cd web && npm install && cd ..
```
### Configure environment files
```bash
cp .env.server.example .env.server
cp .env.web.example .env.web
```
**`.env.server`** — backend secrets:
```bash
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=neuro_arena
ADMIN_PASSWORD=your-local-password
ADMIN_JWT_SECRET=any-long-random-string
```
**`.env.web`** — frontend API URLs:
```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_TRAINING_WS_URL=ws://localhost:8000/ws/training
VITE_COMPETE_WS_URL=ws://localhost:8000/ws/compete
```
> **MongoDB is optional** for core development. The API will start without it — only leaderboard endpoints will fail. You can run `mongod` locally or use MongoDB Atlas free tier.
---
## 4. Running the Application Locally
### Quickest start (both servers)
```bash
sh scripts/dev.sh
```
This starts the FastAPI server and the Vite dev server together.
### Manual control (two terminals)
```bash
# Terminal 1 — Backend
uv run python -m src.main --serve
# Terminal 2 — Frontend
cd web && npm run dev
```
### All runtime modes
```bash
# API server only (no training)
uv run python -m src.main --serve
# Local Pygame human-play window (no server)
uv run python -m src.main --human
# Start training + run API server
uv run python -m src.main --train --serve --run-name my-run
# Resume training from last checkpoint + run API server
uv run python -m src.main --train --serve --resume --run-name my-run
# Training only, no server (useful for fast offline training)
uv run python -m src.main --train --run-name my-run
```
### Local URLs
| URL | Service |
|---|---|
| `http://localhost:5173` | React frontend |
| `http://localhost:8000` | FastAPI backend |
| `http://localhost:8000/docs` | Auto-generated API docs (Swagger) |
| `http://localhost:8000/health` | Health check |
| `ws://localhost:8000/ws/training/{run_name}` | Training WebSocket stream |
---
## 5. Backend Architecture Deep-Dive
### Environment abstraction (`src/core/environment.py`)
```python
class BaseEnvironment(ABC):
    @property
    def env_id(self) -> str: ...          # e.g. "flappy_bird"
    @property
    def observation_space(self): ...       # Box / Discrete
    @property
    def action_space(self): ...            # Box / Discrete
    def reset(self, seed=None, options=None) -> tuple[Observation, Info]: ...
    def step(self, actions) -> tuple[Observation, Reward, bool, bool, Info]: ...
    def get_state(self) -> dict: ...       # called by WebSocket streamer
    def build_sensor_inputs(self, agent_index) -> list[float]: ...  # NEAT inputs
    def compute_fitness(self, agent_index) -> float: ...
    @property
    def alive_count(self) -> int: ...
```
All environments implement this interface. The generic `NeatTrainer` only ever calls these methods — it has zero knowledge of game-specific types.
### Environment registry (`src/environments/registry.py`)
```python
REGISTRY = {
    "flappy_bird": FlappyBirdEnv,
    # "trex": TRexEnv,  ← add here
}
def get_env_class(env_id: str) -> type[BaseEnvironment]: ...
def make_env(env_id: str, **kwargs) -> BaseEnvironment: ...
```
### Generic trainer (`src/ai/trainer.py`)
`NeatTrainer` accepts `env_id: str = "flappy_bird"` and:
1. Loads `FlappyBirdEnv` (or any env) via `get_env_class(env_id)`.
2. Reads `config.toml` and `neat.cfg` from `src/environments/<env_id>/`.
3. Calls `env.reset()` at the start of each generation.
4. In the simulation loop, calls `env.build_sensor_inputs(i)` → network → `env.step(actions)` → `env.compute_fitness(i)`.
5. Broadcasts the serialised state + `env_id` over WebSocket after each tick.
### Config resolution (`src/config.py`)
| Function | Reads from |
|---|---|
| `load_env_game_config(env_id)` | `src/environments/<env_id>/config.toml` |
| `get_neat_config_path(env_id)` | `src/environments/<env_id>/neat.cfg` |
| `load_game_config()` | `config/game.toml` (legacy fallback) |
### Training lifecycle
```
Admin Panel / CLI
      │
      ▼
TrainingManager.start(run_name, env_id, mode, neat_overrides)
      │
      ▼
NeatTrainer.__init__     ← loads env class, reads config, builds NEAT population
      │
      ▼
Thread: NeatTrainer.run()
      │  per generation:
      ▼
  _eval_genomes()
      ├── env.reset()
      ├── loop until env.alive_count == 0 or frame_cap:
      │     ├── env.build_sensor_inputs(i) → network.activate() → actions
      │     ├── env.step(actions)
      │     └── connection_manager.broadcast_state(run_name, {env_id, ...state})
      └── save_champion() if new best
```
### WebSocket payload structure
Every frame broadcast over `ws://localhost:8000/ws/training/{run_name}`:
```json
{
  "env_id": "flappy_bird",
  "type": "training_frame",
  "run_name": "my-run",
  "generation": 12,
  "alive_count": 43,
  "total_birds": 100,
  "generation_best_fitness": 1842.0,
  "generation_average_fitness": 234.5,
  "generation_best_pipes": 18,
  "generation_complete": false,
  "frame": 1024,
  "score": 18,
  "birds": [...],
  "pipes": [...],
  "pickups": [...]
}
```
---
## 6. Frontend Architecture Deep-Dive
### Environment registry (`web/src/environments/index.ts`)
```typescript
export const ENV_IDS = {
  FLAPPY_BIRD: 'flappy_bird',
  // TREX: 'trex',  ← add here
} as const;
export function isFlappyBird(envId: string): boolean { ... }
```
Pages check `env_id` from the WebSocket payload and render the correct canvas component.
### Client-side physics (`web/src/environments/FlappyBird/engine.ts`)
For zero-latency human play, Flappy Bird runs a complete physics simulation in the browser (no round-trip to the server). This is isolated to `FlappyBird/engine.ts`. Slower-paced games like Chess do not need client-side prediction.
### Page structure
| Page | Route | Purpose |
|---|---|---|
| `HomePage` | `/` | Landing, project summary |
| `PlayPage` | `/play` | Human play (client-side physics) |
| `TrainingPage` | `/training` | Live NEAT training monitor |
| `CompetePage` | `/compete` | Race against a saved champion |
| `AdminPage` | `/admin` | Start/stop/resume training runs |
| `LeaderboardPage` | `/leaderboard` | High score leaderboard |
---
## 7. Adding a New Game Environment
This is the core extension workflow. Follow every step in order.
### Step 1 — Create the backend environment package
```bash
mkdir -p src/environments/my_game
touch src/environments/my_game/__init__.py
```
Copy `src/environments/flappy_bird/config.toml` and `neat.cfg` as starting templates:
```bash
cp src/environments/flappy_bird/config.toml src/environments/my_game/config.toml
cp src/environments/flappy_bird/neat.cfg    src/environments/my_game/neat.cfg
```
Edit `config.toml` for your game's parameters and `neat.cfg` to set `num_inputs`, `num_outputs`, `pop_size`, etc.
### Step 2 — Implement your physics/simulation
Create `src/environments/my_game/world.py` (or whatever internal structure you need). You are free to use dataclasses, external libs, or anything — the only contract is the `BaseEnvironment` interface.
### Step 3 — Implement `BaseEnvironment`
Create `src/environments/my_game/env.py`:
```python
from src.core.environment import BaseEnvironment
from src.core.spaces import Discrete, Box
class MyGameEnv(BaseEnvironment):
    env_id = "my_game"
    observation_space = Box(low=-1.0, high=1.0, shape=(N_INPUTS,))
    action_space = Discrete(n=N_ACTIONS)
    def __init__(self, population_size: int = 1, mode: str = "easy"):
        self._pop = population_size
        self._mode = mode
        self._world = None  # your simulation object
    def reset(self, seed=None, options=None):
        # Initialise / restart your world
        self._world = MyGameWorld(population_size=self._pop)
        return self._world.serialize(), {}
    def step(self, actions: dict[int, int]):
        # actions: {agent_index: action_int}
        for idx, action in actions.items():
            self._world.apply_action(idx, action)
        state = self._world.step()
        terminated = self._world.is_over
        rewards = {i: self._world.agents[i].score for i in range(self._pop)}
        return state, rewards, terminated, False, {}
    def get_state(self) -> dict:
        return self._world.serialize()
    def build_sensor_inputs(self, agent_index: int) -> list[float]:
        # Return N_INPUTS normalised floats the NEAT network reads.
        return self._world.get_inputs_for(agent_index)
    def compute_fitness(self, agent_index: int) -> float:
        agent = self._world.agents[agent_index]
        return float(agent.frames_alive + agent.score * 100)
    @property
    def alive_count(self) -> int:
        return sum(1 for a in self._world.agents if a.alive)
    @property
    def frame_count(self) -> int:
        return self._world.frame
```
> **Important:** `build_sensor_inputs()` length must match `num_inputs` in `neat.cfg`.
### Step 4 — Register the environment
Edit `src/environments/registry.py`:
```python
from src.environments.my_game.env import MyGameEnv
REGISTRY = {
    "flappy_bird": FlappyBirdEnv,
    "my_game": MyGameEnv,   # ← add this line
}
```
### Step 5 — Create the frontend renderer
```bash
mkdir -p web/src/environments/MyGame
```
Create `web/src/environments/MyGame/Renderer.tsx`:
```tsx
import { useEffect, useRef } from 'react';
interface Props {
  state: Record<string, unknown>;  // parsed WebSocket payload
}
export function MyGameRenderer({ state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state) return;
    const ctx = canvas.getContext('2d')!;
    // Draw your game state onto ctx using the state payload fields
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // ... drawing logic ...
  }, [state]);
  return <canvas ref={canvasRef} width={800} height={600} />;
}
```
### Step 6 — Register in the frontend
Edit `web/src/environments/index.ts`:
```typescript
export const ENV_IDS = {
  FLAPPY_BIRD: 'flappy_bird',
  MY_GAME: 'my_game',   // ← add this
} as const;
```
### Step 7 — Wire the renderer in the Training and Compete pages
In `web/src/pages/TrainingPage.tsx`, look for the canvas rendering section and add a branch:
```tsx
import { MyGameRenderer } from '../environments/MyGame/Renderer';
// Existing code switches on env_id from the WebSocket frame:
{envId === 'my_game' && <MyGameRenderer state={wsState} />}
{envId === 'flappy_bird' && <FlappyBirdCanvas state={wsState} />}
```
### Step 8 — Verify
```bash
# Run all tests (should still pass — Flappy Bird is untouched)
uv run pytest tests/ -v
# TypeScript check
cd web && npx tsc --noEmit
# Start training with your new env
uv run python -m src.main --serve
# Then from Admin panel, start a run with env_id = "my_game"
```
---
## 8. Testing Strategy
### Backend tests
Located in `tests/`. Run with:
```bash
uv run pytest tests/ -v
```
**`test_physics.py`** — Unit tests for the game simulation layer (`World`, `Bird`, sensors). These import from `src.game.*` (via shims) and confirm the physics are correct in isolation.
**`test_api.py`** — FastAPI endpoint integration tests using `TestClient`. Covers health, training status, game state, admin auth, and leaderboard endpoints.
#### Writing tests for a new environment
```python
# tests/test_my_game.py
from src.environments.my_game.env import MyGameEnv
def test_my_game_reset_returns_valid_state():
    env = MyGameEnv(population_size=5)
    state, info = env.reset()
    assert "frame" in state
    assert env.alive_count == 5
def test_my_game_step_decrements_alive_on_collision():
    env = MyGameEnv(population_size=1)
    env.reset()
    # Force a collision and assert alive_count drops
    ...
```
### Frontend
```bash
# Type-check only (fast)
cd web && npx tsc --noEmit
# Production build (catches bundler errors)
cd web && npm run build
```
---
## 9. Code Style and Tooling
### Python
| Tool | Config | Usage |
|---|---|---|
| `ruff` | `pyproject.toml` | Lint + formatting |
| `mypy` (optional) | — | Type checking |
| `pytest` | `pyproject.toml` | Testing |
```bash
uv run ruff check src          # lint
uv run ruff format src         # format
uv run pytest tests/ -v        # tests
```
**Line length:** 88 characters (Ruff default).
**Imports:** absolute imports only (`from src.core.environment import BaseEnvironment`).
**Type hints:** all new functions must have full type annotations.
### TypeScript / React
```bash
cd web
npx tsc --noEmit   # type check
npm run build      # production build
```
**No `any`:** avoid TypeScript `any` — define proper interfaces for WebSocket payloads.
**Component convention:** functional components with hooks. No class components.
---
## 10. WebSocket Protocol Reference
### Training stream
**Connect:** `ws://localhost:8000/ws/training/{run_name}`
**Direction:** server → client only (client sends keepalive text, ignored by server).
**Frame payload (every simulation tick):**
```jsonc
{
  // Envelope
  "env_id": "flappy_bird",        // which environment is training
  "type": "training_frame",
  "run_name": "spring-run",
  "generation": 42,
  "mode": "hard",
  // Population stats
  "alive_count": 37,
  "total_birds": 100,
  "generation_best_fitness": 2400.0,
  "generation_average_fitness": 512.3,
  "generation_best_pipes": 24,
  "best_fitness": 5800.0,         // all-time best for this run
  "best_pipes": 58,
  "species_count": 5,
  // Control
  "generation_complete": false,
  "generation_end_reason": null,  // "all_birds_dead" | "frame_cap" | "stopped"
  "champion_available": true,
  "champion_saved_this_generation": false,
  // Flappy Bird state payload (changes per env_id)
  "frame": 2048,
  "score": 24,
  "game_over": false,
  "birds": [{ "x": 160, "y": 280, "alive": true, ... }],
  "pipes": [{ "x": 600, "gap_y": 280, "gap_size": 160, ... }],
  "pickups": [],
  // Optional — included at end of generation
  "history": [{ "generation": 1, "max_fitness": 400, ... }],
  "focus_network": { "nodes": [...], "connections": [...] }
}
```
### Compete stream
**Connect:** `ws://localhost:8000/ws/compete`
Client sends: `{ "run_name": "spring-run" }` to load a champion.
Server streams: per-frame champion position for the frontend to overlay on the canvas.
---
## 11. Troubleshooting
### `uv run pytest` fails with import errors
Make sure you have activated the venv or are using `uv run`:
```bash
uv run pytest tests/ -v
```
### Frontend can't connect to backend
Check `.env.web` has the correct `VITE_API_BASE_URL`. The FastAPI CORS config in `src/server/app.py` allows `http://localhost:5173` by default.
### Training does nothing visible in the browser
1. Confirm the backend is started with `--serve`.
2. Check the browser console for WebSocket errors.
3. Hit `GET http://localhost:8000/training/status` — `is_running` should be `true`.
### NEAT config mismatch (wrong number of inputs/outputs)
When adding a new environment, `num_inputs` in `neat.cfg` must exactly match the length of the list returned by `build_sensor_inputs()`. A mismatch will raise a `neat-python` error at the first `network.activate()` call.
### `normalize_game_mode` raises `ValueError`
Each environment's `config.toml` must have a `[modes]` section. The default mode `"easy"` must be present. Check `src/environments/<env_id>/config.toml`.
---
*Last updated: March 2026 — NeuroArena v1.0 (post-transformation)*
