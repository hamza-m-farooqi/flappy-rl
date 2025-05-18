import { useEffect, useRef, useState } from 'react';
import {
  createInitialPlayState,
  jumpBird,
  resetPlayState,
  stepPlayState,
  type PlayState,
} from '../game/engine';

export function usePlaySession() {
  const [playState, setPlayState] = useState<PlayState>(() => createInitialPlayState());
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    let previousTick = performance.now();

    const tick = (timestamp: number) => {
      if (timestamp - previousTick >= 1000 / playState.world.fps) {
        previousTick = timestamp;
        setPlayState((current) => stepPlayState(current));
      }
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [playState.world.fps]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      const tagName = target.tagName;
      return (
        target.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT'
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        setPlayState((current) => (current.game_over ? current : jumpBird(current)));
      }

      if (event.code === 'KeyR') {
        setPlayState(resetPlayState());
      }
    };

    const handlePointerDown = () => {
      setPlayState((current) => (current.game_over ? current : jumpBird(current)));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return {
    playState,
    restart: () => setPlayState(resetPlayState()),
  };
}
