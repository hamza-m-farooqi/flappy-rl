import { useEffect, useState } from 'react';
import type { TrainingFrame } from '../components/GameCanvas';

const TRAINING_SOCKET_URL = 'ws://localhost:8000/ws/training';

export function useTrainingSocket() {
  const [frame, setFrame] = useState<TrainingFrame | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'closed' | 'error'>(
    'connecting',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const socket = new WebSocket(TRAINING_SOCKET_URL);

    socket.onopen = () => {
      setStatus('connected');
      setErrorMessage(null);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as TrainingFrame;
        setFrame(payload);
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
  }, []);

  return { frame, status, errorMessage };
}
