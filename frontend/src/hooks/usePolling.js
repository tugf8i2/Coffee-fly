import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export default function usePolling(task, intervalMs) {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    let active = true;
    let timer = null;
    let running = false;
    let appIsActive = !['background', 'inactive'].includes(AppState.currentState);
    const run = async () => {
      if (!active || !appIsActive || running) return;
      running = true;
      try {
        await taskRef.current();
      } catch {
        // Cada pantalla presenta su propio estado de error. El programador sólo
        // garantiza que un fallo temporal no detenga las siguientes consultas.
      } finally {
        running = false;
        if (active && appIsActive) timer = setTimeout(run, intervalMs);
      }
    };
    const subscription = AppState.addEventListener('change', (nextState) => {
      appIsActive = !['background', 'inactive'].includes(nextState);
      if (timer) clearTimeout(timer);
      timer = null;
      if (appIsActive) run();
    });
    run();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [intervalMs]);
}
