import { useEffect, useState } from 'react';
import axios from 'axios';
import type { TrainingFrame } from '../components/GameCanvas';
import { API_BASE_URL, TRAINING_WS_URL } from '../config/env';

type PublicTrainingStatus = {
  is_running: boolean;
  active_run_names: string[];
};

export function useTrainingSocket() {
  const [liveFrame, setLiveFrame] = useState<TrainingFrame | null>(null);
  const [uiFrame, setUiFrame] = useState<TrainingFrame | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'closed' | 'error'>(
    'connecting',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<PublicTrainingStatus | null>(null);

  useEffect(() => {
    const socket = new WebSocket(TRAINING_WS_URL);
    let pollId: number | null = null;
    let lastUiUpdateAt = 0;

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
        setLiveFrame(payload);

        const now = performance.now();
        if (
          payload.generation_complete ||
          payload.champion_saved_this_generation ||
          now - lastUiUpdateAt >= 180
        ) {
          lastUiUpdateAt = now;
          setUiFrame(payload);
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

  return { liveFrame, uiFrame, status, errorMessage, trainingStatus };
}
