import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/env';

type RunSummary = {
  run_name: string;
  env_id: string;
  mode: string;
  has_champion: boolean;
  has_training_checkpoint: boolean;
  best_score: number | null;
  best_fitness: number | null;
  last_saved_generation: number | null;
  neat_overrides: Record<string, number>;
};

type OverrideParameter = {
  key: string;
  section: string;
  type: 'int' | 'float';
  min: number;
  max: number;
  label: string;
  description: string;
  default: number;
};

type GameMode = {
  key: string;
  label: string;
  description: string;
};

type EnvironmentInfo = {
  env_id: string;
  label: string;
  game_modes: GameMode[];
  override_parameters: OverrideParameter[];
};

type TrainingStatus = {
  is_running: boolean;
  active_run_names: string[];
  runs: RunSummary[];
  // Legacy global fields (still present for backward compat)
  override_parameters?: OverrideParameter[];
  game_modes?: GameMode[];
};

type LoginResponse = {
  access_token: string;
  token_type: string;
};

const ADMIN_TOKEN_KEY = 'neuro_arena_admin_token';

export function AdminPage() {
  const [password, setPassword] = useState('');
  const [trainingName, setTrainingName] = useState('');
  const [trainingMode, setTrainingMode] = useState('easy');
  const [selectedEnvId, setSelectedEnvId] = useState('flappy_bird');
  const [neatOverrides, setNeatOverrides] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [environments, setEnvironments] = useState<EnvironmentInfo[]>([]);
  const [requestState, setRequestState] = useState<'idle' | 'loading'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ADMIN_TOKEN_KEY));
  const [stoppingRuns, setStoppingRuns] = useState<Set<string>>(new Set());

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token],
  );

  // Derive env-specific game modes and NEAT override params from the loaded environments list
  const activeEnv = useMemo(
    () => environments.find((e) => e.env_id === selectedEnvId) ?? null,
    [environments, selectedEnvId],
  );
  const currentGameModes: GameMode[] = activeEnv?.game_modes ?? [];
  const currentOverrideParameters: OverrideParameter[] = activeEnv?.override_parameters ?? [];

  const loadStatus = useCallback(
    async (authToken = token) => {
      if (!authToken) {
        return;
      }

      try {
        const response = await axios.get<TrainingStatus>(`${API_BASE_URL}/admin/training/status`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        setStatus(response.data);
        setErrorMessage(null);
        setStoppingRuns((current) => {
          const active = new Set(response.data.active_run_names);
          const next = new Set([...current].filter((name) => active.has(name)));
          return next.size === current.size ? current : next;
        });
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          localStorage.removeItem(ADMIN_TOKEN_KEY);
          setToken(null);
          setStatus(null);
        }
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load admin status.');
      }
    },
    [token],
  );

  const loadEnvironments = useCallback(
    async (authToken = token) => {
      if (!authToken) return;
      try {
        const response = await axios.get<{ environments: EnvironmentInfo[] }>(
          `${API_BASE_URL}/admin/environments`,
          { headers: { Authorization: `Bearer ${authToken}` } },
        );
        setEnvironments(response.data.environments);
        // Auto-select first env and its first mode
        if (response.data.environments.length > 0) {
          const first = response.data.environments[0];
          setSelectedEnvId(first.env_id);
          if (first.game_modes.length > 0) {
            setTrainingMode(first.game_modes[0].key);
          }
        }
      } catch {
        // Environments endpoint may not be available yet — fall back silently
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadStatus(token);
    void loadEnvironments(token);
    const intervalId = window.setInterval(() => {
      void loadStatus(token);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadStatus, loadEnvironments, token]);

  // When user changes the env selector, reset mode to that env's first mode
  const handleEnvChange = (envId: string) => {
    setSelectedEnvId(envId);
    setNeatOverrides({});
    const env = environments.find((e) => e.env_id === envId);
    if (env && env.game_modes.length > 0) {
      setTrainingMode(env.game_modes[0].key);
    }
  };

  const login = async () => {
    try {
      setRequestState('loading');
      setErrorMessage(null);
      const response = await axios.post<LoginResponse>(`${API_BASE_URL}/admin/login`, {
        password,
      });
      localStorage.setItem(ADMIN_TOKEN_KEY, response.data.access_token);
      setToken(response.data.access_token);
      setPassword('');
      await loadStatus(response.data.access_token);
      await loadEnvironments(response.data.access_token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Admin login failed.');
    } finally {
      setRequestState('idle');
    }
  };

  const logout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
    setStatus(null);
    setErrorMessage(null);
  };

  const runAction = async (
    path: string,
    payload?: { run_name: string; env_id?: string; mode?: string; neat_overrides?: Record<string, number> },
  ) => {
    if (!headers) {
      return;
    }

    try {
      setRequestState('loading');
      setErrorMessage(null);
      await axios.post(`${API_BASE_URL}${path}`, payload, { headers });
      await loadStatus();
      if (path === '/admin/training/start') {
        setTrainingName('');
        setNeatOverrides({});
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Admin action failed.');
    } finally {
      setRequestState('idle');
    }
  };

  const stopRun = async (runName: string) => {
    if (!headers) return;
    setStoppingRuns((current) => new Set([...current, runName]));
    try {
      await axios.post(
        `${API_BASE_URL}/admin/training/stop`,
        { run_name: runName },
        { headers },
      );
      await loadStatus();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `Failed to stop run '${runName}'.`);
      setStoppingRuns((current) => {
        const next = new Set(current);
        next.delete(runName);
        return next;
      });
    }
  };

  const activeRunCount = status?.active_run_names.length ?? 0;

  if (!token) {
    return (
      <section className="page page-training">
        <div className="page-heading">
          <div className="heading-copy">
            <p className="eyebrow">NeuroArena · Admin</p>
            <h1>Admin Login</h1>
            <p className="lede">
              Enter the server-side admin password to unlock training controls. You can start
              new NEAT runs, resume from checkpoints, and stop any active run from this panel.
            </p>
          </div>
          <div className="heading-side">
            <span className="status-chip idle">Protected route</span>
          </div>
        </div>

        {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}

        <div className="submit-panel">
          <div className="submit-form">
            <input
              className="text-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Admin password"
            />
            <button
              className="action-button"
              disabled={requestState === 'loading' || !password}
              onClick={() => void login()}
            >
              {requestState === 'loading' ? 'Signing in...' : 'Login'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page page-training">
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">NeuroArena · Admin</p>
          <h1>Training Control</h1>
          <p className="lede">
            Start, resume, and stop named NEAT training runs. Each run evolves independently
            with its own champion, checkpoint folder, and WebSocket channel. Multiple runs
            can train concurrently.
          </p>
        </div>
        <div className="heading-side">
          <div className="admin-heading-actions">
            <span className={`status-chip ${activeRunCount > 0 ? 'live' : 'idle'}`}>
              {activeRunCount > 0
                ? `${activeRunCount} run${activeRunCount > 1 ? 's' : ''} active`
                : 'Trainer idle'}
            </span>
            <button className="badge-button" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </div>

      {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}

      <div className="submit-panel">
        <div className="submit-copy">
          <h2>Start a new training run</h2>
          <p>
            Choose a game, pick a difficulty, give the run a name. Each run gets its own
            checkpoint folder under <code>checkpoints/{selectedEnvId}/</code>.
          </p>
        </div>
        <div className="submit-form">
          {/* Game / environment selector */}
          {environments.length > 0 ? (
            <select
              className="text-input mode-select"
              value={selectedEnvId}
              onChange={(event) => handleEnvChange(event.target.value)}
            >
              {environments.map((env) => (
                <option key={env.env_id} value={env.env_id}>
                  {env.label}
                </option>
              ))}
            </select>
          ) : (
            <select className="text-input mode-select" value={selectedEnvId} disabled>
              <option value="flappy_bird">Flappy Bird</option>
            </select>
          )}
          {/* Difficulty mode selector — updates when env changes */}
          <select
            className="text-input mode-select"
            value={trainingMode}
            onChange={(event) => setTrainingMode(event.target.value)}
          >
            {currentGameModes.length > 0
              ? currentGameModes.map((mode) => (
                  <option key={mode.key} value={mode.key}>
                    {mode.label}
                  </option>
                ))
              : (status?.game_modes ?? []).map((mode) => (
                  <option key={mode.key} value={mode.key}>
                    {mode.label}
                  </option>
                ))}
          </select>
          <input
            className="text-input"
            value={trainingName}
            onChange={(event) => setTrainingName(event.target.value)}
            placeholder="spring-champion-run"
            maxLength={64}
          />
          <button
            className="action-button"
            disabled={requestState === 'loading' || !trainingName.trim()}
            onClick={() =>
              void runAction('/admin/training/start', {
                run_name: trainingName,
                env_id: selectedEnvId,
                mode: trainingMode,
                neat_overrides: Object.fromEntries(
                  Object.entries(neatOverrides)
                    .filter(([, value]) => value.trim() !== '')
                    .map(([key, value]) => [key, Number(value)]),
                ),
              })
            }
          >
            Start New Run
          </button>
        </div>
      </div>

      <details className="table-card accordion-card">
        <summary className="accordion-summary">
          <div>
            <h2>NEAT run tuning</h2>
            <p>
              Override evolution parameters for <strong>{activeEnv?.label ?? selectedEnvId}</strong>.
              Defaults are read from that environment's <code>neat.cfg</code>.
            </p>
          </div>
          <span className="inline-note">Applied only when starting a fresh run</span>
        </summary>
        <div className="override-grid accordion-content">
          {(currentOverrideParameters.length > 0
            ? currentOverrideParameters
            : status?.override_parameters ?? []
          ).map((parameter) => (
            <label key={parameter.key} className="override-card">
              <div className="override-copy">
                <span className="override-label">{parameter.label}</span>
                <span className="override-description">{parameter.description}</span>
              </div>
              <div className="override-control-row">
                <input
                  className="text-input override-input"
                  type="number"
                  min={parameter.min}
                  max={parameter.max}
                  step={parameter.type === 'int' ? 1 : 0.01}
                  value={neatOverrides[parameter.key] ?? ''}
                  onChange={(event) =>
                    setNeatOverrides((current) => ({
                      ...current,
                      [parameter.key]: event.target.value,
                    }))
                  }
                  placeholder={String(parameter.default)}
                />
                <button
                  type="button"
                  className="ghost-button small"
                  onClick={() =>
                    setNeatOverrides((current) => {
                      const next = { ...current };
                      delete next[parameter.key];
                      return next;
                    })
                  }
                >
                  Default
                </button>
              </div>
              <span className="inline-note">
                Range {parameter.min} to {parameter.max} · base {parameter.default} · {parameter.section}
              </span>
            </label>
          ))}
        </div>
      </details>

      <div className="table-card">
        <div className="table-header-copy">
          <div>
            <h2>Named runs</h2>
            <p>Stop a running run, or resume one from its last checkpoint.</p>
          </div>
        </div>
        <div className="leaderboard-shell">
          <div className="leaderboard-head leaderboard-row">
            <span>Run</span>
            <span>Game · Mode</span>
            <span>Best Score</span>
            <span>Actions</span>
          </div>
          {(status?.runs ?? []).map((run) => {
            const isActiveRun = status?.active_run_names.includes(run.run_name) ?? false;
            const isStopping = stoppingRuns.has(run.run_name);

            return (
              <div key={run.run_name} className="leaderboard-row">
                <span className="row-emphasis">{run.run_name}</span>
                <span>
                  {(run.env_id ?? 'flappy_bird').replace('_', ' ')} ·{' '}
                  {run.has_champion
                    ? `${run.mode} · Gen ${run.last_saved_generation ?? '-'}`
                    : run.mode}
                </span>
                <span>{run.best_score ?? '-'}</span>
                <span className="row-actions">
                  {isActiveRun ? (
                    <>
                      <span className="status-chip live">Running</span>
                      <button
                        className="ghost-button small"
                        disabled={isStopping}
                        onClick={() => void stopRun(run.run_name)}
                      >
                        {isStopping ? 'Stopping…' : 'Stop'}
                      </button>
                    </>
                  ) : (
                    <button
                      className="ghost-button small"
                      disabled={
                        requestState === 'loading' || !run.has_training_checkpoint
                      }
                      onClick={() =>
                        void runAction('/admin/training/resume', {
                          run_name: run.run_name,
                          env_id: run.env_id ?? 'flappy_bird',
                        })
                      }
                    >
                      Resume
                    </button>
                  )}
                </span>
              </div>
            );
          })}
          {status && status.runs.length === 0 ? (
            <p className="status-banner">No named training runs yet.</p>
          ) : null}
        </div>
      </div>

      {status && status.runs.length > 0 ? (
        <div className="table-card">
          <div className="table-header-copy">
            <div>
              <h2>Run configuration snapshots</h2>
              <p>NEAT overrides are stored per run so you can compare experiments and reproduce any result.</p>
            </div>
          </div>
          <div className="run-config-list">
            {status.runs.map((run) => (
              <article key={`${run.run_name}-config`} className="run-config-card">
                <h3>{run.run_name} · {(run.env_id ?? 'flappy_bird').replace('_', ' ')} · {run.mode}</h3>
                <p>
                  {Object.keys(run.neat_overrides).length > 0
                    ? Object.entries(run.neat_overrides)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(' · ')
                    : 'Using default NEAT parameters'}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
