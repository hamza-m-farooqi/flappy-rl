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
  const { frame, status, errorMessage, jump, restart } = useCompeteSocket(selectedRunName);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      const tagName = target.tagName;
      return (
        target.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT'
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || !selectedRunName) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        jump();
      }

      if (event.code === 'KeyR') {
        restart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [jump, restart, selectedRunName]);

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
      <div className="training-copy">
        <p className="eyebrow">Compete</p>
        <h1>Choose a Champion</h1>
        <p className="lede">
          Pick a saved training run, then race its champion in a shared pipe sequence.
          Press <code>Space</code> to jump once the race starts.
        </p>
      </div>

      {loadError ? <p className="status-banner error">{loadError}</p> : null}
      {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}

      <div className="leaderboard-shell">
        <div className="leaderboard-head leaderboard-row">
          <span>Champion</span>
          <span>Best Score</span>
          <span>Best Fitness</span>
          <span>Action</span>
        </div>
        {champions.map((champion) => (
          <div key={champion.run_name} className="leaderboard-row">
            <span>{champion.run_name}</span>
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

      {selectedRunName ? (
        <>
          <div className="training-stats">
            <div className="stat-pill">Selected run {selectedRunName}</div>
            <div className="stat-pill">
              {status === 'connecting'
                ? 'Connecting race...'
                : status === 'connected'
                  ? 'Race live'
                  : status === 'closed'
                    ? 'Race closed'
                    : status === 'error'
                      ? 'Race error'
                      : 'Choose a champion'}
            </div>
            {frame ? <div className="stat-pill">You {frame.human_score}</div> : null}
            {frame ? <div className="stat-pill">AI {frame.ai_score}</div> : null}
            <div className="stat-pill">You = blue</div>
            <div className="stat-pill">AI = orange</div>
            {frame ? (
              <div className="stat-pill">
                Lead:{' '}
                {frame.human_score > frame.ai_score
                  ? 'You'
                  : frame.ai_score > frame.human_score
                    ? 'AI'
                    : 'Tie'}
              </div>
            ) : null}
            {frame ? (
              <div className="stat-pill">
                {frame.winner
                  ? frame.winner === 'human'
                    ? 'Result: You won'
                    : frame.winner === 'ai'
                      ? 'Result: AI wins'
                      : 'Result: Tie'
                  : 'Race in progress'}
              </div>
            ) : null}
          </div>

          {frame ? (
            <>
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

              <div className="submit-form">
                <button className="action-button" onClick={jump}>
                  Jump
                </button>
                <button className="ghost-button" onClick={restart}>
                  Restart Race
                </button>
                <button className="ghost-button" onClick={() => setSelectedRunName(null)}>
                  Change Champion
                </button>
              </div>
            </>
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
