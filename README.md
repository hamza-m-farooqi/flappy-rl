# flappy-rl

`flappy-rl` is a browser-first Flappy Bird + neuroevolution platform. The long-term project
combines a Python game/AI backend with a React frontend for play mode, live training
visualization, leaderboards, and admin controls.

## Project Structure

```text
flappy-rl/
├── src/
│   ├── main.py
│   └── server/
│       └── app.py
├── scripts/
│   ├── commit.sh
│   └── dev.sh
├── web/
│   ├── src/
│   │   ├── components/
│   │   └── pages/
│   └── package.json
├── docs/
├── pyproject.toml
└── uv.lock
```

## Requirements

- Python 3.10+
- `uv`
- Node.js + npm

## Development Environment

Create or sync the Python environment:

```bash
uv sync
```

Install frontend dependencies:

```bash
cd web
npm install
```

## Development Workflow

Start backend and frontend together:

```bash
./scripts/dev.sh
```

Run backend only:

```bash
uv run python -m src.main
```

Run frontend only:

```bash
cd web
npm run dev
```

Local endpoints:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000`
- backend health: `http://localhost:8000/health`
