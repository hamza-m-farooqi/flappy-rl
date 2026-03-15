import { useEffect, useState } from 'react';
import axios from 'axios';
import type { TrainingFrame } from '../components/GameCanvas';
import { API_BASE_URL, TRAINING_WS_URL } from '../config/env';

type PublicTrainingStatus = {
  is_running: boolean;
  active_run_name: string | null;
};

export type GenerationStat = {
  generation: number;
  max_fitness: number;
  avg_fitness: number;
  species_count: number;
};

export function useTrainingSocket() {
  const [frame, setFrame] = useState<TrainingFrame | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'closed' | 'error'>(
    'connecting',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<PublicTrainingStatus | null>(null);
  const [statsHistory, setStatsHistory] = useState<GenerationStat[]>([]);

  useEffect(() => {
    const socket = new WebSocket(TRAINING_WS_URL);
    let pollId: number | null = null;

    const loadTrainingStatus = async () => {
      try {
        const response = await axios.get<PublicTrainingStatus>(`${API_BASE_URL}/training/status`);
        setTrainingStatus(response.data);
      } catch {
        setTrainingStatus(null);
      }
    };

    void loadTrainingStatus();
    pollId = window.setInterval(() => {
      void loadTrainingStatus();
    }, 3000);

    socket.onopen = () => {
      setStatus('connected');
      setErrorMessage(null);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as TrainingFrame;
        setFrame(payload);

        if (payload.generation_stats && payload.generation_stats.max_fitness !== null) {
          setStatsHistory((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.generation !== payload.generation) {
              return [
                ...prev,
                {
                  generation: payload.generation,
                  max_fitness: payload.generation_stats!.max_fitness!,
                  avg_fitness: payload.generation_stats!.avg_fitness!,
                  species_count: payload.generation_stats!.species_count,
                },
              ];
            }
            return prev;
          });
        }

      } catch (error) {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Invalid training frame.');
      }
    };

    socket.onerror = () => {
      setStatus('error');
      setErrorMessage('Training socket connection failed.');
    };

    socket.onclose = () => {
      setStatus('closed');
    };

    return () => {
      socket.close();
      if (pollId !== null) {
        window.clearInterval(pollId);
      }
    };
  }, []);

  return { frame, status, errorMessage, trainingStatus, statsHistory };
}
