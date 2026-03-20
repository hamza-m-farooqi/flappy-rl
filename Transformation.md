# RL Platform Transformation Plan

## 🎯 The Vision
Transform `flappy-rl` from a single-game monolithic application into a **General Multi-Environment RL Sandbox**. 

In the future, this platform will support highly complex, continuous, and discrete environments, including but not limited to:
- **T-Rex Run** (Simple side-scroller)
- **4-Way Traffic Intersection** (Multi-agent, continuous state/action spaces, coordination)
- **Chess** (Turn-based, discrete grid, self-play / adversarial)
- **Flappy Bird** (The existing baseline)

This document is a step-by-step roadmap for an AI agent to execute this architectural transformation securely and methodically.

---

## 🏗 Phase 1: The Core Abstraction Layer (Backend)
The backend must adopt an `Interface` pattern similar to OpenAI Gym or PettingZoo to handle varying environment complexities.

### 1. Define the `BaseEnvironment` Interface
Create a generic interface (e.g., in `src/core/environment.py`) that all future games will inherit. It must handle multi-agent and turn-based scaling:
- `reset(seed=None, options=None) -> tuple[Observation, Info]`
- `step(action: ActionType) -> tuple[Observation, Reward, Terminated, Truncated, Info]`
  - *Note:* `action` could be a dictionary for multi-agent environments (e.g., multiple cars in an intersection).
- `get_state() -> dict` (For WebSocket streaming to the frontend)
- `render()` (Optional local pygame hook)

### 2. Define Action & Observation Spaces
Implement standard space classes (e.g., `Discrete`, `Box`, `MultiDiscrete`) so the NEAT configuration and future RL algorithms know dynamically what inputs/outputs to construct.

### 3. Migrate Flappy Bird
- Move `src/game/` to `src/environments/flappy_bird/`.
- Wrap the Flappy Bird engine in the new `BaseEnvironment` interface.

---

## 🧠 Phase 2: Decoupling the AI / NEAT Runtime
Currently, the `NeatTrainer` (`src/ai/trainer.py` and `neat_runtime.py`) is hardcoded to expect Flappy Bird properties (e.g., `bird.y`, `pipe.x`).

### 1. Generic AI Trainer Interface
- The trainer should accept an `env_id` and dynamically load the corresponding `BaseEnvironment` class.
- The `eval_genomes` function must be generalized. Instead of explicitly calling `world.jump()`, it should pass the neural network's output array directly into the environment's `step(action)` method.

### 2. Standardize Configuration 
- Move `config/game.toml` and NEAT configs into environment-specific directories (e.g., `src/environments/flappy_bird/config.toml`, `src/environments/traffic/config.toml`).

### 3. Multi-Agent & Adversarial Support
- Prepare the trainer loop to handle **Self-Play** (for Chess) and **Cooperative Multi-Agent** (for the Traffic Intersection).

---

## 🔌 Phase 3: WebSocket & Server Standardization
The FastAPI server maps API routes and WebSocket streams to rigid concepts. This needs to become dynamic.

### 1. State Normalization
Update `ws_handler.py`. Instead of sending `{ birds: [...], pipes: [...] }`, standardise the outgoing payload format:
```json
{
  "env_id": "traffic_intersection",
  "generation": 5,
  "state_payload": {
    "cars": [...],
    "collision_zones": [...]
  }
}
```

### 2. Database Schema Migrations
- Update MongoDB collections (`runs`, `champions`, `leaderboard`) to include `env_id: str`.
- Ensure querying respects the environment filters.

---

## 🎨 Phase 4: Frontend Modularization
The React App (`web/src/`) currently hardcodes Flappy Bird rendering and client-side physics.

### 1. Environment Registry
Implement a dynamic view loader. Based on the selected `env_id` from the dashboard, load the correct visualization module.
- `web/src/environments/FlappyBird/Renderer.tsx`
- `web/src/environments/Traffic/Renderer.tsx`
- `web/src/environments/Chess/Renderer.tsx`

### 2. Dashboard UI
- Build a game selection "Lobby".
- Users choose the environment they want to interact with, train, or watch.

### 3. Decouple Client-Side Prediction (Optional per Env)
For games requiring zero-latency human play (Flappy, T-Rex), the client-side physics loop must be isolated to that specific environment's React component. For slower games (Chess) or massive multi-agent games (Traffic), the frontend can rely strictly on the WebSocket stream without local physics prediction.

---

## 📝 Execution Protocol for AI Agent
When beginning this transformation, strictly adhere to this order of operations:
1. **Do not break the app.** Ensure the existing Flappy Bird game remains functional during Phase 1 & 2.
2. Complete the abstraction (`BaseEnvironment`) first.
3. Migrate Flappy Bird into the abstraction and verify tests pass.
4. Refactor the `NeatTrainer` to rely strictly on `step()` and `reset()`.
5. Update WebSocket payloads and update the React frontend to parse them dynamically.
6. **Verification Step:** Once done with implementation, inform , the human will verify that current flappy bird game works... if it works, then we can continue with implementation of other games... 
