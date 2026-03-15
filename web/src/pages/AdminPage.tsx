import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/env';

type RunSummary = {
  run_name: string;
  has_champion: boolean;
  has_training_checkpoint: boolean;
  best_score: number | null;
  best_fitness: number | null;
  last_saved_generation: number | null;
};

type TrainingStatus = {
  is_running: boolean;
  active_run_name: string | null;
  runs: RunSummary[];
};

type LoginResponse = {
  access_token: string;
  token_type: string;
};

const ADMIN_TOKEN_KEY = 'flappy_rl_admin_token';

export function AdminPage() {
  const [password, setPassword] = useState('');
  const [trainingName, setTrainingName] = useState('');
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

  const runAction = async (path: string, payload?: { run_name: string }) => {
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
          <span className={`status-chip ${status?.is_running ? 'live' : 'idle'}`}>
            {status?.is_running ? `Active: ${status.active_run_name}` : 'Trainer idle'}
          </span>
        </div>
      </div>

      {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}

      <div className="training-stats">
        <div className="stat-pill">
          <span className="stat-label">Trainer</span>
          <span className="stat-value">
            {status?.is_running ? `Running (${status.active_run_name})` : 'Idle'}
          </span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">Runs discovered</span>
          <span className="stat-value">{status?.runs.length ?? 0}</span>
        </div>
        <button className="ghost-button small" onClick={logout}>
          Logout
        </button>
      </div>

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
          <button
            className="action-button"
            disabled={requestState === 'loading' || !trainingName.trim() || Boolean(status?.is_running)}
            onClick={() => void runAction('/admin/training/start', { run_name: trainingName })}
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
                <span>{run.has_champion ? `Gen ${run.last_saved_generation ?? '-'}` : 'No champion'}</span>
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
    </section>
  );
}
