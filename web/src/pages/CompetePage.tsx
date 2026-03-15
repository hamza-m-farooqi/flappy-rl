import { useEffect, useState } from 'react';
import axios from 'axios';
import { GameCanvas } from '../components/GameCanvas';
import { API_BASE_URL } from '../config/env';
import { useCompeteSocket } from '../hooks/useCompeteSocket';

type ChampionSummary = {
  run_name: string;
  best_score: number | null;
  best_fitness: number | null;
  last_saved_generation: number | null;
};

export function CompetePage() {
  const [champions, setChampions] = useState<ChampionSummary[]>([]);
  const [selectedRunName, setSelectedRunName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { frame, status, errorMessage } = useCompeteSocket(selectedRunName);

  useEffect(() => {
    let active = true;

    const loadChampions = async () => {
      try {
        const response = await axios.get<{ champions: ChampionSummary[] }>(
          `${API_BASE_URL}/compete/champions`,
        );
        if (!active) {
          return;
        }
        setChampions(response.data.champions);
        setLoadError(null);
      } catch (error) {
        if (!active) {
          return;
        }
        setLoadError(
          error instanceof Error ? error.message : 'Unable to load champion catalog.',
        );
      }
    };

    void loadChampions();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="page page-training">
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">Compete</p>
          <h1>Choose a Champion</h1>
          <p className="lede">
            Pick a saved training run, then race its champion in a shared pipe sequence.
            Press <code>Space</code> to jump once the race starts.
          </p>
        </div>
        <div className="heading-side">
          <span className={`status-chip ${status === 'connected' ? 'live' : 'idle'}`}>
            {status === 'connected' ? 'Race live' : selectedRunName ? 'Preparing race' : 'Awaiting champion'}
          </span>
        </div>
      </div>

      {loadError ? <p className="status-banner error">{loadError}</p> : null}
      {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}

      <div className="table-card">
        <div className="table-header-copy">
          <div>
            <h2>Champion catalog</h2>
            <p>Saved runs are unchanged; the table is just clearer and easier to scan.</p>
          </div>
        </div>
        <div className="leaderboard-shell">
          <div className="leaderboard-head leaderboard-row">
            <span>Champion</span>
            <span>Best Score</span>
            <span>Best Fitness</span>
            <span>Action</span>
          </div>
          {champions.map((champion) => (
            <div key={champion.run_name} className="leaderboard-row">
              <span className="row-emphasis">{champion.run_name}</span>
              <span>{champion.best_score ?? '-'}</span>
              <span>{champion.best_fitness ? Math.round(champion.best_fitness) : '-'}</span>
              <span className="row-actions">
                <button
                  className="action-button small"
                  onClick={() => setSelectedRunName(champion.run_name)}
                >
                  Race This Champion
                </button>
              </span>
            </div>
          ))}
          {champions.length === 0 && !loadError ? (
            <p className="status-banner">
              No champions are available yet. Finish a named training run first.
            </p>
          ) : null}
        </div>
      </div>

      {selectedRunName ? (
        <>
          {frame ? (
            <div className="content-grid">
              <div className="canvas-panel">
                <GameCanvas
                  gameState={{
                    ...frame,
                    birds: [
                      { ...frame.human_bird, genome_id: 'human' },
                      { ...frame.ai_bird, genome_id: 'ai' },
                    ],
                  }}
                  overlayText={
                    frame.winner
                      ? frame.winner === 'human'
                        ? 'You Won'
                        : frame.winner === 'ai'
                          ? 'AI Wins'
                          : 'Tie Game'
                      : undefined
                  }
                />

              </div>

              <div className="stats-panel">
                <div className="training-stats training-stats-compact">
                  <div className="stat-pill stat-pill-compact">
                    <span className="stat-label">Selected run</span>
                    <span className="stat-value">{selectedRunName}</span>
                  </div>
                  <div className="stat-pill stat-pill-compact">
                    <span className="stat-label">Race state</span>
                    <span className="stat-value">
                      {status === 'connecting'
                        ? 'Connecting'
                        : status === 'connected'
                          ? 'Live'
                          : status === 'closed'
                            ? 'Closed'
                            : status === 'error'
                              ? 'Error'
                              : 'Waiting'}
                    </span>
                  </div>
                  {frame ? (
                    <div className="stat-pill stat-pill-compact">
                      <span className="stat-label">You</span>
                      <span className="stat-value">{frame.human_score}</span>
                    </div>
                  ) : null}
                  {frame ? (
                    <div className="stat-pill stat-pill-compact">
                      <span className="stat-label">AI</span>
                      <span className="stat-value">{frame.ai_score}</span>
                    </div>
                  ) : null}
                  <div className="stat-pill stat-pill-compact">
                    <span className="stat-label">Colors</span>
                    <span className="stat-value">You blue, AI orange</span>
                  </div>
                  {frame ? (
                    <div className="stat-pill stat-pill-compact">
                      <span className="stat-label">Lead</span>
                      <span className="stat-value">
                        {frame.human_score > frame.ai_score
                          ? 'You'
                          : frame.ai_score > frame.human_score
                            ? 'AI'
                            : 'Tie'}
                      </span>
                    </div>
                  ) : null}
                  {frame ? (
                    <div className="stat-pill stat-pill-compact">
                      <span className="stat-label">Result</span>
                      <span className="stat-value">
                        {frame.winner
                          ? frame.winner === 'human'
                            ? 'You won'
                            : frame.winner === 'ai'
                              ? 'AI wins'
                              : 'Tie'
                          : 'In progress'}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="quick-actions">
                  <button className="ghost-button" onClick={() => setSelectedRunName(null)}>
                    Change Champion
                  </button>
                </div>

                <div className="split-header">
                  <div>
                    <h2>Pilot controls</h2>
                    <p>Use keyboard or pointer input exactly as before.</p>
                  </div>
                </div>
                <ul className="bullet-list">
                  <li>Press <code>Space</code> to jump and to start.</li>
                  <li>Press <code>R</code> to reset at any time.</li>
                  <li>Tap or click during a live run for pointer-based jumps.</li>
                </ul>
              </div>
            </div>
          ) : (
            <p className="status-banner">
              {status === 'connecting'
                ? 'Opening compete session...'
                : 'Waiting for the selected champion session to start.'}
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
