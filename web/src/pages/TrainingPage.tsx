import { Suspense, lazy, startTransition, useEffect, useRef, useState } from 'react';
import { GameCanvas, type NetworkGraphData, type TrainingHistoryPoint } from '../components/GameCanvas';
import { useTrainingSocket } from '../hooks/useTrainingSocket';

const MetricsChart = lazy(async () => {
  const module = await import('../components/MetricsChart');
  return { default: module.MetricsChart };
});

const NetworkGraph = lazy(async () => {
  const module = await import('../components/NetworkGraph');
  return { default: module.NetworkGraph };
});

export function TrainingPage() {
  const { liveFrame, uiFrame, status, errorMessage, trainingStatus } = useTrainingSocket();
  const [insightHistory, setInsightHistory] = useState<TrainingHistoryPoint[]>([]);
  const [insightNetwork, setInsightNetwork] = useState<NetworkGraphData | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const lastHistoryLengthRef = useRef(0);
  const lastNetworkFrameRef = useRef(-1);
  const frame = uiFrame ?? liveFrame;

  useEffect(() => {
    if (!uiFrame) {
      return;
    }

    const history = uiFrame.history;

    if (
      history &&
      (
        history.length !== lastHistoryLengthRef.current ||
        uiFrame.generation_complete
      )
    ) {
      lastHistoryLengthRef.current = history.length;
      startTransition(() => {
        setInsightHistory(history);
      });
    }

    if (
      uiFrame.focus_network &&
      (
        uiFrame.generation_complete ||
        uiFrame.champion_saved_this_generation ||
        uiFrame.frame - lastNetworkFrameRef.current >= 10
      )
    ) {
      lastNetworkFrameRef.current = uiFrame.frame;
      startTransition(() => {
        setInsightNetwork(uiFrame.focus_network ?? null);
      });
    }
  }, [uiFrame]);

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
      {!liveFrame && !errorMessage ? (
        <p className="status-banner">
          {status === 'connecting'
            ? 'Connecting to live training stream...'
            : trainingStatus?.is_running
              ? `Waiting for live frames from ${trainingStatus.active_run_name ?? 'the active run'}...`
              : 'No training is currently running. Start or resume a run from the Admin page.'}
        </p>
      ) : null}

      {liveFrame && frame ? (
        <>
          {frame.champion_saved_this_generation ? (
            <p className="status-banner success">
              Champion checkpoint updated. Snapshot saved to{' '}
              <code>{frame.last_checkpoint_path ?? frame.champion_path}</code>
            </p>
          ) : null}
          {generationEndMessage ? <p className="status-banner">{generationEndMessage}</p> : null}
          <div className="content-grid">
            <div className="canvas-panel">
              <GameCanvas gameState={liveFrame} />
            </div>
            <div className="stats-panel">
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
                  <span className="stat-label">Average fitness</span>
                  <span className="stat-value">{Math.round(frame.generation_average_fitness)}</span>
                </div>
                <div className="stat-pill stat-pill-compact">
                  <span className="stat-label">Champion fitness</span>
                  <span className="stat-value">{Math.round(frame.best_fitness)}</span>
                </div>
                <div className="stat-pill stat-pill-compact">
                  <span className="stat-label">Species</span>
                  <span className="stat-value">{frame.species_count}</span>
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

          <div className="insight-grid">
            <div className="table-card accordion-card">
              <button
                type="button"
                className="accordion-summary accordion-button"
                onClick={() => setShowMetrics((current) => !current)}
              >
                <div>
                  <h2>Training Metrics</h2>
                  <p>Completed generations plotted from the backend training stream.</p>
                </div>
                <span className="inline-note">{showMetrics ? 'Hide' : 'Show'}</span>
              </button>
              {showMetrics ? (
                <div className="accordion-content">
                  <Suspense fallback={<div className="chart-empty"><p>Loading metrics...</p></div>}>
                    <MetricsChart history={insightHistory} />
                  </Suspense>
                </div>
              ) : null}
            </div>

            <div className="table-card accordion-card">
              <button
                type="button"
                className="accordion-summary accordion-button"
                onClick={() => setShowNetwork((current) => !current)}
              >
                <div>
                  <h2>Current Best Network</h2>
                  <p>Inspect the active champion topology and live signal flow.</p>
                </div>
                <span className="inline-note">{showNetwork ? 'Hide' : 'Show'}</span>
              </button>
              {showNetwork ? (
                <div className="accordion-content">
                  <Suspense fallback={<div className="network-empty"><p>Loading network...</p></div>}>
                    <NetworkGraph
                      network={insightNetwork}
                      title="Current Best Network"
                    />
                  </Suspense>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
