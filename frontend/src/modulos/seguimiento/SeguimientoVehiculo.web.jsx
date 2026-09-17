import { estilosOperativos } from '../panel/estilosOperativos';
import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import TrackingMap from '../../componentes/mapas/MapaSeguimiento';
import DriverEventReporter from '../../componentes/entregas/ReportadorNovedadConductor';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import usePolling from '../../ganchos/usarSondeo';
import useTrackingPosition from '../../ganchos/usarPosicionSeguimiento';
import {
  applyTrackingMessage,
  connectTrackingSocket,
} from '../../servicios/seguimientoTiempoReal';
import {
  canCompleteTrip,
  realtimeLabel,
} from '../../servicios/presentacionSeguimiento';
import { styles as defaultStyles } from './SeguimientoVehiculo.styles';
import { coordinatorModuleStyles } from '../coordinador/Coordinador.styles';
import {
  conductorModuleStyles,
  styles as driverStyles,
} from '../conductor/Conductor.styles';
import Icon from '../conductor/IconoConductor';
import CoordinatorIcon from '../panel/IconoRegistrador.web';
import { driverDate } from '../conductor/presentacionConductor';
import { guardarRutaEntrega } from '../../servicios/sinConexion';
import { apiErrorMessage } from '../../servicios/mensajesApi';
import {
  createGpsPoint,
  evaluateGpsPoint,
  MAX_GPS_ACCURACY_METERS,
} from '../../servicios/calidadGps';
import { createLatestRequestController } from '../../servicios/controlSolicitudes';
import VistaGpsConductor from '../conductor/VistaGpsConductor';
import MapaGpsConductor from '../conductor/MapaGpsConductor';
import useGpsGuidance from '../conductor/usarGuiaGps.web';
import {
  canAdvanceGpsInstruction,
  canConfirmDriverPickup,
} from '../conductor/presentacionGps';

const freshnessOf = (point) => {
  if (!point?.registrada_en) return 'Sin ubicación';
  return Date.now() - Date.parse(point.registrada_en) <= 90000
    ? 'Actualizada'
    : 'Desactualizada';
};

