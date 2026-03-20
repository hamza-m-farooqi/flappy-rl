import { Link } from 'react-router-dom';
import { Activity, Cpu, Gamepad2, Shield, Trophy, Zap } from 'lucide-react';

export function HomePage() {
  return (
    <section className="page page-home">
      <div className="heading-copy home-shell">
        <p className="eyebrow">Multi-Environment RL Sandbox</p>
        <h1>Train neural networks. Watch them evolve. Race the champion.</h1>
        <p className="lede">
          NeuroArena applies <strong>NEAT neuroevolution</strong> to game-playing agents across
          multiple environments. Every generation streams live to your browser over WebSocket —
          watch the swarm learn, pipe by pipe, generation by generation.
        </p>
        <div className="home-badge-cloud">
          <span className="home-badge">NEAT neuroevolution</span>
          <span className="home-badge">Live WebSocket streams</span>
          <span className="home-badge">Multi-environment</span>
          <span className="home-badge">Browser play + AI compete</span>
        </div>
      </div>

      <div className="hero-grid">
        <div className="hero-card">
          <div className="split-header">
            <div>
              <h2>What you can do right now</h2>
              <p>
                Flappy Bird is the first environment. Pick a mode, play yourself, or fire up the
                trainer and watch NEAT evolve agents from scratch.
              </p>
            </div>
            <span className="status-chip live">Flappy Bird · Live</span>
          </div>

          <ul className="hero-highlights">
            <li>
              <strong>Play locally</strong>
              Browser physics with instant response. Choose Easy, Hard, or Ultra mode.
            </li>
            <li>
              <strong>Watch NEAT train</strong>
              Start a named run from Admin, then watch the swarm evolve on the Training page.
            </li>
            <li>
              <strong>Race a champion</strong>
              Pick any saved training run and face its best-ever genome head to head.
            </li>
          </ul>

          <div className="hero-actions">
            <Link to="/play" className="action-button">
              Play Now
            </Link>
            <Link to="/training" className="ghost-button">
              Watch Training
            </Link>
          </div>
        </div>

        <div className="hero-preview">
          <article className="feature-card mini">
            <span className="feature-icon">
              <Gamepad2 size={20} />
            </span>
            <h2>Flappy Bird</h2>
            <p>Single-agent, discrete action space. Easy / Hard / Ultra modes with dynamic difficulty and pickups.</p>
          </article>
          <article className="feature-card mini">
            <span className="feature-icon">
              <Cpu size={20} />
            </span>
            <h2>More coming</h2>
            <p>T-Rex Run, 4-Way Traffic, Chess. Adding a new game takes one Python class and one React component.</p>
          </article>
        </div>
      </div>

      <div className="feature-list">
        <article className="feature-card">
          <span className="feature-icon">
            <Activity size={20} />
          </span>
          <h2>Live evolution monitor</h2>
          <p>
            WebSocket streams push every simulation frame to the browser. Generation stats,
            fitness charts, species counts, and the current champion network topology — all live.
          </p>
        </article>

        <article className="feature-card">
          <span className="feature-icon">
            <Zap size={20} />
          </span>
          <h2>Multi-run training</h2>
          <p>
            Multiple named training runs can evolve concurrently. Each run gets its own
            checkpoint folder, champion genome, and WebSocket channel. Switch between them
            on the Training page.
          </p>
        </article>

        <article className="feature-card">
          <span className="feature-icon">
            <Trophy size={20} />
          </span>
          <h2>Champion races &amp; leaderboard</h2>
          <p>
            Race any saved AI champion head-to-head through a shared pipe sequence. Submit
            your human score to the MongoDB-backed leaderboard and see where you rank.
          </p>
        </article>

        <article className="feature-card">
          <span className="feature-icon">
            <Shield size={20} />
          </span>
          <h2>Admin control panel</h2>
          <p>
            JWT-protected admin panel. Start new runs with custom NEAT hyperparameter overrides,
            resume from checkpoints, or stop any active run — all from the browser.
          </p>
        </article>
      </div>
    </section>
  );
}
