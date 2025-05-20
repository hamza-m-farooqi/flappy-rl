import { useEffect } from 'react';
import { GameCanvas } from '../components/GameCanvas';
import { useCompeteSocket } from '../hooks/useCompeteSocket';

export function CompetePage() {
  const { frame, status, errorMessage, jump, restart } = useCompeteSocket();

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
      if (isEditableTarget(event.target)) {
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
  }, [jump, restart]);

  return (
    <section className="page page-training">
      <div className="training-copy">
        <p className="eyebrow">Compete</p>
        <h1>Human vs Champion</h1>
        <p className="lede">
          Race the saved AI champion in a shared pipe sequence. Press <code>Space</code> in
          the browser to jump with the local player, or use the controls below.
        </p>
      </div>

      {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}
      {!frame && !errorMessage ? (
        <p className="status-banner">
          {status === 'connecting'
            ? 'Connecting to compete stream...'
            : 'Waiting for compete session...'}
        </p>
      ) : null}

      {frame ? (
        <>
          <div className="training-stats">
            <div className="stat-pill">You {frame.human_score}</div>
            <div className="stat-pill">AI {frame.ai_score}</div>
            <div className="stat-pill">You = blue</div>
            <div className="stat-pill">AI = orange</div>
            <div className="stat-pill">
              Lead:{' '}
              {frame.human_score > frame.ai_score
                ? 'You'
                : frame.ai_score > frame.human_score
                  ? 'AI'
                  : 'Tie'}
            </div>
            <div className="stat-pill">
              {frame.winner
                ? frame.winner === 'human'
                  ? 'Result: You won'
                  : frame.winner === 'ai'
                    ? 'Result: AI wins'
                    : 'Result: Tie'
                : 'Race in progress'}
            </div>
          </div>

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
          </div>
        </>
      ) : null}
    </section>
  );
}
