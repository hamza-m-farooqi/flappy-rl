import { useEffect, useState } from 'react';
import axios from 'axios';
import { GameCanvas, type GameState } from '../components/GameCanvas';

const API_BASE_URL = 'http://localhost:8000';
const POLL_INTERVAL_MS = 250;

export function TrainingPage() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadState = async () => {
      try {
        const response = await axios.get<GameState>(`${API_BASE_URL}/game/state`);
        if (!active) {
          return;
        }
        setGameState(response.data);
        setErrorMessage(null);
      } catch (error) {
        if (!active) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Unable to fetch game state.';
        setErrorMessage(message);
      }
    };

    void loadState();
    const intervalId = window.setInterval(() => {
      void loadState();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="page page-training">
      <div className="training-copy">
        <p className="eyebrow">Training</p>
        <h1>Simulation Canvas</h1>
        <p className="lede">
          Phase 2 renders the Python world state in the browser by polling the backend and
          drawing the bird and pipes on a canvas.
        </p>
      </div>

      {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}
      {!gameState && !errorMessage ? (
        <p className="status-banner">Loading game state...</p>
      ) : null}

      {gameState ? (
        <>
          <div className="training-stats">
            <div className="stat-pill">Frame {gameState.frame}</div>
            <div className="stat-pill">Score {gameState.score}</div>
            <div className="stat-pill">
              {gameState.game_over ? 'State: game over' : 'State: running'}
            </div>
          </div>
          <GameCanvas gameState={gameState} />
        </>
      ) : null}
    </section>
  );
}
