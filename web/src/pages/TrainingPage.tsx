import { Suspense, lazy, startTransition, useEffect, useRef, useState } from 'react';
import { GameCanvas, type NetworkGraphData, type TrainingFrame, type TrainingHistoryPoint } from '../components/GameCanvas';
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
  const [selectedRunName, setSelectedRunName] = useState<string | null>(null);
  // Filtered frames — only updated when frame.run_name matches selectedRunName.
  // Keeping these in state (not computed inline) prevents flickering when frames
  // from other concurrent runs arrive and would otherwise momentarily null-out the display.
  const [filteredLiveFrame, setFilteredLiveFrame] = useState<TrainingFrame | null>(null);
  const [filteredUiFrame, setFilteredUiFrame] = useState<TrainingFrame | null>(null);
  const lastHistoryLengthRef = useRef(0);
  const lastNetworkFrameRef = useRef(-1);

  const activeRunNames: string[] = trainingStatus?.active_run_names ?? [];

  // Auto-select the first active run if nothing is selected (or if selected run stopped)
  useEffect(() => {
    if (activeRunNames.length === 0) {
      setSelectedRunName(null);
      return;
    }
    // If current selection is gone, fall back to the first available run
    if (selectedRunName === null || !activeRunNames.includes(selectedRunName)) {
      setSelectedRunName(activeRunNames[0] ?? null);
    }
  }, [activeRunNames, selectedRunName]);

  // Accept incoming live frames only if they belong to the selected run.
  // Frames from other runs are silently dropped so the display doesn't flicker.
  useEffect(() => {
    if (!liveFrame) return;
    if (selectedRunName === null || liveFrame.run_name === selectedRunName) {
      setFilteredLiveFrame(liveFrame);
    }
  }, [liveFrame, selectedRunName]);

  useEffect(() => {
    if (!uiFrame) return;
    if (selectedRunName === null || uiFrame.run_name === selectedRunName) {
      setFilteredUiFrame(uiFrame);
    }
  }, [uiFrame, selectedRunName]);

  const frame = filteredUiFrame ?? filteredLiveFrame;

  useEffect(() => {
    if (!filteredUiFrame) {
      return;
    }

    const history = filteredUiFrame.history;

    if (
      history &&
      (
        history.length !== lastHistoryLengthRef.current ||
        filteredUiFrame.generation_complete
      )
    ) {
      lastHistoryLengthRef.current = history.length;
      startTransition(() => {
        setInsightHistory(history);
      });
    }

    if (
      filteredUiFrame.focus_network &&
      (
        filteredUiFrame.generation_complete ||
        filteredUiFrame.champion_saved_this_generation ||
        filteredUiFrame.frame - lastNetworkFrameRef.current >= 10
      )
    ) {
      lastNetworkFrameRef.current = filteredUiFrame.frame;
      startTransition(() => {
        setInsightNetwork(filteredUiFrame.focus_network ?? null);
      });
    }
  }, [filteredUiFrame]);

  // Reset everything when switching runs so stale frames don't linger
  useEffect(() => {
    setInsightHistory([]);
    setInsightNetwork(null);
    setFilteredLiveFrame(null);
    setFilteredUiFrame(null);
    lastHistoryLengthRef.current = 0;
    lastNetworkFrameRef.current = -1;
  }, [selectedRunName]);

  const generationEndMessage =
    frame?.generation_complete && frame.generation_end_reason
      ? frame.generation_end_reason === 'frame_cap'
        ? `Generation ${frame.generation} ended because it reached the frame cap. Training continues with the next generation.`
        : frame.generation_end_reason === 'all_birds_dead'
          ? `Generation ${frame.generation} ended because all birds died.`
          : `Generation ${frame.generation} ended because training was stopped.`
      : null;

  const isLive = status === 'connected' && (trainingStatus?.is_running ?? false);

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
          <span className={`status-chip ${isLive ? 'live' : 'idle'}`}>
            {isLive
              ? `${activeRunNames.length} run${activeRunNames.length > 1 ? 's' : ''} active`
              : 'Trainer idle'}
          </span>
        </div>
      </div>

      {/* Run selector — only shown when 2+ runs are active */}
      {activeRunNames.length > 1 ? (
        <div className="run-selector">
          <span className="run-selector-label">Monitoring:</span>
          <div className="run-selector-tabs">
            {activeRunNames.map((name) => (
              <button
                key={name}
                type="button"
                className={`run-tab ${selectedRunName === name ? 'run-tab-active' : ''}`}
                onClick={() => setSelectedRunName(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}
      {!filteredLiveFrame && !errorMessage ? (
        <p className="status-banner">
          {status === 'connecting'
            ? 'Connecting to live training stream...'
            : activeRunNames.length > 0
              ? `Waiting for live frames from ${selectedRunName ?? activeRunNames[0] ?? 'the active run'}...`
              : 'No training is currently running. Start or resume a run from the Admin page.'}
        </p>
      ) : null}

      {filteredLiveFrame && frame ? (
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
              <GameCanvas gameState={filteredLiveFrame} />
            </div>
            <div className="stats-panel">
              <div className="training-stats training-stats-compact">
                <div className="stat-pill stat-pill-compact">
                  <span className="stat-label">Run</span>
                  <span className="stat-value">{frame.run_name}</span>
                </div>
                <div className="stat-pill stat-pill-compact">
                  <span className="stat-label">Mode</span>
                  <span className="stat-value">{frame.mode ?? 'easy'}</span>
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
