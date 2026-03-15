import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { PlayPage } from './pages/PlayPage';

const TrainingPage = lazy(async () => {
  const module = await import('./pages/TrainingPage');
  return { default: module.TrainingPage };
});

const CompetePage = lazy(async () => {
  const module = await import('./pages/CompetePage');
  return { default: module.CompetePage };
});

const AdminPage = lazy(async () => {
  const module = await import('./pages/AdminPage');
  return { default: module.AdminPage };
});

function RouteFallback() {
  return <p className="status-banner">Loading page...</p>;
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar />
        <main className="app-main">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/play" element={<PlayPage />} />
              <Route path="/compete" element={<CompetePage />} />
              <Route path="/training" element={<TrainingPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
