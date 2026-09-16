import { useEffect, useMemo, useState } from 'react';
import { seleccionarPosicionSeguimiento } from '../servicios/posicionSeguimiento';

export default function useTrackingPosition(points) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  return useMemo(() => seleccionarPosicionSeguimiento(points, Math.max(now, Date.now())), [points, now]);
}
