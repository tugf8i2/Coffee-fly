import { useCallback, useRef, useState } from 'react';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import usePolling from '../../ganchos/usarSondeo';

export default function useDriverSummary(token) {
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
  const load = useCallback(
    async (forceHistory = false) => {
      const get = async (path) => {
        const response = await fetchApi(`${API_BASE_URL}${path}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (!response.ok)
          throw Error(
            typeof result.detail === 'string'
              ? result.detail
              : 'No se pudo actualizar el viaje.',
          );
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
        setData({
          trips,
          history: historyRef.current.items,
          active: current,
          tracking,
          metrics: dashboard.metricas || {},
        });
        setError('');
      } catch (reason) {
        setError(reason.message);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );
  usePolling(load, 15000);
  return { ...data, error, loading, refresh: () => load(true) };
}
