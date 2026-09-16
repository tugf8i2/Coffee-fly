import React, { useCallback, useState } from 'react';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import usePolling from '../../ganchos/usarSondeo';
import PanelRegistrador from './PanelRegistrador.web';

export default function RegistradorLayout({ token, ...props }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const get = async (path) => {
      const response = await fetchApi(`${API_BASE_URL}${path}`, { headers });
      if (!response.ok) throw Error('No fue posible actualizar los registros del panel.');
      return response.json();
    };
    try {
      const [users, vehicles, cooperatives] = await Promise.all([
        get('/usuarios/'), get('/vehiculos/'),
        (async () => {
          const all = [];
          for (let skip = 0; ; skip += 100) {
            const page = await get(`/cooperativas/?skip=${skip}&limit=100`);
            all.push(...page);
            if (page.length < 100) return all;
          }
        })(),
      ]);
      const totals = { cooperativas: cooperatives.length, vehiculos: vehicles.length, registradores: 0, coordinadores: 0, conductores: 0, caficultores: 0 };
      const keys = { 1: 'coordinadores', 2: 'conductores', 3: 'registradores', 4: 'caficultores' };
      for (const user of users) if (keys[user.rol_id]) totals[keys[user.rol_id]] += 1;
      const recentCoops = [...cooperatives].sort((a, b) => b.id_cooperativa - a.id_cooperativa);
      const newestUser = (role) => [...users].filter((item) => Number(item.rol_id) === role).sort((a, b) => b.id_usuario - a.id_usuario)[0];
      const farmer = newestUser(4);
      const driver = newestUser(2);
      const vehicle = [...vehicles].sort((a, b) => b.id_vehiculo - a.id_vehiculo)[0];
      const activity = [
        recentCoops[0] && { icon: 'people', title: 'Cooperativa registrada', detail: recentCoops[0].nombre },
        farmer && { icon: 'farmer', title: 'Caficultor registrado', detail: `${farmer.nombre_usuario} ${farmer.apellido}` },
        vehicle && { icon: 'truck', title: 'Vehículo registrado', detail: `Placa ${vehicle.placa}` },
        driver && { icon: 'driver', title: 'Conductor registrado', detail: `${driver.nombre_usuario} ${driver.apellido}` },
      ].filter(Boolean);
      setSummary({ totals, cooperatives: recentCoops, activity, requests: [] });
      setError('');
    } catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  }, [token]);
  usePolling(load, 30000);
  return <PanelRegistrador {...props} summary={summary} loading={loading} error={error} onRefresh={load}/>;
}
