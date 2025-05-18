import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/env';

type ScoreEntry = {
  username: string;
  score: number;
  created_at: string;
};

export function LeaderboardPage() {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadScores = async () => {
      try {
        const response = await axios.get<{ scores: ScoreEntry[] }>(`${API_BASE_URL}/leaderboard`);
        if (!active) {
          return;
        }
        setScores(response.data.scores);
        setErrorMessage(null);
      } catch (error) {
        if (!active) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load leaderboard.');
      }
    };

    void loadScores();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="page page-training">
      <div className="training-copy">
        <p className="eyebrow">Leaderboard</p>
        <h1>Top Pilots</h1>
        <p className="lede">
          High scores submitted from browser play mode are stored on the backend and
          surfaced here.
        </p>
      </div>

      {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}

      <div className="leaderboard-shell">
        <div className="leaderboard-head leaderboard-row">
          <span>Rank</span>
          <span>User</span>
          <span>Score</span>
          <span>Date</span>
        </div>

        {scores.length === 0 && !errorMessage ? (
          <p className="status-banner">No scores yet. Play a run and submit one.</p>
        ) : null}

        {scores.map((entry, index) => (
          <div key={`${entry.username}-${entry.created_at}`} className="leaderboard-row">
            <span>#{index + 1}</span>
            <span>{entry.username}</span>
            <span>{entry.score}</span>
            <span>{new Date(entry.created_at).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
