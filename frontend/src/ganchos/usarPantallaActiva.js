import { useEffect, useState } from 'react';
import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
  isAvailableAsync,
} from 'expo-keep-awake';

const TAG = 'coffee-fly-navigation';

export default function useKeepNavigationAwake(enabled) {
  const [status, setStatus] = useState('inactive');
  useEffect(() => {
    let disposed = false;
    if (!enabled) {
      deactivateKeepAwake(TAG).catch(() => {});
      setStatus('inactive');
      return undefined;
    }
    isAvailableAsync()
      .then(async (available) => {
        if (disposed) return;
        if (!available) {
          setStatus('unavailable');
          return;
        }
        await activateKeepAwakeAsync(TAG);
        if (!disposed) setStatus('active');
      })
      .catch(() => { if (!disposed) setStatus('unavailable'); });
    return () => {
      disposed = true;
      deactivateKeepAwake(TAG).catch(() => {});
    };
  }, [enabled]);
  return status;
}
