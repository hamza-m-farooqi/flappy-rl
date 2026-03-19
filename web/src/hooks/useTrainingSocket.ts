import { useEffect, useState } from 'react';
import axios from 'axios';
import type { TrainingFrame } from '../components/GameCanvas';
import { API_BASE_URL, TRAINING_WS_BASE_URL } from '../config/env';

type PublicTrainingStatus = {
  is_running: boolean;
  active_run_names: string[];
};

/**
 * Connect to the per-run WebSocket for live training frames and separately poll
 * the REST status endpoint for the list of active run names.
 *
 * When `runName` changes the hook tears down the old socket and opens a new one
 * for the new run — no frames from other runs ever arrive, eliminating flicker and
 * eliminating unnecessary event-loop pressure on the server.
 */
export function useTrainingSocket(runName: string | null) {
  const [liveFrame, setLiveFrame] = useState<TrainingFrame | null>(null);
  const [uiFrame, setUiFrame] = useState<TrainingFrame | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'closed' | 'error'>(
    'connecting',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<PublicTrainingStatus | null>(null);

  // Poll the REST endpoint for active_run_names — separate from the WS so we
  // always know which runs are available even before connecting.
  useEffect(() => {
    const loadTrainingStatus = async () => {
      try {
        const response = await axios.get<PublicTrainingStatus>(
          `${API_BASE_URL}/training/status`,
        );
        setTrainingStatus(response.data);
      } catch {
        setTrainingStatus(null);
      }
    };

    void loadTrainingStatus();
    const pollId = window.setInterval(() => {
      void loadTrainingStatus();
    }, 3000);

    return () => window.clearInterval(pollId);
  }, []);

  // Open a WebSocket to /ws/training/{runName}.  Re-runs whenever runName changes.
  useEffect(() => {
    if (!runName) {
      setLiveFrame(null);
      setUiFrame(null);
      setStatus('closed');
      return;
    }

    const socket = new WebSocket(`${TRAINING_WS_BASE_URL}/${runName}`);
    let lastUiUpdateAt = 0;

    setStatus('connecting');
    setLiveFrame(null);
    setUiFrame(null);

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
    };
  }, [runName]);

  return { liveFrame, uiFrame, status, errorMessage, trainingStatus };
}
