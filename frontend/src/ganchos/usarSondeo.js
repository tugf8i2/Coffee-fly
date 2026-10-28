import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export default function usePolling(task, intervalMs) {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    let active = true;
    let timer = null;
    let running = false;
    const isAppActive = () => !['background', 'inactive'].includes(AppState.currentState)
      && (typeof document === 'undefined' || document.visibilityState !== 'hidden')
      && (typeof window === 'undefined' || window.__COFFEE_FLY_APP_ACTIVE__ !== false);
    let appIsActive = isAppActive();
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
    const updateActivity = () => {
      const wasActive = appIsActive;
      appIsActive = isAppActive();
      if (wasActive === appIsActive) return;
      if (timer) clearTimeout(timer);
      timer = null;
      if (appIsActive) run();
    };
    const subscription = AppState.addEventListener('change', updateActivity);
    if (typeof window !== 'undefined') window.addEventListener('coffee-fly:app-state', updateActivity);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', updateActivity);
    run();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      subscription.remove();
      if (typeof window !== 'undefined') window.removeEventListener('coffee-fly:app-state', updateActivity);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', updateActivity);
    };
  }, [intervalMs]);
}
