# NeuroArena — Technical Documentation

This document serves as a comprehensive technical guide to the **NeuroArena** project (`neuro-arena`). It offers a bird's eye view of the system, outlines the technical architecture, enumerates the tech stack, and provides detailed code-level explanations with clickable references.

> For local development setup and environment implementation instructions, see [`docs/developer-guide.md`](./docs/developer-guide.md).

---

## 🦅 Bird's Eye View

The **NeuroArena** platform is a web-first application designed for training, monitoring, and competing against Reinforcement Learning agents across multiple game environments.
At its core, the project applies the **NEAT (NeuroEvolution of Augmenting Topologies)** algorithm to evolve a population of neural networks that learn to play games through neuroevolution.

Key interactions:
1. **Human Play:** Users can play the game locally using a Pygame interface or via the browser using client-side physics.
2. **Training & Evolution:** A Python backend trains generations of agents using NEAT. Live training progress (positions, scores, fitness) is streamed over WebSockets to a React frontend.
3. **Monitor & Admin:** Users can start, stop, or resume named training runs from a browser-based admin panel.
4. **Competitions:** A player can choose a saved AI "champion" and race against it in their browser.
5. **Multi-Environment:** The `BaseEnvironment` interface allows any number of new game environments to be added without touching the trainer, server, or frontend pages.

---

## 🏛 Architecture

The architecture relies on a clear separation of concerns, emphasising modularity between the game simulation layer, the AI framework, the API server, and the frontend web layer.

### 1. Core Abstraction (`src/core/`)
The `BaseEnvironment` abstract class defines the contract all game environments must implement — modelled after OpenAI Gymnasium. The `Discrete`, `Box`, and `MultiDiscrete` space classes declare the shape of a game's inputs and outputs, enabling the generic trainer to create the correct network topology dynamically.

### 2. Environment Layer (`src/environments/`)
Each game lives in its own subdirectory (`src/environments/flappy_bird/`, etc.) with its physics simulation, sensor computation, config files, and `neat.cfg`. The environment registry (`registry.py`) maps `env_id` strings to concrete classes so the trainer and server can load them dynamically.

### 3. Game Simulation — Flappy Bird (`src/environments/flappy_bird/`)
A pure Python implementation of the physics and world mechanics operates independently of any rendering engine. This allows it to run headless during fast-paced AI training, or attach to Pygame for local human play. The client-side React component replicates this physics model for a zero-latency browser experience.

### 4. AI & NEAT Runtime (`src/ai/`)
The generic `NeatTrainer` accepts an `env_id` and drives the simulation entirely through the `BaseEnvironment` interface (`reset()` / `step()` / `build_sensor_inputs()` / `compute_fitness()`). It checkpoints states, tracks all-time champions, and interfaces with the WebSocket layer.

### 5. API & WebSockets (`src/server/`)
The FastAPI server bridges the backend ML tasks and the browser. REST endpoints handle authentication and database interactions (leaderboard) while persistent WebSocket connections stream real-time training telemetry. Every frame payload includes `env_id` so the frontend can route to the correct renderer.

### 6. Frontend Web App (`web/src/`)
A React-based SPA. The `web/src/environments/` directory contains per-environment rendering components. The training and compete pages inspect `env_id` from the WebSocket payload and mount the correct canvas renderer dynamically.

---

## 🛠 Tech Stacks Used

### Backend
- **Language:** Python 3.10+
- **Package Management:** `uv`
- **Web Framework:** FastAPI, Uvicorn (ASGI)
- **AI/ML:** `neat-python` (Neuroevolution of Augmenting Topologies)
- **Database:** MongoDB (Async driver: `motor`)
- **WebSockets:** Standard ASGI / WebSockets library
- **Rendering (Local):** `pygame-ce`

### Frontend
- **Framework:** React + Vite
- **Language:** TypeScript
- **Styling:** Vanilla CSS / Modules
- **State Management:** Zustand
- **Routing:** React Router DOM (`react-router-dom`)
- **Charting & Visualisations:** Recharts, HTML5 Canvas
- **Icons:** Lucide React

---

## 📖 Detailed Technical Documentation

### 1. The Entrypoint
The backend runtime allows different modes (e.g., `--human`, `--train`, `--serve`, `--resume`). It parses CLI arguments and orchestrates whether to launch the API, a Pygame window, or a background training thread.
- **Reference:** [`src/main.py` Argument Parsing Section](./src/main.py#L14-L48)
- **Reference:** [`src/main.py` Main Execution Switch](./src/main.py#L100-L127)

### 2. Core Abstraction
The `BaseEnvironment` interface defines the contract all environments must implement.
- **Reference:** [`src/core/environment.py`](./src/core/environment.py) — abstract class with `reset()`, `step()`, `get_state()`, `build_sensor_inputs()`, `compute_fitness()`.
- **Reference:** [`src/core/spaces.py`](./src/core/spaces.py) — `Discrete`, `Box`, `MultiDiscrete` space descriptors.
- **Reference:** [`src/environments/registry.py`](./src/environments/registry.py) — maps `env_id` → `BaseEnvironment` subclass.

### 3. Flappy Bird Environment
The `FlappyBirdEnv` adapter wraps the existing physics simulation behind the `BaseEnvironment` interface.
- **Reference:** [`src/environments/flappy_bird/env.py`](./src/environments/flappy_bird/env.py) — `FlappyBirdEnv`.
- **Reference:** [`src/environments/flappy_bird/world.py`](./src/environments/flappy_bird/world.py) — physics simulation.
- **Reference:** [`src/environments/flappy_bird/sensors.py`](./src/environments/flappy_bird/sensors.py) — 7-input normalised sensor vector.
- **Config:** [`src/environments/flappy_bird/config.toml`](./src/environments/flappy_bird/config.toml) and [`neat.cfg`](./src/environments/flappy_bird/neat.cfg).

### 4. AI and Neuroevolution (NEAT)
The `NeatTrainer` is environment-agnostic — it communicates with any environment only via the `BaseEnvironment` interface.
- **Reference:** [`src/ai/trainer.py`](./src/ai/trainer.py) — generic `NeatTrainer` with `env_id` parameter.
- **Reference:** [`src/ai/neat_runtime.py`](./src/ai/neat_runtime.py) — NEAT config building, network serialisation.
- **Reference:** [`src/ai/genome_io.py`](./src/ai/genome_io.py) — champion/checkpoint persistence; persists `env_id` in `run.json`.

### 5. API Server and WebSocket Streaming
- **Reference:** [`src/server/app.py`](./src/server/app.py) — FastAPI app factory + WebSocket route at `/ws/training/{run_name}`.
- **Reference:** [`src/server/ws_handler.py`](./src/server/ws_handler.py) — `ConnectionManager` with per-run subscriber lists.
- **Reference:** [`src/server/training_manager.py`](./src/server/training_manager.py) — manages multiple concurrent `NeatTrainer` instances; accepts `env_id`.
- **Reference:** [`src/server/auth.py`](./src/server/auth.py) — JWT admin authentication.

### 6. Frontend & React Client
- **Reference:** [`web/src/environments/index.ts`](./web/src/environments/index.ts) — frontend environment registry with `ENV_IDS` constants.
- **Reference:** [`web/src/environments/FlappyBird/engine.ts`](./web/src/environments/FlappyBird/engine.ts) — client-side Flappy Bird physics.
- **Reference:** [`web/src/App.tsx`](./web/src/App.tsx) — routing structure.
- **Reference:** [`web/src/index.css`](./web/src/index.css) — global styles and utility classes.
