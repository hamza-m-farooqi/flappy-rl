import { GameCanvas } from '../components/GameCanvas';
import { useTrainingSocket } from '../hooks/useTrainingSocket';

export function TrainingPage() {
  const { frame, status, errorMessage, trainingStatus } = useTrainingSocket();
  const generationEndMessage =
    frame?.generation_complete && frame.generation_end_reason
      ? frame.generation_end_reason === 'frame_cap'
        ? `Generation ${frame.generation} ended because it reached the frame cap. Training continues with the next generation.`
        : frame.generation_end_reason === 'all_birds_dead'
          ? `Generation ${frame.generation} ended because all birds died.`
          : `Generation ${frame.generation} ended because training was stopped.`
      : null;

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
            : trainingStatus?.is_running
              ? `Waiting for live frames from ${trainingStatus.active_run_name ?? 'the active run'}...`
              : 'No training is currently running. Start or resume a run from the Admin page.'}
        </p>
      ) : null}

      {frame ? (
        <>
          <div className="training-stats">
            <div className="stat-pill">Run {frame.run_name}</div>
            <div className="stat-pill">Generation {frame.generation}</div>
            <div className="stat-pill">
              Alive {frame.alive_count}/{frame.total_birds}
            </div>
            <div className="stat-pill">
              Generation best score {frame.generation_best_pipes}
            </div>
            <div className="stat-pill">All-time best score {frame.best_pipes}</div>
            <div className="stat-pill">
              Generation fitness {Math.round(frame.generation_best_fitness)}
            </div>
            <div className="stat-pill">Champion fitness {Math.round(frame.best_fitness)}</div>
            <div className="stat-pill">Frame {frame.frame}</div>
            <div className="stat-pill">
              {frame.champion_available ? 'Champion checkpoint ready' : 'No checkpoint yet'}
            </div>
            {frame.last_saved_generation ? (
              <div className="stat-pill">
                Best saved at generation {frame.last_saved_generation}
              </div>
            ) : null}
            <div className="stat-pill">
              {frame.generation_best_pipes > frame.best_pipes
                ? 'Improving now'
                : frame.generation_best_pipes === frame.best_pipes
                  ? 'Matching best'
                  : 'Below champion'}
            </div>
          </div>
          {frame.champion_saved_this_generation ? (
            <p className="status-banner success">
              Champion checkpoint updated. Snapshot saved to{' '}
              <code>{frame.last_checkpoint_path ?? frame.champion_path}</code>
            </p>
          ) : null}
          {generationEndMessage ? <p className="status-banner">{generationEndMessage}</p> : null}
          <GameCanvas gameState={frame} />
        </>
      ) : null}
    </section>
  );
}
