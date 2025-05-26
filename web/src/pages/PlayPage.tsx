import { useState } from 'react';
import axios from 'axios';
import { GameCanvas } from '../components/GameCanvas';
import { API_BASE_URL } from '../config/env';
import { usePlaySession } from '../hooks/usePlaySession';

export function PlayPage() {
  const { hasStarted, playState, restart, start } = usePlaySession();
  const [username, setUsername] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitScore = async () => {
    if (!playState.game_over || !username.trim()) {
      return;
    }

    try {
      setSubmitState('saving');
      setErrorMessage(null);
      await axios.post(`${API_BASE_URL}/leaderboard`, {
        username: username.trim(),
        score: playState.score,
      });
      setSubmitState('saved');
    } catch (error) {
      setSubmitState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit score.');
    }
  };

  return (
    <section className="page page-play">
      <div className="training-copy">
        <p className="eyebrow">Play</p>
        <h1>Browser Play Mode</h1>
        <p className="lede">
          Local physics run directly in the browser for instant jump response. Press
          <code>Start Game</code> or <code>Space</code> to begin, then keep using
          <code>Space</code> or tap to fly. Press <code>R</code> to restart anytime.
        </p>
      </div>

      <div className="training-stats">
        <div className="stat-pill">Score {playState.score}</div>
        <div className="stat-pill">Frame {playState.frame}</div>
        <div className="stat-pill">
          {playState.game_over ? 'State: game over' : hasStarted ? 'State: running' : 'State: ready'}
        </div>
      </div>

      <GameCanvas
        gameState={playState}
        overlayText={playState.game_over ? 'Game Over' : !hasStarted ? 'Press Space To Start' : undefined}
      />

      {!hasStarted && !playState.game_over ? (
        <div className="submit-form">
          <button className="action-button" onClick={start}>
            Start Game
          </button>
        </div>
      ) : null}

      {playState.game_over ? (
        <div className="submit-panel">
          <div className="submit-copy">
            <h2>Submit your score</h2>
            <p>Save this run to the leaderboard, or restart and try for a better score.</p>
          </div>
          <div className="submit-form">
            <input
              className="text-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="ChampionUser"
              maxLength={32}
            />
            <button className="action-button" onClick={submitScore} disabled={submitState === 'saving'}>
              {submitState === 'saving' ? 'Saving...' : 'Submit Score'}
            </button>
            <button className="ghost-button" onClick={restart}>
              Restart
            </button>
          </div>
          {submitState === 'saved' ? (
            <p className="status-banner">Score submitted successfully.</p>
          ) : null}
          {submitState === 'error' && errorMessage ? (
            <p className="status-banner error">{errorMessage}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