export default function SeguimientoVehiculo({
  go,
  token,
  user,
  onDriverRoute,
  onDriverAction,
  navigationVisible = true,
}) {
  const gpsControlsRef = useRef(null);
  const [localNavigationPoint, setLocalNavigationPoint] = useState(null);
  const [mapTheme, setMapTheme] = useState('day');
  const [delivery, setDelivery] = useState(null);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [message, setMessageText] = useState('');
  const [messageType, setMessageType] = useState('info');
  const setMessage = (text, type = 'error') => {
    setMessageText(text);
    setMessageType(type);
  };
  const [confirmingPickup, setConfirmingPickup] = useState(false);
  const [completingTrip, setCompletingTrip] = useState(false);
  const [navigationRoute, setNavigationRoute] = useState([]);
  const [routeSummary, setRouteSummary] = useState(null);
  const actionRef = useRef(null);
  const deliveryRef = useRef(null);
  const trackingRequestsRef = useRef(null);
  if (!trackingRequestsRef.current)
    trackingRequestsRef.current = createLatestRequestController();
  const [realtimeState, setRealtimeState] = useState('disconnected');
  const [gpsStatus, setGpsStatus] = useState('');
  const lastWebGpsRef = useRef(null);
  const gpsUploadInProgressRef = useRef(false);
  const role = String(user?.rol || '').toLowerCase();
  const styles =
    role === 'conductor'
      ? { ...defaultStyles, ...conductorModuleStyles }
      : role === 'coordinador'
        ? { ...defaultStyles, ...coordinatorModuleStyles }
        : role === 'caficultor' ? { ...defaultStyles, ...estilosOperativos } : defaultStyles;

  const selectDelivery = useCallback((id) => {
    deliveryRef.current = id;
    setDelivery(id);
  }, []);

  const loadTracking = useCallback(
    async (id) => {
      const request = trackingRequestsRef.current.start();
      try {
        const response = await fetchApi(
          `${API_BASE_URL}/entregas/${id}/seguimiento`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: request.signal,
          },
        );
        const data = await response.json();
        if (!response.ok)
          throw Error(
            apiErrorMessage(data, 'No se pudo consultar el seguimiento.'),
          );
        if (
          trackingRequestsRef.current.isCurrent(request) &&
          deliveryRef.current === id
        )
          setTracking(data);
        return trackingRequestsRef.current.isCurrent(request) ? data : null;
      } catch (error) {
        if (!trackingRequestsRef.current.isCurrent(request)) return null;
        throw error;
      }
    },
    [token],
  );

  const load = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      if (role === 'caficultor') {
        const response = await fetchApi(
          `${API_BASE_URL}/solicitudes/mis-solicitudes`,
          { headers },
        );
        const data = await response.json();
        if (!response.ok)
          throw Error(
            apiErrorMessage(
              data,
              'No se pudieron consultar tus recolecciones activas.',
            ),
          );
        const available = (data.solicitudes_activas || [])
          .filter(
            (item) => item.entrega_id && item.estado_solicitud === 'en camino',
          )
          .map((item) => ({ ...item, id_entrega: item.entrega_id }));
        if (!available.length) {
          setActiveDeliveries([]);
          selectDelivery(null);
          trackingRequestsRef.current.invalidate();
          setTracking(null);
          setMessage(
            'No hay un vehículo asignado para seguir actualmente.',
            'info',
          );
          return;
        }
        setActiveDeliveries(available);
        const selected =
          available.find((item) => item.id_entrega === deliveryRef.current) ||
          available[0];
        selectDelivery(selected.id_entrega);
        await loadTracking(selected.id_entrega);
      } else if (role === 'conductor') {
        const response = await fetchApi(`${API_BASE_URL}/viajes/mi-activo`, {
          headers,
        });
        const rows = await response.json();
        if (!response.ok) {
          if (response.status === 404) {
            setActiveTrip(null);
            selectDelivery(null);
            trackingRequestsRef.current.invalidate();
            setTracking(null);
          }
          throw Error(apiErrorMessage(rows, 'No se pudo cargar tu viaje.'));
        }
        const trip = rows[0];
        if (!trip) {
          setActiveTrip(null);
          selectDelivery(null);
          trackingRequestsRef.current.invalidate();
          setTracking(null);
          setMessage(
            'No tienes un viaje en camino. Inícialo desde Recolecciones asignadas.',
            'info',
          );
          return;
        }
        setActiveTrip(trip);
        const active =
          trip.cargas.find(
            (item) =>
              item.id_entrega === deliveryRef.current &&
              !item.carga_recogida_en,
          ) ||
          trip.cargas.find((item) => !item.carga_recogida_en) ||
          trip.cargas.at(-1);
        selectDelivery(active.id_entrega);
        await loadTracking(active.id_entrega);
      } else {
        const response = await fetchApi(
          `${API_BASE_URL}/entregas/historial?estado=en%20camino`,
          { headers },
        );
        const list = await response.json();
        if (!response.ok)
          throw Error(
            apiErrorMessage(
              list,
              'No se pudo consultar los vehículos en camino.',
            ),
          );
        if (!list.items?.length) {
          setActiveDeliveries([]);
          selectDelivery(null);
          trackingRequestsRef.current.invalidate();
          setTracking(null);
          setMessage('No hay vehículos en camino actualmente.', 'info');
          return;
        }
        setActiveDeliveries(list.items);
        const selected =
          list.items.find((item) => item.id_entrega === deliveryRef.current) ||
          list.items[0];
        selectDelivery(selected.id_entrega);
        await loadTracking(selected.id_entrega);
      }
      setMessage('', 'info');
    } catch (error) {
      setMessage(error.message);
    }
  }, [loadTracking, role, selectDelivery, token]);

  usePolling(load, 30000);

  useEffect(() => () => trackingRequestsRef.current.invalidate(), []);

  useEffect(() => {
    if (!delivery || !token) return undefined;
    return connectTrackingSocket({
      deliveryId: delivery,
      token,
      onMessage: (event) => {
        if (deliveryRef.current === delivery)
          setTracking((current) => applyTrackingMessage(current, event));
      },
      onStatus: setRealtimeState,
    });
  }, [delivery, token]);

  useEffect(() => {
    if (role !== 'conductor' || !activeTrip || !delivery) {
      lastWebGpsRef.current = null;
      gpsUploadInProgressRef.current = false;
      setGpsStatus('');
      return undefined;
    }
    if (!globalThis.isSecureContext || !navigator.geolocation) {
      setGpsStatus(
        'El GPS web requiere HTTPS o localhost. En el celular usa la aplicación Coffee Fly.',
      );
      return undefined;
    }

    let disposed = false;
    setGpsStatus('Solicitando permiso y buscando una ubicación precisa…');
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        if (disposed || gpsUploadInProgressRef.current) return;
        const point = createGpsPoint(position);
        const quality = evaluateGpsPoint(point, lastWebGpsRef.current);
        if (!quality.valid) {
          setGpsStatus(quality.reason);
          return;
        }
        if (point.precision_m <= 25)
          setLocalNavigationPoint({
            ...point,
            registrada_en: point.capturada_en,
          });
        if (!quality.shouldStore) {
          setGpsStatus(
            `GPS activo · precisión ±${Math.round(point.precision_m)} m`,
          );
          return;
        }
        gpsUploadInProgressRef.current = true;
        try {
          const response = await fetchApi(
            `${API_BASE_URL}/entregas/${delivery}/ubicacion`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(point),
            },
          );
          const result = await response.json();
          if (!response.ok)
            throw Error(
              apiErrorMessage(
                result,
                'No se pudo transmitir la ubicación GPS.',
              ),
            );
          lastWebGpsRef.current = point;
          setGpsStatus(
            `GPS transmitiendo · precisión ±${Math.round(point.precision_m)} m`,
          );
        } catch (error) {
          if (!disposed)
            setGpsStatus(
              error.message || 'No se pudo transmitir la ubicación GPS.',
            );
        } finally {
          gpsUploadInProgressRef.current = false;
        }
      },
      (error) => {
        if (disposed) return;
        if (error.code === 1)
          setGpsStatus(
            'Permite la ubicación precisa del navegador para transmitir el trayecto.',
          );
        else if (error.code === 3)
          setGpsStatus(
            'El GPS está tardando. Sal a un lugar despejado y mantén esta pestaña abierta.',
          );
        else setGpsStatus('No fue posible obtener la ubicación del navegador.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    );

    return () => {
      disposed = true;
      navigator.geolocation.clearWatch(watchId);
      lastWebGpsRef.current = null;
      gpsUploadInProgressRef.current = false;
    };
  }, [activeTrip?.id_viaje, delivery, role, token]);

  const points = tracking?.puntos || [];
  const remotePosition = useTrackingPosition(points);
  const last =
    role === 'conductor' && canAdvanceGpsInstruction(localNavigationPoint)
      ? localNavigationPoint
      : remotePosition.point;
  const guidance = useGpsGuidance({
    route: routeSummary,
    point: last,
    visible: navigationVisible,
    enabled: role === 'conductor',
  });
  const destination = useMemo(() => {
    if (tracking?.destino_latitud == null || tracking?.destino_longitud == null)
      return null;
    return {
      latitude: Number(tracking.destino_latitud),
      longitude: Number(tracking.destino_longitud),
    };
  }, [tracking?.destino_latitud, tracking?.destino_longitud]);
  const routeOriginKey = last
    ? `${Number(last.latitud).toFixed(3)}:${Number(last.longitud).toFixed(3)}`
    : '';

  useEffect(() => {
    if (!last || !destination) {
      setNavigationRoute([]);
      setRouteSummary(null);
      return undefined;
    }
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 12000);
    fetchApi(`${API_BASE_URL}/entregas/${delivery}/ruta-navegacion`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        latitud_origen: Number(last.latitud),
        longitud_origen: Number(last.longitud),
      }),
      signal: controller.signal,
      timeoutMs: 12000,
      retries: 0,
    })
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(Error('Ruta no disponible')),
      )
      .then((data) => {
        clearTimeout(timeout);
        if (!disposed && Array.isArray(data.puntos)) {
          setNavigationRoute(data.puntos);
          setRouteSummary(data);
          onDriverRoute?.({ ...data, entrega_id: delivery });
          if (
            role === 'conductor' &&
            JSON.stringify(data).length <= 1024 * 1024
          ) {
            guardarRutaEntrega(
              `${delivery}:${tracking.etapa_viaje}`,
              data,
            ).catch(() => {});
          }
        }
      })
      .catch(() => {
        if (!disposed) {
          setNavigationRoute([]);
          setRouteSummary(null);
        }
      });
    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [
    delivery,
    tracking?.etapa_viaje,
    destination?.latitude,
    destination?.longitude,
    routeOriginKey,
    token,
    role,
    onDriverRoute,
  ]);
  const allLoadsPicked = canCompleteTrip(activeTrip?.cargas);

  const currentWebPosition = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(Error('Este navegador no permite consultar la ubicación.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        resolve,
        (error) => {
          if (error.code === 1)
            reject(
              Error(
                'Permite la ubicación precisa del navegador para confirmar la carga.',
              ),
            );
          else if (error.code === 3)
            reject(
              Error(
                'El GPS tardó demasiado. Sal a un lugar despejado e inténtalo nuevamente.',
              ),
            );
          else reject(Error('No fue posible obtener tu ubicación actual.'));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });

  const registerCurrentGps = async () => {
    const position = await currentWebPosition();
    if (
      !Number.isFinite(position.coords.accuracy) ||
      position.coords.accuracy > MAX_GPS_ACCURACY_METERS
    ) {
      throw Error(
        `La precisión actual es insuficiente (${Math.round(position.coords.accuracy || 0)} m). Espera una señal menor a ${MAX_GPS_ACCURACY_METERS} m.`,
      );
    }
    const locationResponse = await fetchApi(
      `${API_BASE_URL}/entregas/${delivery}/ubicacion`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createGpsPoint(position)),
      },
    );
    const locationData = await locationResponse.json();
    if (!locationResponse.ok)
      throw Error(
        apiErrorMessage(locationData, 'No se pudo registrar tu ubicación.'),
      );
  };

  const confirmPickup = async () => {
    if (!delivery || actionRef.current) return;
    actionRef.current = 'pickup';
    setConfirmingPickup(true);
    try {
      setMessage(
        'Obteniendo una ubicación precisa para confirmar la carga…',
        'info',
      );
      await registerCurrentGps();
      const response = await fetchApi(
        `${API_BASE_URL}/entregas/${delivery}/confirmar-carga`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw Error(
          apiErrorMessage(
            data,
            'No se pudo confirmar la recogida de la carga.',
          ),
        );
      await load();
      setMessage('Carga recogida confirmada correctamente.', 'success');
    } catch (error) {
      setMessage(error.message, 'error');
    } finally {
      actionRef.current = null;
      setConfirmingPickup(false);
    }
  };

  const completeTrip = async () => {
    if (!activeTrip || !allLoadsPicked || actionRef.current) return;
    if (
      !(
        globalThis.confirm?.(
          '¿Confirmas que entregaste todas las cargas y deseas completar el viaje?',
        ) ?? false
      )
    )
      return;
    actionRef.current = 'complete';
    setCompletingTrip(true);
    try {
      setMessage('Verificando tu llegada a la cooperativa con GPS…', 'info');
      await registerCurrentGps();
      const response = await fetchApi(
        `${API_BASE_URL}/viajes/${activeTrip.id_viaje}/completar`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw Error(apiErrorMessage(data, 'No se pudo completar el viaje.'));
      setActiveTrip(null);
      setTracking(null);
      selectDelivery(null);
      trackingRequestsRef.current.invalidate();
      setMessage('Viaje completado. El vehículo quedó disponible.', 'success');
    } catch (error) {
      setMessage(error.message, 'error');
    } finally {
      actionRef.current = null;
      setCompletingTrip(false);
    }
  };

  if (role === 'conductor' && activeTrip && tracking)
    return (
      <VistaGpsConductor
        trip={activeTrip}
        deliveryId={delivery}
        tracking={tracking}
        controlsRef={gpsControlsRef}
        {...guidance}
        onVoice={guidance.toggleVoice}
        onRepeat={guidance.repeat}
        routeAvailable={navigationRoute.length > 1}
        mapTheme={mapTheme}
        onTheme={() =>
          setMapTheme((current) => (current === 'dark' ? 'day' : 'dark'))
        }
        map={
          <MapaGpsConductor
            controlsRef={gpsControlsRef}
            route={navigationRoute}
            destination={destination}
            vehicle={guidance.vehicle}
            heading={guidance.heading}
            deliveryId={`${delivery}:${tracking.etapa_viaje}`}
            mapTheme={mapTheme}
          />
        }
        onAction={onDriverAction}
        onSelectStop={(id) => {
          selectDelivery(id);
          setLocalNavigationPoint(null);
          loadTracking(id).catch((error) => setMessage(error.message));
        }}
        onExit={() => go('dashboard')}
        onFinish={
          tracking.etapa_viaje === 'hacia_cooperativa'
            ? completeTrip
            : confirmPickup
        }
        finishDisabled={tracking.etapa_viaje === 'hacia_cooperativa' ? !allLoadsPicked : !canConfirmDriverPickup(tracking,last)}
        finishBusy={confirmingPickup || completingTrip}
        gpsStatus={gpsStatus || remotePosition.status}
        message={message}
      />
    );
  if (role === 'conductor') return <View style={driverStyles.card}>
    <Icon name="route" size={40}/>
    <Text style={styles.cardTitle}>{activeTrip ? 'Preparando navegación GPS…' : 'No tienes un viaje activo'}</Text>
    <Text style={styles.muted}>{activeTrip ? 'Consultando la entrega y su destino registrado.' : 'Acepta e inicia un viaje para activar el mapa y el seguimiento GPS.'}</Text>
    {message ? <FeedbackMessage type={messageType}>{message}</FeedbackMessage> : null}
    <TouchableOpacity accessibilityRole="button" onPress={() => go('assignedDeliveries')} style={styles.primary}><Text style={styles.primaryText}>Ver entregas asignadas</Text></TouchableOpacity>
  </View>;

  if (role === 'coordinador') {
    const selected = activeDeliveries.find(
      (item) => item.id_entrega === delivery,
    );
    const pickup = !!tracking?.carga_recogida_en;
    return (
      <div>
        <div className="coord-heading">
          <div>
            <h1>Seguimiento en tiempo real</h1>
            <p>
              {realtimeLabel(realtimeState)} · recuperación automática cada 30
              segundos.
            </p>
          </div>
          <button
            className="coord-button secondary"
            onClick={() => go('monitoring')}
          >
            Ver mapa de flota
          </button>
        </div>
        {message && (
          <div
            className="coord-notice"
            role={messageType === 'error' ? 'alert' : 'status'}
          >
            {message}
          </div>
        )}
        <div className="coord-metrics">
          <div className="coord-metric blue">
            <span className="coord-metric-icon">
              <CoordinatorIcon name="truck" />
            </span>
            <div>
              <strong>{activeDeliveries.length}</strong>
              <span>Cargas activas mostradas</span>
            </div>
          </div>
          <div className="coord-metric">
            <div>
              <strong>
                {last?.precision_m != null
                  ? `±${Math.round(last.precision_m)} m`
                  : '—'}
              </strong>
              <span>Precisión de la ubicación fiable</span>
            </div>
          </div>
          <div className="coord-metric amber">
            <div>
              <strong>
                {remotePosition.stale
                  ? 'Atrasado'
                  : remotePosition.degraded
                    ? 'Impreciso'
                    : last
                      ? 'Fiable'
                      : 'Sin GPS'}
              </strong>
              <span>Estado de la señal</span>
            </div>
          </div>
          <div className="coord-metric">
            <div>
              <strong>
                {((tracking?.distancia_recorrida_m || 0) / 1000).toFixed(1)} km
              </strong>
              <span>Distancia recorrida registrada</span>
            </div>
          </div>
        </div>
        <div className="coord-filter-tabs">
          {activeDeliveries.map((item) => (
            <button
              key={item.id_entrega}
              className={delivery === item.id_entrega ? 'active' : ''}
              aria-pressed={delivery === item.id_entrega}
              onClick={() => {
                selectDelivery(item.id_entrega);
                loadTracking(item.id_entrega).catch((error) =>
                  setMessage(error.message),
                );
              }}
            >
              {item.vehiculo_placa || `CF-${item.id_entrega.slice(0, 8)}`} ·{' '}
              {item.caficultor_nombre}
            </button>
          ))}
        </div>
        {tracking ? (
          <section className="coord-card">
            <div className="coord-live-grid">
              <div>
                <TrackingMap
                  deliveryId={delivery}
                  destination={destination}
                  navigationRoute={navigationRoute}
                  points={points}
                  coordinatorTheme
                />
                <div className="coord-timeline">
                  <span className="done">Asignado</span>
                  <span className={pickup ? 'done' : 'current'}>
                    Hacia la finca
                  </span>
                  <span className={pickup ? 'current' : ''}>
                    Hacia cooperativa
                  </span>
                  <span>Entrega por confirmar</span>
                </div>
              </div>
              <aside>
                <h2>CF-{String(delivery).slice(0, 8)}</h2>
                <span className="coord-badge green">En transporte</span>
                <dl>
                  <dt>Vehículo</dt>
                  <dd>{tracking.vehiculo_placa}</dd>
                  <dt>Caficultor</dt>
                  <dd>{selected?.caficultor_nombre || 'No informado'}</dd>
                  <dt>Carga</dt>
                  <dd>
                    {selected?.cantidad_kg?.toLocaleString('es-CO') || '—'} kg
                  </dd>
                  <dt>Destino actual</dt>
                  <dd>{tracking.destino || 'Sin destino'}</dd>
                  <dt>Cooperativa</dt>
                  <dd>{tracking.cooperativa_nombre || 'No informada'}</dd>
                  <dt>Último GPS fiable</dt>
                  <dd>
                    {last
                      ? driverDate(last.registrada_en)?.toLocaleString('es-CO')
                      : 'Sin ubicación fiable'}
                  </dd>
                </dl>
                {routeSummary && (
                  <p>
                    Ruta restante estimada:{' '}
                    {(routeSummary.distancia_m / 1000).toFixed(1)} km ·{' '}
                    {Math.ceil(routeSummary.duracion_s / 60)} min. Sin tráfico
                    en vivo.
                  </p>
                )}
                <p>{remotePosition.status}</p>
                <p>
                  {points.length} de {tracking.total_puntos || points.length}{' '}
                  puntos registrados.
                  {tracking.ruta_truncada
                    ? ' Historial truncado a los puntos más recientes.'
                    : ''}
                </p>
                <button className="coord-button" onClick={() => go('support')}>
                  Mensajes de la carga
                </button>
              </aside>
            </div>
          </section>
        ) : (
          <section className="coord-card coord-empty">
            No hay un transporte con ubicación consultable.
          </section>
        )}
        <div className="coord-actions">
          <button className="coord-button secondary" onClick={load}>
            Actualizar ubicación
          </button>
        </div>
      </div>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Seguimiento de vehículo</Text>
      <Text style={styles.muted}>
        Estado: {realtimeLabel(realtimeState)}. El sistema recupera el estado
        cada 30 segundos si se interrumpe el canal en vivo.
      </Text>
      {role === 'conductor' && gpsStatus ? (
        <Text style={styles.muted}>{gpsStatus}</Text>
      ) : null}
      {message ? (
        <FeedbackMessage type={messageType}>{message}</FeedbackMessage>
      ) : null}

      {(role === 'coordinador' || role === 'caficultor') &&
      activeDeliveries.length > 1 ? (
        <View style={styles.fullCard}>
          <Text style={styles.label}>
            {role === 'caficultor'
              ? 'Carga en seguimiento'
              : 'Vehículo en seguimiento'}
          </Text>
          <View style={styles.statusActions}>
            {activeDeliveries.map((item) => (
              <TouchableOpacity
                key={item.id_entrega}
                style={[
                  styles.role,
                  delivery === item.id_entrega && styles.roleActive,
                ]}
                onPress={() => {
                  selectDelivery(item.id_entrega);
                  loadTracking(item.id_entrega).catch((error) =>
                    setMessage(error.message),
                  );
                }}
              >
                <Text>
                  {item.vehiculo_placa ||
                    `Entrega ${item.id_entrega.slice(0, 5)}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {role === 'conductor' && activeTrip ? (
        <View style={styles.fullCard}>
          <Text style={styles.cardTitle}>Cargas de este viaje</Text>
          <View style={styles.statusActions}>
            {activeTrip.cargas.map((load) => (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: delivery === load.id_entrega }}
                key={load.id_entrega}
                style={[
                  styles.role,
                  delivery === load.id_entrega && styles.roleActive,
                ]}
                onPress={() => {
                  selectDelivery(load.id_entrega);
                  loadTracking(load.id_entrega).catch((error) =>
                    setMessage(error.message),
                  );
                }}
              >
                <Text>
                  {load.orden_recoleccion}. {load.caficultor_nombre}
                  {load.carga_recogida_en ? ' ✓' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!allLoadsPicked ? (
            <Text style={styles.muted}>
              Confirma la recogida de todas las cargas antes de completar el
              viaje.
            </Text>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{
              disabled: !allLoadsPicked || completingTrip,
              busy: completingTrip,
            }}
            disabled={!allLoadsPicked || completingTrip}
            style={[
              styles.primary,
              (!allLoadsPicked || completingTrip) && styles.unavailable,
            ]}
            onPress={completeTrip}
          >
            <Text style={styles.primaryText}>
              {completingTrip ? 'Completando viaje…' : 'Completar viaje'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {role === 'conductor' && delivery ? (
        <DriverEventReporter
          deliveryId={delivery}
          token={token}
          styles={styles}
        />
      ) : null}

      {role === 'conductor' && tracking ? (
        <View style={styles.fullCard}>
          <Text style={styles.cardTitle}>Etapa del viaje</Text>
          <Text
            style={
              tracking.etapa_viaje === 'hacia_cooperativa'
                ? styles.muted
                : styles.success
            }
          >
            1. Recoger la carga en la finca
          </Text>
          <Text
            style={
              tracking.etapa_viaje === 'hacia_cooperativa'
                ? styles.success
                : styles.muted
            }
          >
            2. Llevar la carga a la cooperativa
          </Text>
          <Text>
            Destino actual: {tracking.destino || 'Sin ubicación registrada'}
          </Text>
          {tracking.carga_recogida_en ? (
            <Text style={styles.success}>
              Carga recogida:{' '}
              {new Date(tracking.carga_recogida_en).toLocaleString()}
            </Text>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{
                disabled: confirmingPickup,
                busy: confirmingPickup,
              }}
              disabled={confirmingPickup}
              style={[styles.primary, confirmingPickup && styles.unavailable]}
              onPress={confirmPickup}
            >
              <Text style={styles.primaryText}>
                {confirmingPickup
                  ? 'Verificando ubicación…'
                  : 'Confirmar carga con GPS'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {tracking ? (
        <View style={styles.fullCard}>
          <Text style={styles.cardTitle}>
            {tracking.vehiculo_placa} · {tracking.estado_entrega}
          </Text>
          {tracking.destino ? <Text>Destino: {tracking.destino}</Text> : null}
          <Text>
            Ruta visible: {points.length} de{' '}
            {tracking.total_puntos || points.length} punto(s)
          </Text>
          <Text>Estado de ubicación: {remotePosition.status}</Text>
          <Text>
            Distancia recorrida:{' '}
            {((tracking.distancia_recorrida_m || 0) / 1000).toFixed(2)} km
          </Text>
          {tracking.ruta_truncada ? (
            <Text style={styles.muted}>
              Se muestran los 2.000 puntos más recientes para conservar el
              rendimiento.
            </Text>
          ) : null}
          {last ? (
            <Text>
              Última ubicación fiable: {Number(last.latitud).toFixed(6)},{' '}
              {Number(last.longitud).toFixed(6)} ·{' '}
              {new Date(last.registrada_en).toLocaleString()}
              {last.precision_m != null
                ? ` · precisión ${Math.round(last.precision_m)} m`
                : ''}
              {last.velocidad_m_s != null
                ? ` · ${(last.velocidad_m_s * 3.6).toFixed(1)} km/h`
                : ''}
              {last.rumbo_grados != null
                ? ` · rumbo ${Math.round(last.rumbo_grados)}°`
                : ''}
            </Text>
          ) : (
            <Text style={styles.muted}>
              Esperando ubicación GPS del conductor.
            </Text>
          )}

          <TrackingMap
            deliveryId={delivery}
            destination={destination}
            navigationRoute={navigationRoute}
            points={points}
            coordinatorTheme={role === 'coordinador'}
          />
        </View>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        style={styles.primary}
        onPress={load}
      >
        <Text style={styles.primaryText}>Actualizar ubicación</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
