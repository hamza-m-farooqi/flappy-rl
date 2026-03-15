import { GameCanvas } from '../components/GameCanvas';
import { NetworkVisualizer } from '../components/NetworkVisualizer';
import { MetricsDashboard } from '../components/MetricsDashboard';
import { useTrainingSocket } from '../hooks/useTrainingSocket';

export function TrainingPage() {
  const { frame, status, errorMessage, trainingStatus, statsHistory } = useTrainingSocket();
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
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">Training</p>
          <h1>Live Evolution Monitor</h1>
          <p className="lede">
            Watch the live training swarm over WebSocket as generations rise and the birds
            learn to survive longer.
          </p>
        </div>
        <div className="heading-side">
          <span className={`status-chip ${status === 'connected' && trainingStatus?.is_running ? 'live' : 'idle'}`}>
            {trainingStatus?.is_running ? `Run ${trainingStatus.active_run_name ?? 'active'}` : 'Trainer idle'}
          </span>
        </div>
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
          {frame.champion_saved_this_generation ? (
            <p className="status-banner success">
              Champion checkpoint updated. Snapshot saved to{' '}
              <code>{frame.last_checkpoint_path ?? frame.champion_path}</code>
            </p>
          ) : null}
          {generationEndMessage ? <p className="status-banner">{generationEndMessage}</p> : null}
          <div className="content-grid">
            <div className="canvas-panel" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <GameCanvas gameState={frame} />
              <div className="table-card" style={{ padding: '16px', margin: 0, marginTop: '4px' }}>
                <div className="table-header-copy">
                  <h2 style={{ fontSize: '14px', marginBottom: '12px' }}>Generation Metrics</h2>
                </div>
                <MetricsDashboard statsHistory={statsHistory} />
              </div>
            </div>
            <div className="stats-panel" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {frame.best_network ? (
                <div className="table-card" style={{ padding: '16px', margin: 0 }}>
                  <div className="table-header-copy">
                    <h2 style={{ fontSize: '14px', marginBottom: '12px' }}>Best Brain Topology</h2>
                  </div>
                  <NetworkVisualizer network={frame.best_network} width={300} height={180} />
                </div>
              ) : null}
              <div className="training-stats training-stats-compact">
                <div className="stat-pill stat-pill-compact">
                  <span className="stat-label">Run</span>
                  <span className="stat-value">{frame.run_name}</span>
                </div>
                <div className="stat-pill stat-pill-compact">
                  <span className="stat-label">Generation</span>
                  <span className="stat-value">{frame.generation}</span>
                </div>
                <div className="stat-pill stat-pill-compact">
                  <span className="stat-label">Alive</span>
                  <span className="stat-value">{frame.alive_count}/{frame.total_birds}</span>
                </div>
                <div className="stat-pill stat-pill-compact">
                  <span className="stat-label">Generation best</span>
                  <span className="stat-value">{frame.generation_best_pipes}</span>
                </div>
                <div className="stat-pill stat-pill-compact">
                  <span className="stat-label">All-time best</span>
                  <span className="stat-value">{frame.best_pipes}</span>
                </div>
                <div className="stat-pill stat-pill-compact">
                  <span className="stat-label">Generation fitness</span>
                  <span className="stat-value">{Math.round(frame.generation_best_fitness)}</span>
                </div>
                <div className="stat-pill stat-pill-compact">
                  <span className="stat-label">Champion fitness</span>
                  <span className="stat-value">{Math.round(frame.best_fitness)}</span>
                </div>
                <div className="stat-pill stat-pill-compact">
                  <span className="stat-label">Frame</span>
                  <span className="stat-value">{frame.frame}</span>
                </div>
                <div className="stat-pill stat-pill-compact">
                  <span className="stat-label">Checkpoint</span>
                  <span className="stat-value">
                    {frame.champion_available ? 'Ready' : 'Not yet'}
                  </span>
                </div>
                {frame.last_saved_generation ? (
                  <div className="stat-pill stat-pill-compact">
                    <span className="stat-label">Saved generation</span>
                    <span className="stat-value">{frame.last_saved_generation}</span>
                  </div>
                ) : null}
                <div className="stat-pill stat-pill-compact">
                  <span className="stat-label">Trend</span>
                  <span className="stat-value">
                    {frame.generation_best_pipes > frame.best_pipes
                      ? 'Improving'
                      : frame.generation_best_pipes === frame.best_pipes
                        ? 'Matching best'
                        : 'Below champion'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
