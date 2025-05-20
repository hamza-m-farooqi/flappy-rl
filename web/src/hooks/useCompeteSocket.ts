import { useEffect, useRef, useState } from 'react';
import { COMPETE_WS_URL } from '../config/env';
import type { GameState } from '../components/GameCanvas';

export type CompeteFrame = GameState & {
  type: 'compete_frame';
  human_bird: GameState['bird'];
  ai_bird: GameState['bird'];
  human_score: number;
  ai_score: number;
  winner: 'human' | 'ai' | 'tie' | null;
};

export function useCompeteSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const [frame, setFrame] = useState<CompeteFrame | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'closed' | 'error'>(
    'connecting',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const socket = new WebSocket(COMPETE_WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('connected');
      setErrorMessage(null);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as CompeteFrame | { type: 'error'; message: string };
        if (payload.type === 'error') {
          setStatus('error');
          setErrorMessage(payload.message);
          return;
        }
        setFrame(payload);
      } catch (error) {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Invalid compete frame.');
      }
    };

    socket.onerror = () => {
      setStatus('error');
      setErrorMessage('Compete socket connection failed.');
    };

    socket.onclose = () => {
      setStatus('closed');
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  return {
    frame,
    status,
    errorMessage,
    jump: () => socketRef.current?.send(JSON.stringify({ type: 'jump' })),
    restart: () => socketRef.current?.send(JSON.stringify({ type: 'restart' })),
  };
}
