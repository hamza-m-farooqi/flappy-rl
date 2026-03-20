import { Suspense, lazy, startTransition, useEffect, useMemo, useRef, useState } from 'react';
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
  // selectedRunName drives the WS connection — the hook reconnects automatically
  // when this changes so only the chosen run's frames arrive.
  const [selectedRunName, setSelectedRunName] = useState<string | null>(null);
  const { liveFrame, uiFrame, status, errorMessage, trainingStatus } =
    useTrainingSocket(selectedRunName);

  const [insightHistory, setInsightHistory] = useState<TrainingHistoryPoint[]>([]);
  const [insightNetwork, setInsightNetwork] = useState<NetworkGraphData | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const lastHistoryLengthRef = useRef(0);
  const lastNetworkFrameRef = useRef(-1);

  const activeRunNames: string[] = trainingStatus?.active_run_names ?? [];
  const frame = uiFrame ?? liveFrame;

  // Build a map of run_name → env_id from the training status
  const runEnvMap: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    for (const run of trainingStatus?.runs ?? []) {
      if (run.env_id) map[run.run_name] = run.env_id;
    }
    return map;
  }, [trainingStatus]);

  // Env filter — unique envs across active runs
  const activeEnvIds = useMemo(() => {
    const envSet = new Set<string>();
    for (const name of activeRunNames) {
      envSet.add(runEnvMap[name] ?? 'flappy_bird');
    }
    return [...envSet].sort();
  }, [activeRunNames, runEnvMap]);

  const [envFilter, setEnvFilter] = useState<string | null>(null);

  // Auto-select env filter when envs appear
  useEffect(() => {
    if (activeEnvIds.length === 0) {
      setEnvFilter(null);
    } else if (envFilter === null || !activeEnvIds.includes(envFilter)) {
      setEnvFilter(activeEnvIds[0] ?? null);
    }
  }, [activeEnvIds, envFilter]);

  // Filtered run names (by env)
  const filteredRunNames = useMemo(() => {
    if (!envFilter) return activeRunNames;
    return activeRunNames.filter(
      (name) => (runEnvMap[name] ?? 'flappy_bird') === envFilter,
    );
  }, [activeRunNames, envFilter, runEnvMap]);

  // Auto-select the first run in the filtered set; fall back when selected run leaves.
  useEffect(() => {
    if (filteredRunNames.length === 0) {
      setSelectedRunName(null);
      return;
    }
    if (selectedRunName === null || !filteredRunNames.includes(selectedRunName)) {
      setSelectedRunName(filteredRunNames[0] ?? null);
    }
  }, [filteredRunNames, selectedRunName]);

  // Reset charts when switching runs.
  useEffect(() => {
    setInsightHistory([]);
    setInsightNetwork(null);
    lastHistoryLengthRef.current = 0;
    lastNetworkFrameRef.current = -1;
  }, [selectedRunName]);

  useEffect(() => {
    if (!uiFrame) return;

    const history = uiFrame.history;
    if (history && (history.length !== lastHistoryLengthRef.current || uiFrame.generation_complete)) {
      lastHistoryLengthRef.current = history.length;
      startTransition(() => { setInsightHistory(history); });
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
      startTransition(() => { setInsightNetwork(uiFrame.focus_network ?? null); });
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

  const isLive = status === 'connected' && (trainingStatus?.is_running ?? false);

  return (
    <section className="page page-training">
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">NeuroArena · Training</p>
          <h1>Live Evolution Monitor</h1>
          <p className="lede">
            NEAT evolves a population of neural networks across generations. Every simulation
            frame streams to this page over WebSocket — watch the swarm shrink as birds die,
            fitness climb as survivors improve, and the champion network topology grow in
            complexity.
          </p>
        </div>
        <div className="heading-side">
          <span className={`status-chip ${isLive ? 'live' : 'idle'}`}>
            {isLive
              ? `${activeRunNames.length} run${activeRunNames.length > 1 ? 's' : ''} active`
              : 'No active run'}
          </span>
        </div>
      </div>

      {/* Env filter tabs — shown when active runs span more than one environment */}
      {activeEnvIds.length > 1 ? (
        <div className="run-selector">
          <span className="run-selector-label">Game:</span>
          <div className="run-selector-tabs">
            {activeEnvIds.map((envId) => (
              <button
                key={envId}
                type="button"
                className={`run-tab ${envFilter === envId ? 'run-tab-active' : ''}`}
                onClick={() => setEnvFilter(envId)}
              >
                {envId.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Run selector — only shown when 2+ runs are active within the selected env */}
      {filteredRunNames.length > 1 ? (
        <div className="run-selector">
          <span className="run-selector-label">Run:</span>
          <div className="run-selector-tabs">
            {filteredRunNames.map((name) => (
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
      {!liveFrame && !errorMessage ? (
        <p className="status-banner">
          {status === 'connecting'
            ? 'Connecting to live training stream...'
            : filteredRunNames.length > 0
              ? `Waiting for live frames from ${selectedRunName ?? filteredRunNames[0] ?? 'the active run'}...`
              : 'No training is currently running. Start or resume a run from the Admin page, then return here to watch it evolve.'}
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
                  <span className="stat-label">Environment</span>
                  <span className="stat-value">{frame.env_id ?? 'flappy_bird'}</span>
                </div>
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
                onClick={() => setShowMetrics((c) => !c)}
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
                onClick={() => setShowNetwork((c) => !c)}
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
                    <NetworkGraph network={insightNetwork} title="Current Best Network" />
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
