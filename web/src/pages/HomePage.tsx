import { Link } from 'react-router-dom';
import { Activity, Gamepad2, Shield, Trophy } from 'lucide-react';

export function HomePage() {
  return (
    <section className="page page-home">
      <div className="heading-copy home-shell">
        <p className="eyebrow">Browser Platform</p>
        <h1>Train, race, and monitor flappy agents in one UI.</h1>
        <p className="lede">
          The frontend already covers local play, live training telemetry, champion
          races, leaderboard review, and protected admin controls. The UI can now
          present that flow with more clarity and more product-level polish.
        </p>
        <div className="home-badge-cloud">
          <span className="home-badge">React + Vite shell</span>
          <span className="home-badge">Canvas game rendering</span>
          <span className="home-badge">Live WebSocket views</span>
        </div>
      </div>

      <div className="hero-grid">
        <div className="hero-card">
          <div className="split-header">
            <div>
              <h2>Operational flow</h2>
              <p>Keep the same functionality, but make the main paths clearer to enter.</p>
            </div>
            <span className="status-chip live">UI refresh active</span>
          </div>

          <ul className="hero-highlights">
            <li>
              <strong>Play locally</strong>
              Instant browser physics and score submission.
            </li>
            <li>
              <strong>Watch training</strong>
              Live generation metrics and canvas playback.
            </li>
            <li>
              <strong>Race champions</strong>
              Compare the player against saved AI runs.
            </li>
          </ul>

          <div className="hero-actions">
            <Link to="/play" className="action-button">
              Open Play Mode
            </Link>
            <Link to="/training" className="ghost-button">
              View Training
            </Link>
          </div>
        </div>

        <div className="hero-preview">
          <article className="feature-card mini">
            <span className="feature-icon">
              <Gamepad2 size={20} />
            </span>
            <h2>Play</h2>
            <p>Keyboard-first game flow with score persistence.</p>
          </article>
          <article className="feature-card mini">
            <span className="feature-icon">
              <Activity size={20} />
            </span>
            <h2>Training</h2>
            <p>Generation, fitness, alive count, and checkpoint visibility.</p>
          </article>
        </div>
      </div>

      <div className="feature-list">
        <article className="feature-card">
          <span className="feature-icon">
            <Trophy size={20} />
          </span>
          <h2>Leaderboard flow</h2>
          <p>Scores remain tied to the same backend endpoints while the presentation gets cleaner.</p>
        </article>

        <article className="feature-card">
          <span className="feature-icon">
            <Shield size={20} />
          </span>
          <h2>Admin controls</h2>
          <p>Protected training management stays intact with clearer action grouping and run status.</p>
        </article>

        <article className="feature-card">
          <span className="feature-icon">
            <Activity size={20} />
          </span>
          <h2>Shared shell</h2>
          <p>Consistent panels, metrics, buttons, and table styling now carry across every route.</p>
        </article>
      </div>
    </section>
  );
}
