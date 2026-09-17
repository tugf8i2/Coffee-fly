import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import usePolling from '../../ganchos/usarSondeo';
import { readDriverValue, writeDriverValue } from './almacenConductor';

export default function useDriverSummary(token, userId) {
  const cacheKey = `coffee-fly:driver-summary:${userId || 'unknown'}`;
  const [data, setData] = useState({
    trips: [],
    history: [],
    active: null,
    tracking: null,
    metrics: {},
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const historyRef = useRef({ token: null, activeId: undefined, items: [] });
  const serverLoadedRef = useRef(false);
  useEffect(() => {
    let active = true;
    readDriverValue(cacheKey).then((value) => {
      if (!active || !value || serverLoadedRef.current) return;
      const cached = JSON.parse(value);
      if (cached?.trips && cached?.history) setData(cached);
    }).catch(() => {}).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [cacheKey]);
  const load = useCallback(
    async (forceHistory = false) => {
      const get = async (path) => {
        const response = await fetchApi(`${API_BASE_URL}${path}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (!response.ok) {
          const error = Error(
            typeof result.detail === 'string'
              ? result.detail
              : 'No se pudo actualizar el viaje.',
          );
          error.status = response.status;
          throw error;
        }
        return result;
      };
      try {
        const [trips, active, dashboard] = await Promise.all([
          get('/viajes/mis-asignados'),
          get('/viajes/mi-activo'),
          get('/dashboard/'),
        ]);
        const current = active[0] || null;
        const activeId = current?.id_viaje || null;
        // El historial no necesita volver a consultarse cada vez que cambia el GPS.
        if (
          forceHistory === true ||
          historyRef.current.token !== token ||
          historyRef.current.activeId !== activeId
        ) {
          historyRef.current = {
            token,
            activeId,
            items: await get('/viajes/mi-historial'),
          };
        }
        const delivery =
          current?.cargas.find((item) => !item.carga_recogida_en) ||
          current?.cargas.at(-1);
        const tracking = delivery
          ? await get(`/entregas/${delivery.id_entrega}/seguimiento`)
          : null;
        const next = {
          trips,
          history: historyRef.current.items,
          active: current,
          tracking,
          metrics: dashboard.metricas || {},
        };
        serverLoadedRef.current = true;
        setData(next);
        writeDriverValue(cacheKey, JSON.stringify({ ...next, tracking: tracking ? { ...tracking, conductor_foto_perfil: null } : null })).catch(() => {});
        setError('');
      } catch (reason) {
        setError(reason.status ? reason.message : 'Sin conexión: se muestran los viajes guardados en este dispositivo, si los hay.');
      } finally {
        setLoading(false);
      }
    },
    [token, cacheKey],
  );
  usePolling(load, 15000);
  return { ...data, error, loading, refresh: () => load(true) };
}
