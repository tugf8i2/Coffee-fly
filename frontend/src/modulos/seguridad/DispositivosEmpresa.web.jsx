import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, fetchApi } from '../../configuracion';

const timeLabel = (value) => value
  ? new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Sin registro';

export default function DispositivosEmpresa({ token }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchApi(`${API_BASE_URL}/seguridad/dispositivos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'No se pudieron consultar los dispositivos.');
      setSessions(data);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const revoke = async (sessionId) => {
    setBusy(sessionId);
    setError('');
    try {
      const response = await fetchApi(`${API_BASE_URL}/seguridad/sesiones/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('No se pudo cerrar la sesión de ese dispositivo.');
      setSessions((current) => current.filter((session) => session.session_id !== sessionId));
      setConfirming(null);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(null);
    }
  };

  return <div className="company-devices">
    <p>Sesiones activas de Coffee Fly. «En línea» indica que el dispositivo contactó la API durante los últimos 90 segundos.</p>
    <button className="reg-green-button" onClick={refresh} disabled={loading}>Actualizar dispositivos</button>
    {error && <p role="alert">{error}</p>}
    {loading && !sessions.length && <p>Cargando dispositivos…</p>}
    {!loading && !sessions.length && <p>No hay sesiones activas.</p>}
    <div className="company-device-list">
      {sessions.map((session) => <article className="company-device" key={session.session_id}>
        <strong>{session.device_name}</strong>
        <span>{session.online ? 'En línea' : 'Sin contacto reciente'} · {session.device_platform || 'Plataforma sin identificar'}</span>
        <span>{session.user_name} · {session.role || 'Sin rol'}</span>
        <span>{session.email}</span>
        <span>Sesión iniciada: {timeLabel(session.signed_in_at)}</span>
        <span>Último contacto: {timeLabel(session.last_seen_at)}</span>
        <small>ID de instalación: {session.device_id || 'Anterior a este registro'}</small>
        {confirming === session.session_id ? <div className="company-device-actions">
          <span>¿Cerrar esta sesión remotamente?</span>
          <button className="reg-green-button" disabled={busy === session.session_id} onClick={() => revoke(session.session_id)}>{busy === session.session_id ? 'Cerrando…' : 'Sí, cerrar sesión'}</button>
          <button className="reg-text-button" onClick={() => setConfirming(null)}>Cancelar</button>
        </div> : <button className="reg-text-button" onClick={() => setConfirming(session.session_id)}>Cerrar sesión en este dispositivo</button>}
      </article>)}
    </div>
  </div>;
}
