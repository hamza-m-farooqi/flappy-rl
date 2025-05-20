import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/play', label: 'Play' },
  { to: '/compete', label: 'Compete' },
  { to: '/training', label: 'Training' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/admin', label: 'Admin' },
];

export function Navbar() {
  return (
    <header className="topbar">
      <NavLink to="/" className="brand">
        <span className="brand-mark" aria-hidden="true">
          FR
        </span>
        <span className="brand-copy">
          <strong>flappy-rl</strong>
          <span>Browser-first neuroevolution platform</span>
        </span>
      </NavLink>

      <nav className="nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
