# flappy-rl

`flappy-rl` is a browser-first Flappy Bird + neuroevolution project built with a Python
backend and a React frontend. It currently supports local human play, live browser-based
training visualization, MongoDB-backed leaderboard submissions, and human-vs-AI compete
mode using a saved champion genome.

## Current Features

- FastAPI backend with REST and WebSocket endpoints
- local Pygame Flappy Bird runtime for manual play
- browser play mode with client-side physics for low-latency controls
- live training monitor that streams a NEAT-controlled bird swarm over WebSocket
- training monitor that shows game score and fitness separately
- compete mode that races the browser player against a saved AI champion
- champion genome persistence in `checkpoints/champion.pkl`
- historical best-checkpoint snapshots such as `checkpoints/generation5-3300.pkl`
- resumable NEAT population checkpoints such as `checkpoints/neat-checkpoint-5`
- leaderboard API with MongoDB persistence
- leaderboard page and browser score submission flow
- shared game configuration via `config/game.toml`

## Stack

- Python 3.10+
- `uv`
- FastAPI
- `neat-python`
- `pygame-ce`
- MongoDB via `motor`
- React + Vite + TypeScript

## Project Structure

```text
flappy-rl/
├── config/              # Game and NEAT configuration
├── src/
│   ├── ai/              # NEAT training layer
│   ├── db/              # MongoDB client
│   ├── game/            # Python game simulation and pygame renderer
│   ├── server/          # FastAPI app, routers, websocket handling
│   └── main.py          # Local runtime entrypoint
├── scripts/             # Dev and commit helpers
├── web/                 # React frontend
└── docs/                # Project planning and architecture notes
```

## Environment Setup

Backend environment:

```bash
uv sync
```

Frontend environment:

```bash
cd web
npm install
```

Backend env file:

```bash
cp .env.server.example .env.server
```

Frontend env file:

```bash
cp .env.web.example .env.web
```

## Environment Variables

Backend `.env.server`:

```bash
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=flappy_rl
```

Frontend `.env.web`:

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_TRAINING_WS_URL=ws://localhost:8000/ws/training
VITE_COMPETE_WS_URL=ws://localhost:8000/ws/compete
```

## Running Locally

Start the standard backend API:

```bash
uv run python -m src.main
```

Start the frontend:

```bash
cd web
npm run dev
```

Start the local Pygame human-play mode:

```bash
uv run python -m src.main --human
```

Start live NEAT training with the backend server:

```bash
uv run python -m src.main --train --serve
```

Resume live NEAT training from the latest saved population checkpoint:

```bash
uv run python -m src.main --train --serve --resume
```

Training automatically updates `checkpoints/champion.pkl` only when a generation
produces a new all-time best result. Each new all-time best also saves a historical
snapshot such as `checkpoints/generation5-3300.pkl`, where the number is the
generation and the best pipe score from that saved champion.

Training also saves resumable population checkpoints such as
`checkpoints/neat-checkpoint-5` every few generations. These checkpoints contain the
full NEAT population state and are what `--resume` uses to continue training after a
restart. `champion.pkl` is still used for compete mode and best-model loading.

Run compete mode:

1. make sure a champion genome exists from a prior training run
2. start the backend:

```bash
uv run python -m src.main
```

3. start the frontend:

```bash
cd web
npm run dev
```

4. open:

```text
http://localhost:5173/compete
```

Start the standard dev helper:

```bash
sh scripts/dev.sh
```

This starts the normal API server plus the Vite dev server. For live training, use the
separate `--train --serve` command above instead.

## Local URLs

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000`
- backend health: `http://localhost:8000/health`
- training websocket: `ws://localhost:8000/ws/training`
- compete websocket: `ws://localhost:8000/ws/compete`

## Verification

Backend lint:

```bash
uv run ruff check src
```

Frontend build:

```bash
cd web
npm run build
```
