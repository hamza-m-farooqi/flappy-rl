import { useState } from 'react';
import axios from 'axios';
import { GameCanvas } from '../components/GameCanvas';
import { API_BASE_URL } from '../config/env';
import { listGameModes, type GameMode } from '../game/engine';
import { usePlaySession } from '../hooks/usePlaySession';

// Registered playable environments. Extend this list as new envs ship.
const REGISTERED_ENVS: { env_id: string; label: string }[] = [
  { env_id: 'flappy_bird', label: 'Flappy Bird' },
  // { env_id: 'trex_run', label: 'T-Rex Run' }, // uncomment when implemented
];

export function PlayPage() {
  const [envId, setEnvId] = useState('flappy_bird');
  const [mode, setMode] = useState<GameMode>('easy');
  const { hasStarted, playState, restart } = usePlaySession(mode);
  const [username, setUsername] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeEnvLabel = REGISTERED_ENVS.find((e) => e.env_id === envId)?.label ?? envId;

  const handleEnvChange = (newEnvId: string) => {
    setEnvId(newEnvId);
    restart();
  };

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
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">NeuroArena · {activeEnvLabel} · Play</p>
          <h1>Browser Play Mode</h1>
          <p className="lede">
            Client-side physics run directly in your browser for instant response. Choose a
            game and difficulty mode, press <code>Space</code> to start, and keep tapping to
            fly. Submit your score to the global leaderboard when the run ends.
          </p>
        </div>
        <div className="heading-side">
          <span className={`status-chip ${playState.game_over ? 'idle' : hasStarted ? 'live' : 'idle'}`}>
            {playState.game_over ? 'Round complete' : hasStarted ? 'Session live' : 'Ready to start'}
          </span>
        </div>
      </div>

      <div className="content-grid">
        <div className="canvas-panel">
          {/* Game / environment selector */}
          {REGISTERED_ENVS.length > 1 ? (
            <div className="mode-switcher">
              {REGISTERED_ENVS.map((env) => (
                <button
                  key={env.env_id}
                  type="button"
                  className={env.env_id === envId ? 'mode-chip active' : 'mode-chip'}
                  onClick={() => handleEnvChange(env.env_id)}
                >
                  {env.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="mode-switcher env-switcher-single">
              <span className="env-label-single">{activeEnvLabel}</span>
            </div>
          )}
          {/* Difficulty mode chips */}
          <div className="mode-switcher">
            {listGameModes().map((option) => (
              <button
                key={option.key}
                type="button"
                className={option.key === mode ? 'mode-chip active' : 'mode-chip'}
                onClick={() => setMode(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <GameCanvas
            gameState={playState}
            overlayText={playState.game_over ? 'Game Over' : !hasStarted ? 'Press Space To Start' : undefined}
          />
        </div>

        <div className="stats-panel">
          <div className="training-stats">
            <div className="stat-pill">
              <span className="stat-label">Environment</span>
              <span className="stat-value">{activeEnvLabel}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Mode</span>
              <span className="stat-value">{mode}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Score</span>
              <span className="stat-value">{playState.score}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Pipe speed</span>
              <span className="stat-value">{playState.difficulty.pipe_speed.toFixed(2)}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Gap size</span>
              <span className="stat-value">{Math.round(playState.difficulty.gap_size)}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">State</span>
              <span className="stat-value">
                {playState.game_over ? 'Game over' : hasStarted ? 'Running' : 'Ready'}
              </span>
            </div>
          </div>

          <div className="split-header">
            <div>
              <h2>Pilot controls</h2>
              <p>Keyboard and pointer input both supported.</p>
            </div>
          </div>
          <ul className="bullet-list">
            <li>Press <code>Space</code> to jump and to start the game.</li>
            <li>Press <code>R</code> to restart at any time.</li>
            <li>Tap or click anywhere during a live run for pointer-based jumps.</li>
          </ul>

          {playState.game_over ? (
            <div className="submit-panel">
              <div className="submit-copy">
                <h2>Submit your score</h2>
                <p>Save this run to the global leaderboard, or restart and try for a better score.</p>
              </div>
              <div className="submit-form">
                <input
                  className="text-input"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="YourHandleHere"
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
                <p className="status-banner success">Score submitted successfully.</p>
              ) : null}
              {submitState === 'error' && errorMessage ? (
                <p className="status-banner error">{errorMessage}</p>
              ) : null}
            </div>
          ) : (
            <div className="panel-card">
              <h2>Leaderboard</h2>
              <p>Once the round ends, the score submission panel appears here. You can also view all scores on the <a href="/leaderboard">Leaderboard</a> page.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
