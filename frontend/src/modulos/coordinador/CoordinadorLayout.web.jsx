import MarcaCafe from '../../componentes/comunes/MarcaCafe.web';
import BannerCafe from '../../componentes/comunes/BannerCafe';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import usePolling from '../../ganchos/usarSondeo';
import Icon from '../panel/IconoRegistrador.web';
import MapaAbierto from '../../componentes/mapas/MapaAbierto';
import FleetMap from '../../componentes/mapas/MapaFlota';
import useTrackingPosition from '../../ganchos/usarPosicionSeguimiento';
import { driverDate } from '../conductor/presentacionConductor';
import {
  coordinatorRows,
  searchCoordinatorRows,
} from './presentacionCoordinador';
import regular from '../../assets/fonts/RobotoCondensed-Regular.ttf';
import bold from '../../assets/fonts/RobotoCondensed-Bold.ttf';
import './PanelCoordinador.css';

const uri = (asset) =>
  typeof asset === 'string'
    ? asset
    : asset?.uri || Image.resolveAssetSource?.(asset)?.uri;
const menu = [
  ['home', 'Inicio', 'dashboard'],
  ['clipboard', 'Solicitudes', 'deliveries'],
  ['people', 'Asignaciones', 'vehicleAssignment'],
  ['truck', 'Vehículos', 'vehicleStatus'],
  ['driver', 'Conductores', 'drivers'],
  ['pin', 'Mapa en vivo', 'tracking'],
  ['file', 'Reportes', 'reports'],
  ['bell', 'Notificaciones', 'notifications'],
  ['user', 'Cuenta', 'profile'],
];
function Badge({ children }) {
  const tone = /Pendiente|asignación|incompleto|atrasado/i.test(children)
    ? 'amber'
    : /transporte|ruta/i.test(children)
      ? 'blue'
      : /Cancelada|mantenimiento/i.test(children)
        ? 'red'
        : 'green';
  return (
    <span className={`coord-badge ${tone}`}>
      <span className="coord-dot" />
      {children}
    </span>
  );
}
function Heading({ title, subtitle, children }) {
  return (
    <div className="coord-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
function Metric({ icon, value, label, tone }) {
  return (
    <div className={`coord-metric ${tone || ''}`}>
      <span className="coord-metric-icon">
        <Icon name={icon} size={26} />
      </span>
      <div>
        <strong>{value ?? '—'}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
function RequestsTable({ rows, onDetail }) {
  return (
    <div className="coord-table-scroll">
      <table>
        <thead>
          <tr>
            {[
              '# Solicitud',
              'Fecha',
              'Caficultor',
              'Cantidad',
              'Origen',
              'Destino',
              'Estado',
              'Acciones',
            ].map((title) => (
              <th key={title}>{title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>
                <button className="coord-link" onClick={() => onDetail(item)}>
                  CF-{String(item.id).slice(0, 8)}
                </button>
              </td>
              <td>{driverDate(item.date)?.toLocaleDateString('es-CO')}</td>
              <td>{item.farmer}</td>
              <td>{Number(item.kg).toLocaleString('es-CO')} kg</td>
              <td>{item.origen || 'Finca del caficultor'}</td>
              <td>{item.destino || 'Por consultar'}</td>
              <td>
                <Badge>{item.status}</Badge>
              </td>
              <td>
                <button
                  className="coord-icon-button"
                  aria-label={`Ver solicitud ${String(item.id).slice(0, 8)}`}
                  onClick={() => onDetail(item)}
                >
                  <Icon name="file" size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="coord-empty">No hay solicitudes para mostrar.</div>
      )}
    </div>
  );
}

export default function CoordinadorLayout({
  user,
  token,
  go,
  screen,
  onLogout,
  connectionStatus,
  notice,
  operationsScreens,
}) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 850);
  const [section, setSection] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const notificationStorageKey = `coffee-fly:coord:read-notifications:${user.id || user.id_usuario}`;
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(notificationStorageKey) || '[]'); }
    catch { return []; }
  });
  const knownNotificationIds = useRef(null);
  const audioContextRef = useRef(null);
  const [notificationToast, setNotificationToast] = useState(null);
  const [data, setData] = useState({
    requests: [],
    deliveries: [],
    vehicles: [],
    drivers: [],
    metrics: {},
    fleet: null,
    notifications: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Todas');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [route, setRoute] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [preferenceMessage, setPreferenceMessage] = useState('');
  const [preferences, setPreferences] = useState(() => {
    try {
      return (
        JSON.parse(
          localStorage.getItem(
            `coffee-fly:coord:prefs:${user.id || user.id_usuario}`,
          ),
        ) || { dark: false, compact: false }
      );
    } catch {
      return { dark: false, compact: false };
    }
  });
  const current = section || screen;
  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;
      context.resume();
      [0, 0.16].forEach((delay, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = index ? 880 : 660;
        gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.15);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(context.currentTime + delay);
        oscillator.stop(context.currentTime + delay + 0.16);
      });
    } catch { /* El aviso visual permanece disponible si el navegador bloquea audio. */ }
  };
  useEffect(() => {
    const unlockAudio = () => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current ||= new AudioContextClass();
        audioContextRef.current.resume().catch(() => {});
      }
    };
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    return () => {
      document.removeEventListener('pointerdown', unlockAudio);
      audioContextRef.current?.close();
    };
  }, []);
  useEffect(() => {
    if (!notificationToast) return undefined;
    const timer = setTimeout(() => setNotificationToast(null), 8000);
    return () => clearTimeout(timer);
  }, [notificationToast]);
  useEffect(() => {
    if (current !== 'notifications' || !data.notifications.length) return;
    setReadNotificationIds((previous) => {
      const next = [...new Set([...previous, ...data.notifications.map((item) => item.id_evento)])].slice(-500);
      try { localStorage.setItem(notificationStorageKey, JSON.stringify(next)); } catch { /* Sin almacenamiento local, se conserva durante la sesión. */ }
      return next.length === previous.length ? previous : next;
    });
  }, [current, data.notifications, notificationStorageKey]);
  useEffect(() => {
    const breakpoint = window.matchMedia('(max-width: 850px)');
    const resize = () => {
      if (breakpoint.matches) setCollapsed(true);
    };
    breakpoint.addEventListener('change', resize);
    return () => breakpoint.removeEventListener('change', resize);
  }, []);
  const position = useTrackingPosition(tracking?.puntos || []);
  const get = useCallback(
    async (path, signal) => {
      const response = await fetchApi(`${API_BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(
          typeof result.detail === 'string'
            ? result.detail
            : 'No fue posible consultar esta información.',
        );
      return result;
    },
    [token],
  );
  const load = useCallback(async () => {
    try {
      const [
        dashboard,
        requests,
        deliveries,
        drivers,
        fleet,
        notifications,
        vehicles,
      ] = await Promise.all([
        get('/dashboard/'),
        get('/entregas/solicitudes-activas'),
        get(`/entregas/historial?pagina=${page}`),
        get('/entregas/conductores-disponibles'),
        get('/monitoreo/resumen'),
        get('/entregas/eventos/notificaciones'),
        (async () => {
          const all = [];
          for (let skip = 0; ; skip += 100) {
            const batch = await get(`/vehiculos/estado?skip=${skip}&limit=100`);
            all.push(...batch);
            if (batch.length < 100) return all;
          }
        })(),
      ]);
      const latestIds = new Set(notifications.map((item) => item.id_evento));
      if (knownNotificationIds.current !== null) {
        const newlyArrived = notifications.filter((item) => !knownNotificationIds.current.has(item.id_evento));
        if (newlyArrived.length) {
          setNotificationToast({ count: newlyArrived.length, item: newlyArrived[0] });
          playNotificationSound();
        }
      }
      knownNotificationIds.current = latestIds;
      setData({
        requests,
        deliveries: deliveries.items || [],
        total: deliveries.total || 0,
        metrics: dashboard.metricas || {},
        vehicles,
        drivers,
        fleet,
        notifications,
      });
      setError('');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, [get, page]);
  usePolling(load, 30000);
  const previousPage = useRef(page);
  useEffect(() => {
    if (previousPage.current !== page) {
      previousPage.current = page;
      load();
    }
  }, [page, load]);
  useEffect(() => {
    setSection(null);
    setProfileOpen(false);
    setSearch('');
    setFilter('Todas');
  }, [screen]);
  useEffect(() => {
    const escape = (event) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        if (window.innerWidth < 850) setCollapsed(true);
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setTracking(null);
    setRoute(null);
    setDetailError('');
    if (current === 'detail' && selected?.registered)
      get(`/entregas/${selected.id}/seguimiento`, controller.signal)
        .then(async (result) => {
          if (controller.signal.aborted) return;
          setTracking(result);
          const last = result.puntos
            ?.filter(
              (point) =>
                point.precision_m != null && Number(point.precision_m) <= 25,
            )
            .at(-1);
          const origin = last
            ? {
                latitud_origen: Number(last.latitud),
                longitud_origen: Number(last.longitud),
              }
            : result.recoleccion_latitud != null &&
                result.recoleccion_longitud != null
              ? {
                  latitud_origen: result.recoleccion_latitud,
                  longitud_origen: result.recoleccion_longitud,
                }
              : null;
          if (
            !origin ||
            result.destino_latitud == null ||
            result.destino_longitud == null
          )
            return;
          const response = await fetchApi(
            `${API_BASE_URL}/entregas/${selected.id}/ruta-navegacion`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(origin),
              signal: controller.signal,
              retries: 0,
            },
          );
          if (!response.ok)
            throw Error('No fue posible calcular la ruta estimada.');
          const value = await response.json();
          if (!controller.signal.aborted) setRoute(value);
        })
        .catch((reason) => {
          if (!controller.signal.aborted) setDetailError(reason.message);
        });
    return () => controller.abort();
  }, [selected?.id, current, get, token]);
  const navigate = (target) => {
    setSearch('');
    setFilter('Todas');
    setProfileOpen(false);
    setFiltersOpen(false);
    if (
      ['drivers', 'notifications', 'profile'].includes(
        target,
      )
    )
      setSection(target);
    else {
      setSection(null);
      go(target);
    }
    if (window.innerWidth < 850) setCollapsed(true);
  };
  const detail = (item) => {
    setSelected(item);
    setSection('detail');
  };
  const rows = coordinatorRows(data.requests, data.deliveries);
  const visible = searchCoordinatorRows(rows, search, filter);
  const fullName =
    [user.nombre || user.nombre_usuario, user.apellido]
      .filter(Boolean)
      .join(' ') || 'Coordinador';
  const title =
    current === 'detail'
      ? 'Detalle de solicitud'
      : current === 'register'
        ? 'Registrar recolección'
        : menu.find(([, , target]) => target === current)?.[1] ||
          {
            monitoring: 'Seguimiento en tiempo real',
            assignmentHistory: 'Historial de asignaciones',
            deliveryHistory: 'Historial de entregas',
          }[current] ||
          'Coordinador';
  const savePreferences = () => {
    try {
      localStorage.setItem(
        `coffee-fly:coord:prefs:${user.id || user.id_usuario}`,
        JSON.stringify(preferences),
      );
      setPreferenceMessage('Preferencias guardadas en este navegador.');
    } catch {
      setPreferenceMessage('No fue posible guardar las preferencias.');
    }
  };
  const searchBar = (placeholder) => (
    <div className="coord-search-row">
      <label className="coord-search">
        <Icon name="pin" size={17} />
        <input
          aria-label={placeholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={placeholder}
        />
      </label>
      <button
        className="coord-button secondary"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen(!filtersOpen)}
      >
        <Icon name="gear" size={16} />
        Filtros
      </button>
    </div>
  );
  const metrics = (
    <div className="coord-metrics">
      <Metric
        icon="truck"
        value={loading ? '—' : data.requests.length}
        label="Solicitudes pendientes"
        tone="amber"
      />
      <Metric
        icon="people"
        value={
          loading
            ? '—'
            : data.deliveries.filter(
                (item) =>
                  item.estado_entrega === 'pendiente' && !item.vehiculo_placa,
              ).length
        }
        label="En asignación (esta página)"
      />
      <Metric
        icon="file"
        value={data.fleet?.vehiculos_en_camino}
        label="En transporte"
        tone="blue"
      />
      <Metric
        icon="leaf"
        value={data.metrics.entregas_hoy}
        label="Recolecciones (hoy)"
      />
    </div>
  );
  return (
    <div
      className={`coord-app ${collapsed ? 'coord-collapsed' : ''} ${preferences.dark ? 'coord-dark' : ''} ${preferences.compact ? 'coord-compact' : ''}`}
    >
      <style>{`@font-face{font-family:Coordinator;src:url('${uri(regular)}');font-weight:400}@font-face{font-family:Coordinator;src:url('${uri(bold)}');font-weight:600 900}`}</style>
      {!collapsed && (
        <button
          className="coord-scrim"
          aria-label="Cerrar menú"
          onClick={() => setCollapsed(true)}
        />
      )}
      <aside
        className="coord-sidebar"
        inert={collapsed}
        aria-hidden={collapsed}
      >
        <button className="coord-brand" onClick={() => navigate('dashboard')} aria-label="Coffee Fly, inicio"><MarcaCafe/></button>
        <nav aria-label="Menú del coordinador">
          {menu.map(([icon, label, target]) => (
            <button
              key={target}
              className={
                current === target ||
                (target === 'deliveries' &&
                  ['detail', 'register'].includes(current))
                  ? 'active'
                  : ''
              }
              onClick={() => navigate(target)}
            >
              <Icon name={icon} size={19} />
              {label}
              {target === 'notifications' && data.notifications.some((item) => !readNotificationIds.includes(item.id_evento)) && (
                <span className="coord-notification-dot" />
              )}
            </button>
          ))}
        </nav>
      </aside>
      <div className="coord-workspace">
        {notificationToast && <button className="coord-notification-toast" role="alert" onClick={() => { setNotificationToast(null); navigate('notifications'); }}>
          <Icon name="bell" size={20} />
          <span><strong>{notificationToast.count === 1 ? 'Nueva notificación' : `${notificationToast.count} nuevas notificaciones`}</strong><small>{notificationToast.item.tipo_evento} · {notificationToast.item.conductor_nombre}</small></span>
          <span aria-hidden="true">Ver</span>
        </button>}
        <header className="coord-top">
          <div className="coord-top-left">
            <button
              className="coord-icon-button"
              aria-label={collapsed ? 'Abrir menú' : 'Contraer menú'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              <Icon name="menu" />
            </button>
            <span className="cf-mobile-brand"><MarcaCafe compact/></span>
            {current === 'dashboard' && (
              <div>
                <h1>
                  ¡Hola, {user.nombre || user.nombre_usuario || 'coordinador'}!
                </h1>
                <p>Panel de coordinador</p>
              </div>
            )}
          </div>
          <div className="coord-top-right">
            <div className="coord-profile-anchor">
              <button
                className="coord-profile"
                aria-label={`Cuenta de ${fullName}, coordinador`}
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen(!profileOpen)}
              >
                <span className="coord-avatar">
                  <Icon name="user" size={27} />
                </span>
                <span>
                  <strong>{fullName}</strong>
                  <small>Coordinador</small>
                </span>
                <Icon name="chevron" size={16} />
              </button>
              {profileOpen && (
                <div className="coord-popover"><p style={{ padding: 11, overflowWrap: 'anywhere' }}><strong>{fullName}</strong><br/>Coordinador</p>
                  <button onClick={() => navigate('profile')}>Abrir cuenta</button>
                  <button onClick={onLogout}>Cerrar sesión</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="coord-main">
          <div className="coord-breadcrumb">
            <button onClick={() => navigate('dashboard')}>Inicio</button>
            {current !== 'dashboard' && (
              <>
                {' '}
                › <span>{title}</span>
              </>
            )}
            <span className="coord-network">
              {connectionStatus === 'online'
                ? '● En línea'
                : connectionStatus === 'checking'
                  ? 'Comprobando conexión'
                  : 'Sin conexión al servidor'}
            </span>
          </div>
          {notice && (
            <div className="coord-notice" role="status">
              {notice}
            </div>
          )}
          {error && (
            <div className="coord-notice" role="alert">
              {error} <button onClick={load}>Reintentar</button>
            </div>
          )}
          {current === 'dashboard' && (
            <>
              <div className="coord-date">
                {new Date().toLocaleDateString('es-CO', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
              <BannerCafe title="Coordinamos hoy un mejor mañana" subtitle="Conectamos el campo con nuevas oportunidades."/>
              {metrics}
              <div className="coord-dashboard-grid">
                <section className="coord-card">
                  <div className="coord-card-heading">
                    <h2>
                      <Icon name="clipboard" size={20} />
                      Solicitudes recientes
                    </h2>
                    <button onClick={() => navigate('deliveries')}>
                      Ver todas
                    </button>
                  </div>
                  <RequestsTable rows={rows.slice(0, 5)} onDetail={detail} />
                </section>
                <section className="coord-card">
                  <div className="coord-card-heading">
                    <h2>
                      <Icon name="pin" size={20} />
                      Mapa rápido
                    </h2>
                    <button onClick={() => navigate('tracking')}>
                      Ver mapa
                    </button>
                  </div>
                  <FleetMap
                    vehicles={data.fleet?.vehiculos || []}
                    height={235}
                  />
                  <div className="coord-map-legend">
                    <Badge>
                      {data.fleet?.vehiculos_en_camino || 0} en transporte
                    </Badge>
                    <Badge>{data.requests.length} por registrar</Badge>
                  </div>
                </section>
              </div>
            </>
          )}
          {current === 'deliveries' && (
            <>
              <Heading
                title="Solicitudes de transporte"
                subtitle="Gestiona las solicitudes de carga y sus recolecciones."
              >
                <button
                  className="coord-button secondary"
                  onClick={() => navigate('deliveryHistory')}
                >
                  Historial de recolecciones
                </button>
                <button
                  className="coord-button"
                  onClick={() => {
                    setSelected(null);
                    setSection('register');
                  }}
                >
                  ＋ Registrar recolección
                </button>
              </Heading>
              <div className="coord-filter-tabs">
                {[
                  'Todas',
                  'Pendiente',
                  'En asignación',
                  'Asignada',
                  'En transporte',
                  'Completada',
                  'Cancelada',
                ].map((status) => (
                  <button
                    key={status}
                    className={filter === status ? 'active' : ''}
                    aria-pressed={filter === status}
                    onClick={() => setFilter(status)}
                  >
                    {status} (
                    {status === 'Todas'
                      ? rows.length
                      : rows.filter((item) => item.status === status).length}
                    )
                  </button>
                ))}
              </div>
              {searchBar('Buscar por caficultor, solicitud o vehículo…')}
              {filtersOpen && (
                <div className="coord-notice">
                  Los filtros y la búsqueda se aplican a las solicitudes activas
                  y a la página de recolecciones mostrada.
                </div>
              )}
              <section className="coord-card">
                <RequestsTable rows={visible} onDetail={detail} />
                <div className="coord-pagination">
                  <span>
                    {data.requests.length} solicitudes sin registrar ·{' '}
                    {data.total} recolecciones · página {page}
                  </span>
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    aria-label="Página anterior"
                  >
                    ‹
                  </button>
                  <strong>{page}</strong>
                  <button
                    disabled={page * 20 >= data.total}
                    onClick={() => setPage(page + 1)}
                    aria-label="Página siguiente"
                  >
                    ›
                  </button>
                </div>
              </section>
            </>
          )}
          {current === 'detail' && selected && (
            <>
              <Heading
                title="Detalle de solicitud y asignación"
                subtitle={`CF-${String(selected.id).slice(0, 8)}`}
              >
                <Badge>{selected.status}</Badge>
                <button
                  className="coord-button"
                  disabled={
                    selected.registered &&
                    selected.estado_entrega !== 'pendiente'
                  }
                  onClick={() =>
                    selected.registered
                      ? navigate('vehicleAssignment')
                      : setSection('register')
                  }
                >
                  {selected.registered
                    ? '＋ Asignar transporte'
                    : '＋ Registrar recolección'}
                </button>
              </Heading>
              <div className="coord-detail-grid">
                <section className="coord-card">
                  <h2>
                    <Icon name="clipboard" size={20} />
                    Información de la solicitud
                  </h2>
                  <dl>
                    {[
                      ['Número', `CF-${String(selected.id).slice(0, 8)}`],
                      [
                        'Fecha de solicitud',
                        driverDate(selected.date)?.toLocaleString('es-CO'),
                      ],
                      ['Caficultor', selected.farmer],
                      [
                        'Cantidad',
                        `${Number(selected.kg).toLocaleString('es-CO')} kg`,
                      ],
                      [
                        'Origen',
                        tracking?.recoleccion || 'Ubicación aún no consultada',
                      ],
                      [
                        'Destino',
                        tracking?.cooperativa_destino ||
                          tracking?.cooperativa_nombre ||
                          'Por asignar',
                      ],
                      ['Vehículo', selected.vehiculo_placa || 'Sin asignar'],
                      [
                        'Observaciones',
                        selected.observaciones || 'Sin observaciones',
                      ],
                    ].map(([label, value]) => (
                      <React.Fragment key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </section>
                <div className="coord-detail-aside">
                  <section className="coord-card">
                    <h2>
                      <Icon name="pin" size={20} />
                      Mapa de ruta (estimada)
                    </h2>
                    {tracking?.destino_latitud != null &&
                    tracking?.destino_longitud != null ? (
                      <div className="coord-route-map">
                        <MapaAbierto
                          style={{ flex: 1 }}
                          route={route?.puntos || []}
                          routeColor="#168e58"
                          markers={[
                            {
                              id: 'destination',
                              coordinate: {
                                latitude: tracking.destino_latitud,
                                longitude: tracking.destino_longitud,
                              },
                              color: '#e35b45',
                              title: tracking.destino,
                            },
                            position.point
                              ? {
                                  id: 'vehicle',
                                  kind: 'vehicle',
                                  coordinate: {
                                    latitude: Number(position.point.latitud),
                                    longitude: Number(position.point.longitud),
                                  },
                                  title: 'Conductor',
                                }
                              : null,
                          ].filter(Boolean)}
                          camera={{
                            fitMode: route ? 'route' : 'markers',
                            fitKey: selected.id,
                            padding: 38,
                            maxZoom: 15,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="coord-map-placeholder">
                        <Icon name="pin" size={42} />
                        <p>
                          {detailError
                            ? 'Ruta no disponible para esta recolección.'
                            : tracking
                              ? 'Esta recolección aún no tiene destino geográfico registrado.'
                              : selected.registered
                                ? 'Consultando destino registrado…'
                                : 'Registra y asigna el transporte para consultar la ruta.'}
                        </p>
                      </div>
                    )}
                    {route && (
                      <p>
                        <strong>Distancia estimada:</strong>{' '}
                        {(route.distancia_m / 1000).toFixed(1)} km
                        <br />
                        <strong>Tiempo estimado:</strong>{' '}
                        {Math.ceil(route.duracion_s / 60)} min · sin tráfico en
                        vivo
                      </p>
                    )}
                    {detailError && <p role="status">{detailError}</p>}
                  </section>
                </div>
              </div>
            </>
          )}
          {current === 'vehicleStatus' && (
            <>
              <Heading
                title="Vehículos"
                subtitle="Consulta la capacidad y disponibilidad de la flota."
              >
                <span className="coord-permission">
                  Altas y edición: registrador
                </span>
              </Heading>
              {searchBar('Buscar vehículo…')}
              {filtersOpen && (
                <div className="coord-filter-tabs">
                  {['Todas', 'disponible', 'en camino', 'en mantenimiento'].map(
                    (status) => (
                      <button
                        key={status}
                        aria-pressed={filter === status}
                        className={filter === status ? 'active' : ''}
                        onClick={() => setFilter(status)}
                      >
                        {status}
                      </button>
                    ),
                  )}
                </div>
              )}
              <section className="coord-card">
                <div className="coord-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          'Placa',
                          'Tipo',
                          'Capacidad',
                          'Estado',
                          'Ubicación',
                          'Acciones',
                        ].map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.vehicles
                        .filter(
                          (vehicle) =>
                            `${vehicle.placa} ${vehicle.tipo_vehiculo}`
                              .toLowerCase()
                              .includes(search.toLowerCase()) &&
                            (filter === 'Todas' ||
                              vehicle.estado_vehiculo === filter),
                        )
                        .map((vehicle) => (
                          <tr key={vehicle.id_vehiculo}>
                            <td>
                              <strong>{vehicle.placa}</strong>
                            </td>
                            <td>
                              {vehicle.tipo_vehiculo}
                              {vehicle.modelo ? ` · ${vehicle.modelo}` : ''}
                            </td>
                            <td>
                              {Number(vehicle.capacidad_kg).toLocaleString(
                                'es-CO',
                              )}{' '}
                              kg
                            </td>
                            <td>
                              <Badge>
                                {vehicle.estado_vehiculo || 'Sin estado'}
                              </Badge>
                            </td>
                            <td>
                              {data.fleet?.vehiculos?.find(
                                (item) => item.placa === vehicle.placa,
                              )?.estado_gps || 'Sin reporte'}
                            </td>
                            <td>
                              <button
                                className="coord-icon-button"
                                aria-label={`Consultar ${vehicle.placa}`}
                                onClick={() =>
                                  navigate(
                                    vehicle.estado_vehiculo === 'en camino'
                                      ? 'tracking'
                                      : 'vehicleAssignment',
                                  )
                                }
                              >
                                <Icon name="file" size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className="coord-pagination">
                  <span>{data.vehicles.length} vehículos registrados</span>
                </div>
              </section>
            </>
          )}
          {current === 'drivers' && (
            <>
              <Heading
                title="Conductores"
                subtitle="Consulta los conductores habilitados para asignación."
              >
                <span className="coord-permission">
                  Registro y edición: registrador
                </span>
              </Heading>
              {searchBar('Buscar conductor…')}
              {filtersOpen && (
                <div className="coord-filter-tabs">
                  {['Todas', 'Perfil completo', 'Perfil incompleto'].map(
                    (status) => (
                      <button
                        key={status}
                        aria-pressed={filter === status}
                        className={filter === status ? 'active' : ''}
                        onClick={() => setFilter(status)}
                      >
                        {status}
                      </button>
                    ),
                  )}
                </div>
              )}
              <section className="coord-card">
                <div className="coord-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          'Nombre',
                          'Licencia',
                          'Documentación',
                          'Acciones',
                        ].map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.drivers
                        .filter(
                          (item) =>
                            item.nombre_conductor
                              .toLowerCase()
                              .includes(search.toLowerCase()) &&
                            (filter === 'Todas' ||
                              (filter === 'Perfil completo'
                                ? item.tiene_foto_licencia
                                : !item.tiene_foto_licencia)),
                        )
                        .map((item, index) => (
                          <tr key={item.id_conductor || index}>
                            <td>
                              <div className="coord-driver-name">
                                <span className="coord-avatar">
                                  {item.foto_perfil ? <img src={item.foto_perfil} alt={`Foto de ${item.nombre_conductor}`}/> : <Icon name="user" size={22} />}
                                </span>
                                <strong>{item.nombre_conductor}</strong>
                              </div>
                            </td>
                            <td>{item.licencia || 'No registrada'}</td>
                            <td>
                              <Badge>
                                {item.id_conductor && item.tiene_foto_licencia
                                  ? 'Perfil completo'
                                  : 'Perfil incompleto'}
                              </Badge>
                            </td>
                            <td>
                              <button
                                className="coord-icon-button"
                                aria-label={`Asignar a ${item.nombre_conductor}`}
                                disabled={
                                  !item.id_conductor ||
                                  !item.tiene_foto_licencia
                                }
                                onClick={() => navigate('vehicleAssignment')}
                              >
                                <Icon name="clipboard" size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {current === 'profile' && (
            <>
              <Heading
                title="Mi cuenta"
                subtitle="Personaliza tu cuenta y las preferencias de este navegador."
              />
              <div className="coord-detail-grid">
                <section className="coord-card">
                  <h2>Información personal</h2>
                  <div className="coord-person">
                    <span className="coord-avatar large">
                      <Icon name="user" size={55} />
                    </span>
                    <dl>
                      {[
                        ['Nombre', fullName],
                        [
                          'Correo',
                          user.correo ||
                            user.correo_electronico ||
                            'No registrado',
                        ],
                        ['Cargo', 'Coordinador'],
                      ].map(([key, value]) => (
                        <React.Fragment key={key}>
                          <dt>{key}</dt>
                          <dd>{value}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  </div>
                  <p>
                    Para cambiar los datos registrados, solicita la
                    actualización al registrador.
                  </p>
                  <button className="coord-button secondary" onClick={onLogout}>
                    Cerrar sesión
                  </button>
                </section>
                <section className="coord-card">
                  <h2>Preferencias</h2>
                  <label className="coord-setting">
                    Idioma{' '}
                    <select aria-label="Idioma" disabled value="es">
                      <option value="es">Español</option>
                    </select>
                  </label>
                  <label className="coord-setting">
                    Zona horaria{' '}
                    <span>
                      {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </span>
                  </label>
                  <label className="coord-setting">
                    Modo oscuro{' '}
                    <input
                      type="checkbox"
                      role="switch"
                      checked={preferences.dark}
                      onChange={(event) =>
                        setPreferences({
                          ...preferences,
                          dark: event.target.checked,
                        })
                      }
                    />
                  </label>
                  <label className="coord-setting">
                    Vista compacta{' '}
                    <input
                      type="checkbox"
                      role="switch"
                      checked={preferences.compact}
                      onChange={(event) =>
                        setPreferences({
                          ...preferences,
                          compact: event.target.checked,
                        })
                      }
                    />
                  </label>
                  <button className="coord-button" onClick={savePreferences}>
                    Guardar cambios
                  </button>
                  {preferenceMessage && (
                    <p role="status">{preferenceMessage}</p>
                  )}
                </section>
              </div>
            </>
          )}
          {current === 'notifications' && (
            <>
              <Heading
                title="Notificaciones"
                subtitle="Novedades reales enviadas por los conductores."
              />
              <section className="coord-card">
                {data.notifications.map((item) => (
                  <div className="coord-notification" key={item.id_evento}>
                    <span className="coord-avatar">
                      {item.conductor_foto_perfil ? <img src={item.conductor_foto_perfil} alt={`Foto de ${item.conductor_nombre}`}/> : <Icon name="bell" />}
                    </span>
                    <div>
                      <h2>{item.tipo_evento}</h2>
                      <p>{item.descripcion_evento}</p>
                      <small>
                        {item.conductor_nombre} ·{' '}
                        {item.vehiculo_placa || 'Sin vehículo'} ·{' '}
                        {driverDate(item.fecha_hora_evento)?.toLocaleString(
                          'es-CO',
                        )}
                      </small>
                    </div>
                  </div>
                ))}
                {!data.notifications.length && (
                  <div className="coord-empty">No hay novedades recientes.</div>
                )}
                <button
                  className="coord-button secondary"
                  onClick={() => navigate('support')}
                >
                  Abrir mensajes de una carga
                </button>
              </section>
            </>
          )}
          {current === 'register' && (
            <div className="coord-module">
              {React.cloneElement(operationsScreens.deliveries, {
                initialRequestId: selected?.registered ? null : selected?.id,
              })}
            </div>
          )}
          {![
            'dashboard',
            'deliveries',
            'detail',
            'register',
            'vehicleStatus',
            'drivers',
            'profile',
            'notifications',
          ].includes(current) && (
            <div className="coord-module" key={current}>
              {current === 'vehicleAssignment'
                ? React.cloneElement(operationsScreens.vehicleAssignment, {
                    initialDeliveryId: selected?.registered
                      ? selected.id
                      : null,
                  })
                : operationsScreens[current] || operationsScreens.dashboard}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
