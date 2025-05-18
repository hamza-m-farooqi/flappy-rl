# flappy-rl

`flappy-rl` is a browser-first Flappy Bird + neuroevolution project built with a Python
backend and a React frontend. It currently supports local human play, live browser-based
training visualization, and MongoDB-backed leaderboard submissions.

## Current Features

- FastAPI backend with REST and WebSocket endpoints
- local Pygame Flappy Bird runtime for manual play
- browser play mode with client-side physics for low-latency controls
- live training monitor that streams a NEAT-controlled bird swarm over WebSocket
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

Start the Phase 1/2 style dev helper:

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
