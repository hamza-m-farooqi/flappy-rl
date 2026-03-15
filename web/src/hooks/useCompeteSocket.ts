import { useEffect, useRef, useState } from 'react';
import { COMPETE_WS_URL } from '../config/env';
import type { GameState } from '../components/GameCanvas';

export type CompeteFrame = GameState & {
  type: 'compete_frame';
  run_name: string;
  human_bird: GameState['bird'];
  ai_bird: GameState['bird'];
  human_score: number;
  ai_score: number;
  winner: 'human' | 'ai' | 'tie' | null;
};

type ConnectionState = {
  runName: string | null;
  status: 'connected' | 'closed' | 'error';
  errorMessage: string | null;
};

export function useCompeteSocket(runName: string | null) {
  const socketRef = useRef<WebSocket | null>(null);
  const [frame, setFrame] = useState<CompeteFrame | null>(null);
  const [connection, setConnection] = useState<ConnectionState>({
    runName: null,
    status: 'closed',
    errorMessage: null,
  });

  useEffect(() => {
    if (!runName) {
      return;
    }

    const socket = new WebSocket(`${COMPETE_WS_URL}?run_name=${encodeURIComponent(runName)}`);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnection({ runName, status: 'connected', errorMessage: null });
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as CompeteFrame | { type: 'error'; message: string };
        if (payload.type === 'error') {
          setConnection({ runName, status: 'error', errorMessage: payload.message });
          return;
        }
        setFrame(payload);
      } catch (error) {
        setConnection({
          runName,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Invalid compete frame.',
        });
      }
    };

    socket.onerror = () => {
      setConnection({
        runName,
        status: 'error',
        errorMessage: 'Compete socket connection failed.',
      });
    };

    socket.onclose = () => {
      setConnection({ runName, status: 'closed', errorMessage: null });
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [runName]);

  const status =
    !runName ? 'idle' : connection.runName === runName ? connection.status : 'connecting';
  const errorMessage = runName && connection.runName === runName ? connection.errorMessage : null;

  return {
    frame: runName && frame?.run_name === runName ? frame : null,
    status,
    errorMessage,
    jump: () => socketRef.current?.send(JSON.stringify({ type: 'jump' })),
    restart: () => socketRef.current?.send(JSON.stringify({ type: 'restart' })),
  };
}
