import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/env';

type RunSummary = {
  run_name: string;
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

type TrainingStatus = {
  is_running: boolean;
  active_run_name: string | null;
  runs: RunSummary[];
  override_parameters: OverrideParameter[];
  game_modes: Array<{
    key: string;
    label: string;
    description: string;
  }>;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
};

const ADMIN_TOKEN_KEY = 'flappy_rl_admin_token';

export function AdminPage() {
  const [password, setPassword] = useState('');
  const [trainingName, setTrainingName] = useState('');
  const [trainingMode, setTrainingMode] = useState('easy');
  const [neatOverrides, setNeatOverrides] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [requestState, setRequestState] = useState<'idle' | 'loading'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ADMIN_TOKEN_KEY));

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token],
  );

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

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadStatus(token);
    const intervalId = window.setInterval(() => {
      void loadStatus(token);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadStatus, token]);

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
    payload?: { run_name: string; mode?: string; neat_overrides?: Record<string, number> },
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
        setTrainingMode('easy');
        setNeatOverrides({});
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Admin action failed.');
    } finally {
      setRequestState('idle');
    }
  };

  if (!token) {
    return (
      <section className="page page-training">
        <div className="page-heading">
          <div className="heading-copy">
            <p className="eyebrow">Admin</p>
            <h1>Admin Login</h1>
            <p className="lede">
              Enter the server-side admin password to manage named training runs.
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
          <p className="eyebrow">Admin</p>
          <h1>Training Control</h1>
          <p className="lede">
            Protected browser controls for starting, resuming, and stopping one named
            training run at a time.
          </p>
        </div>
        <div className="heading-side">
          <div className="admin-heading-actions">
            <span className={`status-chip ${status?.is_running ? 'live' : 'idle'}`}>
              {status?.is_running ? `Active: ${status.active_run_name}` : 'Trainer idle'}
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
          <p>Each run gets its own folder under `checkpoints/`.</p>
        </div>
        <div className="submit-form">
          <input
            className="text-input"
            value={trainingName}
            onChange={(event) => setTrainingName(event.target.value)}
            placeholder="spring-champion-run"
            maxLength={64}
          />
          <select
            className="text-input mode-select"
            value={trainingMode}
            onChange={(event) => setTrainingMode(event.target.value)}
          >
            {(status?.game_modes ?? []).map((mode) => (
              <option key={mode.key} value={mode.key}>
                {mode.label}
              </option>
            ))}
          </select>
          <button
            className="action-button"
            disabled={requestState === 'loading' || !trainingName.trim() || Boolean(status?.is_running)}
            onClick={() =>
              void runAction('/admin/training/start', {
                run_name: trainingName,
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
          <button
            className="ghost-button"
            disabled={requestState === 'loading' || !status?.is_running}
            onClick={() => void runAction('/admin/training/stop')}
          >
            Stop Active Run
          </button>
        </div>
      </div>

      <details className="table-card accordion-card">
        <summary className="accordion-summary">
          <div>
            <h2>NEAT run tuning</h2>
            <p>Override selected evolution parameters for a new run without editing files.</p>
          </div>
          <span className="inline-note">Applied only when starting a fresh run</span>
        </summary>
        <div className="override-grid accordion-content">
          {(status?.override_parameters ?? []).map((parameter) => (
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
            <p>Resume behavior, checkpoints, and trainer state stay wired to the existing admin endpoints.</p>
          </div>
        </div>
        <div className="leaderboard-shell">
          <div className="leaderboard-head leaderboard-row">
            <span>Run</span>
            <span>Champion</span>
            <span>Best Score</span>
            <span>Actions</span>
          </div>
          {(status?.runs ?? []).map((run) => {
            const isActiveRun = status?.is_running && status.active_run_name === run.run_name;

            return (
              <div key={run.run_name} className="leaderboard-row">
                <span className="row-emphasis">{run.run_name}</span>
                <span>
                  {run.has_champion
                    ? `${run.mode} · Gen ${run.last_saved_generation ?? '-'}`
                    : run.mode}
                </span>
                <span>{run.best_score ?? '-'}</span>
                <span className="row-actions">
                  {isActiveRun ? (
                    <span className="status-chip live">Running</span>
                  ) : (
                    <button
                      className="ghost-button small"
                      disabled={
                        requestState === 'loading' ||
                        Boolean(status?.is_running) ||
                        !run.has_training_checkpoint
                      }
                      onClick={() => void runAction('/admin/training/resume', { run_name: run.run_name })}
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
              <p>Stored overrides make each experiment easier to compare later.</p>
            </div>
          </div>
          <div className="run-config-list">
            {status.runs.map((run) => (
              <article key={`${run.run_name}-config`} className="run-config-card">
                <h3>{run.run_name} · {run.mode}</h3>
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
