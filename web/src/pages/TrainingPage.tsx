import { GameCanvas } from '../components/GameCanvas';
import { useTrainingSocket } from '../hooks/useTrainingSocket';

export function TrainingPage() {
  const { frame, status, errorMessage } = useTrainingSocket();

  return (
    <section className="page page-training">
      <div className="training-copy">
        <p className="eyebrow">Training</p>
        <h1>Live Evolution Monitor</h1>
        <p className="lede">
          Watch the live training swarm over WebSocket as generations rise and the birds
          learn to survive longer.
        </p>
      </div>

      {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}
      {!frame && !errorMessage ? (
        <p className="status-banner">
          {status === 'connecting'
            ? 'Connecting to live training stream...'
            : 'Waiting for training frames...'}
        </p>
      ) : null}

      {frame ? (
        <>
          <div className="training-stats">
            <div className="stat-pill">Generation {frame.generation}</div>
            <div className="stat-pill">
              Alive {frame.alive_count}/{frame.total_birds}
            </div>
            <div className="stat-pill">Best fitness {Math.round(frame.best_fitness)}</div>
            <div className="stat-pill">Frame {frame.frame}</div>
          </div>
          <GameCanvas gameState={frame} />
        </>
      ) : null}
    </section>
  );
}
