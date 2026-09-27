import BannerCafe from '../../componentes/comunes/BannerCafe';
import FotoConductor from '../../componentes/comunes/FotoConductor';
import { cloneElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFonts } from 'expo-font';
import * as Crypto from 'expo-crypto';
import { seleccionarEvidenciaImagen } from '../../servicios/evidenciaImagen';
import Icon from './IconoConductor';
import MarcoOperativo from '../panel/MarcoOperativo';
import useDriverSummary from './usarResumenConductor';
import { readDriverValue, writeDriverValue } from './almacenConductor';
import { styles as s } from './Conductor.styles';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import { enviarOSolicitarEnCola, guardarRutaEntrega, obtenerRutaEntrega } from '../../servicios/sinConexion';
import { attachOfflineMapPackage } from '../../servicios/paqueteNavegacionOffline';
import {
  obtenerEstadoMapaSinConexion,
  prepararMapaSinConexion,
} from '../../servicios/mapaSinConexion';
import { driverDate, driverQuickActions, driverTodayMetrics } from './presentacionConductor';
import MapaAbierto from '../../componentes/mapas/MapaAbierto';
import useTrackingPosition from '../../ganchos/usarPosicionSeguimiento';
import { ConductorThemeContext } from './ConductorTheme';

const logo = require('../../assets/brand/logo.png');
const landscape = require('../../assets/brand/coffee-landscape.jpg');
const checks = [
  ['Niveles de aceite', 'Motor, dirección y otros fluidos', 'aceite'],
  ['Llantas', 'Presión y estado general', 'llantas'],
  ['Frenos', 'Funcionamiento correcto', 'frenos'],
  ['Luces', 'Altas, bajas, direccionales', 'luces'],
  ['Documentos', 'SOAT, revisión técnico-mecánica, licencia', 'documentos'],
  ['Equipo de seguridad', 'Botiquín, extintor, triángulos, chaleco', 'seguridad'],
];
const emptyChecklist = () => checks.map(([, , codigo]) => ({
  codigo, estado: 'pendiente', observacion: '', foto_evidencia: null,
}));
const reportTypes = [
  ['Vía cerrada', 'Cierre total o restricción', 'road', 'inconveniente'],
  ['Derrumbe', 'Material o caída sobre la vía', 'warning', 'inconveniente'],
  ['Accidente', 'Siniestro en vía', 'warning', 'inconveniente'],
  ['Vehículo averiado', 'Problema mecánico', 'tools', 'daño vehicular'],
  ['Retraso', 'Demora en ruta', 'clock', 'retraso'],
  ['Problema con carga', 'Daño, pérdida o desplazamiento', 'box', 'inconveniente'],
  ['Otro', 'Especifica la novedad', 'bell', 'imprevisto nuevo'],
];
const tabs = [
  ['dashboard', 'Inicio', 'home'],
  ['tracking', 'Ruta', 'route'],
  ['assignedDeliveries', 'Entregas', 'box'],
  ['events', 'Novedades', 'bell'],
  ['profile', 'Perfil', 'user'],
];

function Label({ children, style, bold, ...props }) {
  const dark = useContext(ConductorThemeContext);
  return (
    <Text {...props} style={[s.font, bold && s.bold, style, dark && s.darkFont]}>
      {children}
    </Text>
  );
}
function Badge({ children, pending = false }) {
  const dark = useContext(ConductorThemeContext);
  return (
    <View style={[s.badge, pending && { backgroundColor: '#fff0c7' }, dark && s.darkBadge]}>
      <View style={[s.dot, pending && { backgroundColor: '#e8a611' }]} />
      <Label style={s.badgeText}>{children}</Label>
    </View>
  );
}
function Button({
  children,
  icon,
  onPress,
  secondary = false,
  disabled = false,
}) {
  const dark = useContext(ConductorThemeContext);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={[
        secondary ? s.whiteButton : s.greenButton,
        secondary && dark && s.darkButton,
        disabled && { opacity: 0.5 },
      ]}
    >
      {icon && (
          <Icon name={icon} size={20} color={secondary && !dark ? '#124f37' : '#fff'} />
      )}
      <Label bold style={secondary && !dark ? { color: '#124f37' } : s.buttonText}>
        {children}
      </Label>
    </TouchableOpacity>
  );
}
function Fact({ icon, title, children }) {
  return (
    <View style={[s.row, { alignItems: 'flex-start' }]}>
      <Icon name={icon} size={20} />
      <View style={{ flex: 1 }}>
        <Label bold style={{ fontSize: 13 }}>
          {title}
        </Label>
        <Label style={s.muted}>{children || 'No registrado'}</Label>
      </View>
    </View>
  );
}
function RouteStrip({ trip }) {
  const names =
    trip?.cargas
      ?.filter((item) => !item.carga_recogida_en)
      .map((item) => item.caficultor_nombre) || [];
  const stops = [
    ...names.slice(0, 2),
    trip?.cooperativa_nombre || 'Cooperativa',
  ];
  return (
    <View
      style={{
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}
    >
      {stops.map((name, index) => (
        <View
          key={`${name}:${index}`}
          style={{ flex: 1, alignItems: 'center' }}
        >
          {index < stops.length - 1 && (
            <View
              style={{
                position: 'absolute',
                height: 3,
                top: 10,
                backgroundColor: '#59bd7f',
                left: '50%',
                width: '100%',
              }}
            />
          )}
          <View
            style={{
              width: 21,
              height: 21,
              borderRadius: 13,
              borderWidth: 3,
              borderColor: '#fffef9',
              backgroundColor:
                index === stops.length - 1 ? '#b53c3d' : '#124f37',
            }}
          />
          <Label
            bold
            numberOfLines={2}
            style={{
              fontSize: 12,
              textAlign: 'center',
              paddingHorizontal: 4,
              marginTop: 5,
            }}
          >
            {name}
          </Label>
          <Label style={{ fontSize: 10, color: '#78818a' }}>
            {index === stops.length - 1
              ? 'Destino'
              : index === 0
                ? 'Recogida'
                : 'Parada'}
          </Label>
        </View>
      ))}
    </View>
  );
}

export default function ConductorLayout({
  user,
  token,
  screen,
  go,
  onLogout,
  connectionStatus,
  notice,
  trackingScreen,
  assignedScreen,
  supportScreen,
  darkMode = false,
  onToggleDarkMode,
}) {
  const { width } = useWindowDimensions();
  const [fontsLoaded, fontError] = useFonts({
    DriverRegular: require('../../assets/fonts/RobotoCondensed-Regular.ttf'),
    DriverBold: require('../../assets/fonts/RobotoCondensed-Bold.ttf'),
  });
  const summary = useDriverSummary(token, user.id || user.id_usuario);
  const [localPage, setLocalPage] = useState(null);
  const [filter, setFilter] = useState('Todas');
  const [selected, setSelected] = useState(null);
  const [detailTracking, setDetailTracking] = useState(null);
  const [profileTab, setProfileTab] = useState('Historial de viajes');
  const [checklist, setChecklist] = useState(emptyChecklist);
  const [checkReady, setCheckReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  const [inspectionSaving, setInspectionSaving] = useState(false);
  const [driverProfile, setDriverProfile] = useState(user);
  const [savedRoute, setSavedRoute] = useState(null);
  const [offlineMapState, setOfflineMapState] = useState({ disponible: false, listo: false, progreso: 0 });
  const [offlineMapBusy, setOfflineMapBusy] = useState(false);
  const [reportType, setReportType] = useState(null);
  const [comment, setComment] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [reportSaving, setReportSaving] = useState(false);
  const reportBusy = useRef(false);
  const [trackingStarted, setTrackingStarted] = useState(screen === 'tracking');
  const [navigationMode, setNavigationMode] = useState(false);
  const preferenceKey = `coffee-fly:conductor:prefs:${user.id || user.id_usuario}`;
  const [preferences, setPreferences] = useState({ dark: false, compact: false });
  const [preferenceMessage, setPreferenceMessage] = useState('');
  useEffect(() => {
    let active = true;
    readDriverValue(preferenceKey).then((value) => {
      if (!active || !value) return;
      try { setPreferences((current) => ({ ...current, ...JSON.parse(value) })); } catch { /* Preferencias dañadas: se usan las predeterminadas. */ }
    }).catch(() => {});
    return () => { active = false; };
  }, [preferenceKey]);
  const savePreferences = async () => {
    try { await writeDriverValue(preferenceKey, JSON.stringify(preferences)); setPreferenceMessage('Preferencias guardadas en este dispositivo.'); }
    catch { setPreferenceMessage('No fue posible guardar las preferencias.'); }
  };
  const page = localPage || screen;
  const trip = summary.active;
  const inspectionTrip = trip || summary.trips[0] || null;
  const checkedCount = checklist.filter((item) => item.estado !== 'pendiente').length;
  const overviewPosition = useTrackingPosition(summary.tracking?.puntos || []);
  const overviewDestination =
    summary.tracking?.destino_latitud != null &&
    summary.tracking?.destino_longitud != null
      ? {
          latitude: Number(summary.tracking.destino_latitud),
          longitude: Number(summary.tracking.destino_longitud),
        }
      : null;
  const overviewMarkers = [
    overviewPosition.point
      ? {
          id: 'vehicle',
          kind: 'vehicle',
          coordinate: {
            latitude: Number(overviewPosition.point.latitud),
            longitude: Number(overviewPosition.point.longitud),
          },
          color: '#155eef',
          title: 'Conductor',
        }
      : null,
    overviewDestination
      ? {
          id: 'destination',
          coordinate: overviewDestination,
          color: '#ba3946',
          title: summary.tracking.destino || 'Destino',
        }
      : null,
  ].filter(Boolean);
  const delivery =
    trip?.cargas?.find((item) => !item.carga_recogida_en) ||
    trip?.cargas?.at(-1);
  const offlineRouteKey = delivery && summary.tracking?.etapa_viaje
    ? `${delivery.id_entrega}:${summary.tracking.etapa_viaje}`
    : null;
  const receiveDriverRoute = useCallback(
    (route) => {
      if (
        route.entrega_id === delivery?.id_entrega &&
        route.etapa === summary.tracking?.etapa_viaje
      )
        setSavedRoute(route);
    },
    [delivery?.id_entrega, summary.tracking?.etapa_viaje],
  );
  const checklistKey = `coffee-fly:checklist:${user.id || user.id_usuario}:${trip?.vehiculo_id || summary.trips[0]?.vehiculo_id || 'sin-vehiculo'}:${new Date().toLocaleDateString('sv-SE')}`;
  useEffect(() => {
    setLocalPage(null);
    if (screen === 'tracking') setTrackingStarted(true);
  }, [screen]);
  useEffect(() => {
    const controller = new AbortController();
    setDetailTracking(null);
    if (selected)
      fetchApi(`${API_BASE_URL}/entregas/${selected.id_entrega}/seguimiento`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
        .then(async (response) => {
          if (response.ok) {
            const value = await response.json();
            if (!controller.signal.aborted) setDetailTracking(value);
          }
        })
        .catch(() => {});
    return () => controller.abort();
  }, [selected?.id_entrega, token]);
  useEffect(() => {
    let disposed = false;
    setCheckReady(false);
    setChecklist(emptyChecklist());
    readDriverValue(checklistKey)
      .then((value) => {
        if (disposed) return;
        const parsed = value ? JSON.parse(value) : [];
        if (!Array.isArray(parsed)) return setChecklist(emptyChecklist());
        if (parsed.every(Number.isInteger)) {
          const legacy = new Set(parsed);
          setChecklist(emptyChecklist().map((item, index) => ({
            ...item, estado: legacy.has(index) ? 'bien' : 'pendiente',
          })));
          return;
        }
        const byCode = new Map(parsed.map((item) => [item?.codigo, item]));
        setChecklist(emptyChecklist().map((item) => {
          const stored = byCode.get(item.codigo);
          return stored && ['bien', 'novedad'].includes(stored.estado)
            ? { ...item, ...stored }
            : item;
        }));
      })
      .catch(() => {
        if (!disposed)
          setStorageMessage('No se pudo recuperar la revisión guardada.');
      })
      .finally(() => {
        if (!disposed) setCheckReady(true);
      });
    return () => {
      disposed = true;
    };
  }, [checklistKey]);
  useEffect(() => {
    let disposed = false;
    fetchApi(`${API_BASE_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw Error(data.detail || 'No se pudo consultar el perfil.');
        if (!disposed) setDriverProfile((current) => ({ ...current, ...data }));
      })
      .catch(() => {})
    return () => { disposed = true; };
  }, [token]);
  useEffect(() => {
    let disposed = false;
    setSavedRoute(null);
    if (
      ['dashboard', 'tracking'].includes(page) &&
      delivery &&
      summary.tracking?.etapa_viaje
    ) {
      obtenerRutaEntrega(
        `${delivery.id_entrega}:${summary.tracking.etapa_viaje}`,
      )
        .then((value) => {
          if (!disposed && value) setSavedRoute((current) => current || value);
        })
        .catch(() => {
          if (!disposed)
            setStorageMessage('No fue posible consultar la ruta guardada.');
        });
    }
    return () => {
      disposed = true;
    };
  }, [page, delivery?.id_entrega, summary.tracking?.etapa_viaje]);
  useEffect(() => {
    let disposed = false;
    setOfflineMapState({ disponible: false, listo: false, progreso: 0 });
    if (!offlineRouteKey) return undefined;
    obtenerEstadoMapaSinConexion(offlineRouteKey, savedRoute?.puntos)
      .then((state) => { if (!disposed) setOfflineMapState(state); })
      .catch((error) => { if (!disposed) setOfflineMapState({ disponible: false, listo: false, progreso: 0, motivo: error.message }); });
    return () => { disposed = true; };
  }, [offlineRouteKey, savedRoute?.puntos]);
  const navigate = (target) => {
    setNavigationMode(false);
    setSelected(null);
    if (
      ['events', 'profile', 'checklist', 'support', 'settings'].includes(target)
    )
      setLocalPage(target);
    else {
      setLocalPage(null);
      go(target);
      if (target === 'tracking') setTrackingStarted(true);
    }
  };
  const updateCheck = async (index, changes) => {
    const next = checklist.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item);
    setChecklist(next);
    try {
      await writeDriverValue(checklistKey, JSON.stringify(next));
      setStorageMessage('');
    } catch {
      setStorageMessage(
        'La revisión se conserva en esta pantalla, pero no pudo guardarse en el dispositivo.',
      );
    }
  };
  const attachCheckPhoto = async (index, camera) => {
    try {
      const photo = await seleccionarEvidenciaImagen({ camara: camera });
      if (photo) await updateCheck(index, { foto_evidencia: photo, estado: 'novedad' });
    } catch (error) {
      setStorageMessage(error.message);
    }
  };
  const submitInspection = async () => {
    if (inspectionSaving) return;
    if (!inspectionTrip?.id_viaje || !inspectionTrip?.vehiculo_id) {
      setStorageMessage('Necesitas un viaje y vehículo asignados para enviar la inspección.');
      return;
    }
    if (checkedCount !== checks.length) {
      setStorageMessage('Revisa los seis puntos antes de enviar la inspección.');
      return;
    }
    const incompleteIssue = checklist.find((item) => item.estado === 'novedad' && !item.observacion.trim() && !item.foto_evidencia);
    if (incompleteIssue) {
      setStorageMessage('Cada novedad necesita una descripción o una fotografía.');
      return;
    }
    setInspectionSaving(true);
    try {
      const result = await enviarOSolicitarEnCola('inspeccion_vehiculo', {
        client_inspection_id: Crypto.randomUUID(),
        vehiculo_id: inspectionTrip.vehiculo_id,
        viaje_id: inspectionTrip.id_viaje,
        capturada_en: new Date().toISOString(),
        items: checklist.map(({ codigo, estado, observacion, foto_evidencia }) => ({
          codigo, estado, observacion: observacion.trim(), foto_evidencia,
        })),
      }, token);
      setStorageMessage(result.offline
        ? 'Inspección guardada sin conexión. Se enviará automáticamente al recuperar Internet.'
        : checklist.some((item) => item.estado === 'novedad')
          ? 'Inspección enviada con novedades para revisión del registrador.'
          : 'Inspección preoperacional enviada: vehículo sin novedades reportadas.');
    } catch (error) {
      setStorageMessage(error.message);
    } finally {
      setInspectionSaving(false);
    }
  };
  const automaticOfflineRef = useRef(null);
  useEffect(() => {
    if (connectionStatus !== 'online' || !offlineRouteKey || !savedRoute?.puntos?.length) return;
    const points = savedRoute.puntos;
    const first = points[0];
    const last = points.at(-1);
    const attemptKey = `${offlineRouteKey}:${points.length}:${first?.latitude}:${first?.longitude}:${last?.latitude}:${last?.longitude}:${darkMode}`;
    if (automaticOfflineRef.current === attemptKey) return;
    automaticOfflineRef.current = attemptKey;
    setOfflineMapBusy(true);
    prepararMapaSinConexion({
      routeKey: offlineRouteKey,
      route: points,
      mapTheme: darkMode ? 'dark' : 'day',
      onProgress: (progress) => setOfflineMapState((current) => ({
        ...current,
        disponible: true,
        listo: false,
        progreso: progress.progreso,
        recursos: progress.recursos,
      })),
    }).then(async (state) => {
      const packagedRoute = attachOfflineMapPackage(savedRoute, state);
      await guardarRutaEntrega(offlineRouteKey, packagedRoute);
      setSavedRoute(packagedRoute);
      setOfflineMapState(state);
    }).catch((error) => {
      setOfflineMapState((current) => ({ ...current, listo: false, motivo: error.message }));
      automaticOfflineRef.current = null;
    }).finally(() => setOfflineMapBusy(false));
  }, [connectionStatus, darkMode, offlineRouteKey, savedRoute]);
  const sendReport = async () => {
    if (!delivery || !reportType || reportBusy.current) return;
    reportBusy.current = true;
    setReportSaving(true);
    setReportMessage('');
    try {
      const result = await enviarOSolicitarEnCola('evento_conductor', {
        entrega_id: delivery.id_entrega,
        tipo_evento: reportType[3],
        detalle: (reportType[0].localeCompare(reportType[3], 'es', { sensitivity: 'base' }) === 0
          ? comment.trim()
          : `${reportType[0]}${comment.trim() ? `: ${comment.trim()}` : ''}`).slice(0, 250),
        client_event_id: Crypto.randomUUID(),
        capturada_en: new Date().toISOString(),
      }, token);
      setReportMessage(result.offline
        ? 'Novedad guardada. Se enviará automáticamente cuando vuelva la conexión.'
        : 'Novedad enviada al coordinador.');
      setComment('');
      setReportType(null);
    } catch (error) {
      setReportMessage(error.message);
    } finally {
      reportBusy.current = false;
      setReportSaving(false);
    }
  };
  const currentTitle =
    {
      dashboard: 'APP CONDUCTOR',
      tracking: navigationMode ? 'Navegación GPS' : 'Ruta activa',
      assignedDeliveries: 'Entregas asignadas',
      detail: 'Detalle de entrega',
      checklist: 'Checklist del vehículo',
      events: 'Reportar novedad',
      settings: 'Preferencias',
      profile: 'Perfil e historial',
      support: 'Mensajes del viaje',
    }[page] || 'APP CONDUCTOR';
  const badge = trip ? 'En ruta' : 'Disponible';
  const contentWidth = Math.min(width - 36, 1060);
  const cards = [...(trip ? [trip] : []), ...summary.trips];
  const loads = [
    ...cards,
    ...summary.history.filter((item) => item.estado_viaje === 'completado'),
  ].flatMap((item) => item.cargas.map((load) => ({ ...load, trip: item })));
  const visibleLoads = loads.filter(
    (load) =>
      filter === 'Todas' ||
      (filter === 'Pendientes' &&
        ['asignado', 'en_cola'].includes(load.trip.estado_viaje)) ||
      (filter === 'En curso' && load.trip.estado_viaje === 'en_camino') ||
      (filter === 'Completadas' && load.trip.estado_viaje === 'completado'),
  );
  const today = driverTodayMetrics(
    trip
      ? {
          ...trip,
          distancia_recorrida_m:
            summary.tracking?.distancia_recorrida_m ??
            trip.distancia_recorrida_m,
        }
      : null,
    summary.history,
  );
  const metrics = [
    [summary.loading ? '—' : today.trips, 'Viajes de hoy', 'road'],
    [summary.loading ? '—' : today.deliveries, 'Entregas completadas', 'box'],
    [
      summary.loading ? '—' : `${today.km.toFixed(1)} km`,
      'Kilómetros recorridos',
      'route',
    ],
  ];
  if (!fontsLoaded && !fontError)
    return (
      <View style={s.root}>
        <Label style={{ padding: 20 }}>Preparando panel del conductor…</Label>
      </View>
    );
  return (
    <ConductorThemeContext.Provider value={darkMode}>
    <MarcoOperativo user={user} role="Conductor" dark={darkMode} menu={[
      ['home','Inicio','dashboard'], ['pin','Ruta activa','tracking'], ['truck','Entregas','assignedDeliveries'],
      ['clipboard','Checklist del vehículo','checklist'], ['bell','Novedades','events'], ['people','Servicio al cliente','support'],
      ['user','Perfil e historial','profile'], ['gear','Preferencias','settings'],
    ]} active={page === 'detail' ? 'assignedDeliveries' : page} go={navigate} onLogout={onLogout} connectionStatus={connectionStatus} immersive={page === 'tracking' && navigationMode}>
    <View style={[s.root, darkMode && s.darkRoot]}>
      {Platform.OS !== 'web' && !(page === 'tracking' && navigationMode) && (
        <View style={[s.top, darkMode && s.darkTop]}>
          {page === 'dashboard' ? (
            <Image source={logo} resizeMode="contain" style={{ width: 44, height: 44 }} accessibilityLabel="Coffee Fly"/>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Volver al inicio"
              onPress={() => navigate('dashboard')}
              style={{ padding: 5 }}
            >
              <Icon name="back" size={22} color={darkMode ? '#edf6ef' : '#111c2c'} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Label bold numberOfLines={2} style={[s.topTitle, width < 600 && { fontSize: 18 }]}>
              {currentTitle}
            </Label>
            <Label style={{ fontSize: 11, color: connectionStatus === 'online' ? '#075441' : '#9b5c17', fontWeight: '700' }}>
              {connectionStatus === 'online' ? '● En línea' : connectionStatus === 'checking' ? 'Comprobando conexión' : '● Sin conexión · modo automático'}
            </Label>
            {page === 'dashboard' && width >= 400 && (
              <Label style={{ fontSize: 10, letterSpacing: 1.4 }}>
                RUTAS QUE LLEVAN UN MEJOR CAFÉ
              </Label>
            )}
          </View>
          <Badge>{badge}</Badge>
        </View>
      )}
      {notice && (
        <View style={s.alert}>
          <Label accessibilityLiveRegion="polite">{notice}</Label>
        </View>
      )}
      {summary.error && (
        <View style={s.alert}>
          <Label accessibilityLiveRegion="polite">{summary.error}</Label>
          <TouchableOpacity
            onPress={summary.refresh}
            accessibilityRole="button"
          >
            <Label bold>Reintentar</Label>
          </TouchableOpacity>
        </View>
      )}
      {/* Se mantiene una sola instancia para no interrumpir el GPS al consultar otra pestaña. */}
      {trackingStarted && (
        <View
          style={[
            s.module,
            (page !== 'tracking' || !navigationMode) && { display: 'none' },
          ]}
        >
          {cloneElement(trackingScreen, {
            onDriverRoute: receiveDriverRoute,
            navigationVisible: page === 'tracking' && navigationMode,
            onDriverAction: (target, deliveryId) => {
              if (target === 'overview') {
                setNavigationMode(false);
                return;
              }
              if (target === 'delivery') {
                const load = loads.find(
                  (item) => item.id_entrega === deliveryId,
                );
                if (load) {
                  setSelected(load);
                  setLocalPage('detail');
                  setNavigationMode(false);
                }
                return;
              }
              navigate(target);
            },
          })}
        </View>
      )}
      {(page !== 'tracking' || !navigationMode) && (
        <ScrollView style={s.module} contentContainerStyle={s.content}>
          {page === 'support' && supportScreen}
          {page === 'tracking' && (
            <>
              <View style={[s.card, darkMode && s.darkCard]}>
                <View style={s.row}>
                  <View style={[s.iconTile, { backgroundColor: '#124f37' }]}>
                    <Icon name="route" color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label bold>
                      {summary.tracking?.destino ||
                        trip?.cooperativa_nombre ||
                        'Sin viaje activo'}
                    </Label>
                    <Label style={s.muted}>
                      {trip
                        ? `Ruta #${String(trip.id_viaje).slice(0, 8)} · ${trip.vehiculo_placa}`
                        : 'Acepta un viaje para comenzar tu recorrido'}
                    </Label>
                  </View>
                </View>
              </View>
              {trip ? (
                <View
                  style={[s.card, { padding: 5 }, darkMode ? s.darkCard : { backgroundColor: '#e4efdf' }]}
                >
                  <View style={s.map}>
                    <MapaAbierto
                      style={{ flex: 1 }}
                      markers={overviewMarkers}
                      route={savedRoute?.puntos || []}
                      routeColor="#159447"
                      camera={{
                        fitMode:
                          savedRoute?.puntos?.length > 1 ? 'route' : 'markers',
                        fitKey: `${delivery?.id_entrega}:${summary.tracking?.etapa_viaje}:${Boolean(savedRoute)}`,
                        padding: 40,
                        maxZoom: 16,
                      }}
                    />
                  </View>
                  <View
                    style={[
                      s.spread,
                      {
                        backgroundColor: '#fffef9',
                        borderRadius: 8,
                        padding: 12,
                        flexWrap: 'wrap',
                      },
                    ]}
                  >
                    <Fact
                      icon="clock"
                      title={
                        savedRoute
                          ? new Date(
                              Date.now() +
                                Number(savedRoute.duracion_s || 0) * 1000,
                            ).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'
                      }
                    >
                      Llegada estimada
                    </Fact>
                    <Fact
                      icon="road"
                      title={
                        savedRoute
                          ? `${(Number(savedRoute.distancia_m || 0) / 1000).toFixed(1)} km`
                          : '—'
                      }
                    >
                      Distancia de ruta
                    </Fact>
                    <Button icon="play" onPress={() => setNavigationMode(true)}>
                      Iniciar navegación
                    </Button>
                  </View>
                </View>
              ) : (
                <Button
                  icon="box"
                  onPress={() => navigate('assignedDeliveries')}
                >
                  Ver entregas asignadas
                </Button>
              )}
              {trip && (
                <Label style={s.muted}>
                  {overviewPosition.status} · La hora estimada no incluye
                  tráfico en vivo.
                </Label>
              )}
            </>
          )}
          {page === 'dashboard' && (
            <>
              <BannerCafe compact eyebrow="CONDUCTOR · COFFEE FLY" title={`Hola, ${user.nombre || user.nombre_usuario || 'conductor'}`} subtitle="Cada ruta conecta personas, cosechas y destinos."/>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <FotoConductor foto={user.foto_perfil} nombre={[user.nombre || user.nombre_usuario, user.apellido].filter(Boolean).join(' ')} size={42} />
                <View><Label bold>{[user.nombre || user.nombre_usuario, user.apellido].filter(Boolean).join(' ')}</Label><Label style={s.muted}>Conductor</Label></View>
              </View>
              {inspectionTrip && <View style={[s.offlineStatus, darkMode && s.darkCard]}>
                <Icon name={offlineMapState.listo ? 'check' : offlineMapBusy ? 'layers' : 'wifi'} size={20} color={offlineMapState.listo ? '#16834c' : '#b26a11'} />
                <View style={{ flex: 1 }}>
                  <Label bold>Modo sin conexión automático</Label>
                  <Label style={s.muted}>{offlineMapState.listo
                    ? 'Ruta, maniobras y mapa regional listos en este dispositivo.'
                    : offlineMapBusy
                      ? `Preparando el mapa del viaje · ${offlineMapState.progreso || 0} %`
                      : connectionStatus === 'online'
                        ? 'Se preparará automáticamente al calcular la ruta.'
                        : 'La app conserva los datos ya guardados y sincronizará al volver Internet.'}</Label>
                </View>
              </View>}
              <View style={s.metricRow}>
                {metrics.map(([value, name, icon]) => (
                  <View
                    key={name}
                    style={[
                      s.metric,
                      darkMode && s.darkCard,
                      {
                        flexDirection: width >= 650 ? 'row' : 'column',
                        alignItems: width >= 650 ? 'center' : 'flex-start',
                        gap: 10,
                      },
                    ]}
                  >
                    <View style={s.iconTile}>
                      <Icon name={icon} size={22} />
                    </View>
                    <View style={{ flexShrink: 1 }}>
                      <Label
                        numberOfLines={1}
                        style={[s.metricValue, width < 650 && { fontSize: 21 }]}
                      >
                        {value}
                      </Label>
                      <Label style={{ fontSize: width < 650 ? 11 : 12 }}>
                        {name}
                      </Label>
                    </View>
                  </View>
                ))}
              </View>
              <View style={[s.card, darkMode && s.darkCard]}>
                <View style={s.spread}>
                  <View style={s.row}>
                    <View style={[s.iconTile, { backgroundColor: '#124f37' }]}>
                      <Icon name="route" color="#fff" />
                    </View>
                    <View>
                      <Label bold>Ruta activa</Label>
                      <Label style={s.muted}>
                        {trip?.cooperativa_nombre ||
                          'Esperando tu próximo viaje'}
                      </Label>
                    </View>
                  </View>
                  {trip && <Badge>En ejecución</Badge>}
                </View>
                {trip ? (
                  <>
                    <RouteStrip trip={trip} />
                    <View style={s.spread}>
                      <Fact icon="clock" title="Destino actual">
                        {summary.tracking?.destino || 'Obteniendo destino…'}
                      </Fact>
                      <Button onPress={() => navigate('tracking')} icon="arrow">
                        Ver en mapa
                      </Button>
                    </View>
                  </>
                ) : (
                  <>
                    <Label style={s.muted}>
                      Las rutas aparecerán cuando el coordinador asigne un
                      viaje.
                    </Label>
                    <Button
                      onPress={() => navigate('assignedDeliveries')}
                      icon="box"
                    >
                      Ver entregas
                    </Button>
                  </>
                )}
              </View>
              <View style={s.quickGrid}>
                {driverQuickActions(Boolean(trip)).map(([title, sub, icon, target], index) => (
                  <TouchableOpacity
                    key={title}
                    accessibilityRole="button"
                    accessibilityLabel={`${title}. ${sub}`}
                    onPress={() => navigate(target)}
                    style={[
                      s.quick,
                      width >= 650 && { flexBasis: '22%' },
                      index === 0 && { backgroundColor: '#124f37' },
                    ]}
                  >
                    <Icon
                      name={icon}
                      color={index ? '#124f37' : '#fff'}
                      size={27}
                    />
                    <View style={{ flex: 1 }}>
                      <Label bold style={{ color: index ? '#111c2c' : '#fff' }}>
                        {title}
                      </Label>
                      <Label
                        style={{
                          color: index ? '#78818a' : '#dcead7',
                          fontSize: 12,
                        }}
                      >
                        {sub}
                      </Label>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          {page === 'assignedDeliveries' && (
            <>
              <View style={[s.row, { flexWrap: 'wrap' }]}>
                {['Todas', 'Pendientes', 'En curso', 'Completadas'].map(
                  (name) => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      aria-selected={filter === name}
                      accessibilityState={{ selected: filter === name }}
                      key={name}
                      onPress={() => setFilter(name)}
                      style={[s.chip, darkMode && s.darkCard, filter === name && s.chipActive]}
                    >
                      <Label
                        style={[
                          s.chipText,
                          filter === name && { color: '#fff' },
                        ]}
                      >
                        {name} {name === 'Todas' ? loads.length : ''}
                      </Label>
                    </TouchableOpacity>
                  ),
                )}
              </View>
              {visibleLoads.map((load) => (
                <TouchableOpacity
                  key={load.id_entrega}
                  accessibilityRole="button"
                  onPress={() => {
                    setSelected(load);
                    setLocalPage('detail');
                  }}
                  style={[s.card, s.row, darkMode && s.darkCard]}
                >
                  <View style={s.iconTile}>
                    <Icon name="box" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label bold>{load.caficultor_nombre}</Label>
                    <Label style={s.muted}>
                      #{String(load.id_entrega).slice(0, 8)} ·{' '}
                      {load.trip.cooperativa_nombre}
                    </Label>
                    <Label style={s.muted}>
                      {load.cantidad_kg} kg · {load.trip.vehiculo_placa}
                    </Label>
                  </View>
                  <Badge
                    pending={['asignado', 'en_cola'].includes(
                      load.trip.estado_viaje,
                    )}
                  >
                    {load.trip.estado_viaje === 'completado'
                      ? 'Completada'
                      : load.carga_recogida_en
                        ? 'Recogida'
                        : load.trip.estado_viaje === 'en_camino'
                          ? 'En ruta'
                          : 'Pendiente'}
                  </Badge>
                  <Icon name="right" size={15} color="#78818a" />
                </TouchableOpacity>
              ))}
              {!visibleLoads.length && (
                <View style={[s.card, darkMode && s.darkCard]}>
                  <Icon name="box" size={38} />
                  <Label>No hay entregas en esta categoría.</Label>
                </View>
              )}
              <Label bold>Aceptar e iniciar un viaje</Label>
              {assignedScreen}
            </>
          )}
          {page === 'detail' && selected && (
            <>
              <View style={[s.card, s.spread, darkMode && s.darkCard]}>
                <View style={s.row}>
                  <View style={s.iconTile}>
                    <Icon name="box" size={28} />
                  </View>
                  <View>
                    <Label bold style={{ fontSize: 22 }}>
                      {selected.caficultor_nombre}
                    </Label>
                    <Label style={s.muted}>
                      #{String(selected.id_entrega).slice(0, 8)}
                    </Label>
                  </View>
                </View>
                <Badge pending={selected.trip.estado_viaje !== 'en_camino'}>
                  {selected.carga_recogida_en
                    ? 'Recogida'
                    : selected.trip.estado_viaje === 'en_camino'
                      ? 'En ruta'
                      : 'Pendiente'}
                </Badge>
              </View>
              <View style={[s.card, s.detailColumns, darkMode && s.darkCard]}>
                <View style={s.detailColumn}>
                  <Fact icon="pin" title="Dirección de entrega">
                    {detailTracking?.cooperativa_destino ||
                      selected.trip.cooperativa_nombre}
                  </Fact>
                  <Fact icon="pin" title="Punto de recogida">
                    {detailTracking?.recoleccion}
                  </Fact>
                  <Button
                    secondary
                    disabled={selected.trip.estado_viaje !== 'en_camino'}
                    onPress={() => navigate('tracking')}
                  >
                    Ver en mapa
                  </Button>
                  <Fact icon="user" title="Caficultor">
                    {selected.caficultor_nombre}
                  </Fact>
                  <Fact icon="truck" title="Vehículo">
                    {selected.trip.vehiculo_placa}
                  </Fact>
                </View>
                <View style={s.detailColumn}>
                  <Fact icon="box" title="Carga">
                    Café · {selected.cantidad_kg} kg
                  </Fact>
                  <Fact icon="clock" title="Asignación">
                    {driverDate(selected.trip.creado_en)?.toLocaleString()}
                  </Fact>
                  <Fact icon="document" title="Notas">
                    Recogida {selected.orden_recoleccion}. Confirma la recogida
                    en la finca y finaliza el viaje en la cooperativa con GPS.
                  </Fact>
                </View>
              </View>
              <Button
                icon="check"
                disabled={selected.trip.estado_viaje !== 'en_camino'}
                onPress={() => navigate('tracking')}
              >
                Verificar y confirmar con GPS
              </Button>
              <Button
                secondary
                icon="warning"
                onPress={() => navigate('events')}
              >
                Reportar novedad
              </Button>
            </>
          )}
          {page === 'checklist' && (
            <>
              <View style={s.spread}>
                <View style={s.row}>
                  <Icon name="truck" size={35} />
                  <View>
                    <Label bold>Checklist del vehículo</Label>
                    <Label style={s.muted}>
                      Revisa el estado del vehículo antes de iniciar tu ruta.
                    </Label>
                  </View>
                </View>
                <Badge pending={checkedCount < 6}>
                  {checkedCount}/6{' '}
                  {checkedCount === 6 ? 'Completado' : 'Por revisar'}
                </Badge>
              </View>
              <View style={[s.detailColumns, { alignItems: 'stretch' }]}>
                <View
                  style={[
                    s.card,
                    { flexGrow: 2, flexBasis: width < 600 ? '100%' : '60%' },
                  ]}
                >
                  {checks.map(([title, subtitle, code], index) => {
                    const item = checklist[index] || emptyChecklist()[index];
                    return <View
                      key={title}
                      style={[s.checklistInspectionItem, darkMode && s.darkCard]}
                    >
                      <View style={s.checklistRow}>
                        <View style={[s.checkCircle, item.estado === 'bien' && s.checkDone, item.estado === 'novedad' && s.checkIssue]}>
                          {item.estado !== 'pendiente' && <Icon name={item.estado === 'bien' ? 'check' : 'warning'} color="#fff" size={17} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Label bold>{title}</Label>
                          <Label style={s.muted}>{subtitle}</Label>
                        </View>
                      </View>
                      <View style={s.inspectionChoices}>
                        <TouchableOpacity
                          accessibilityRole="radio"
                          accessibilityState={{ selected: item.estado === 'bien', disabled: !checkReady }}
                          disabled={!checkReady}
                          onPress={() => updateCheck(index, { estado: 'bien', observacion: '', foto_evidencia: null })}
                          style={[s.inspectionChoice, item.estado === 'bien' && s.inspectionGood]}
                        ><Label bold style={item.estado === 'bien' && { color: '#fff' }}>Bien</Label></TouchableOpacity>
                        <TouchableOpacity
                          accessibilityRole="radio"
                          accessibilityState={{ selected: item.estado === 'novedad', disabled: !checkReady }}
                          disabled={!checkReady}
                          onPress={() => updateCheck(index, { estado: 'novedad' })}
                          style={[s.inspectionChoice, item.estado === 'novedad' && s.inspectionIssue]}
                        ><Label bold style={item.estado === 'novedad' && { color: '#fff' }}>Hay novedad</Label></TouchableOpacity>
                      </View>
                      {item.estado === 'novedad' && <>
                        <TextInput
                          value={item.observacion}
                          onChangeText={(observacion) => updateCheck(index, { observacion })}
                          maxLength={300}
                          multiline
                          placeholder={`Describe la novedad en ${title.toLowerCase()}`}
                          placeholderTextColor={darkMode ? '#9ab0a8' : '#78818a'}
                          style={[s.inspectionNote, darkMode && s.darkField]}
                        />
                        <View style={s.inspectionChoices}>
                          <Button secondary icon="camera" onPress={() => attachCheckPhoto(index, true)}>Tomar foto</Button>
                          <Button secondary icon="image" onPress={() => attachCheckPhoto(index, false)}>Galería</Button>
                        </View>
                        {item.foto_evidencia ? <View style={s.evidenceWrap}>
                          <Image source={{ uri: item.foto_evidencia }} style={s.evidenceImage} accessibilityLabel={`Evidencia de ${title}`} />
                          <TouchableOpacity onPress={() => updateCheck(index, { foto_evidencia: null })}><Label bold style={{ color: '#b42318' }}>Quitar foto</Label></TouchableOpacity>
                        </View> : null}
                      </>}
                    </View>;
                  })}
                </View>
                <View
                  style={[
                    s.card,
                    {
                      flexGrow: 1,
                      flexBasis: '25%',
                      overflow: 'hidden',
                      padding: 0,
                    },
                  ]}
                >
                  <View style={{ alignItems: 'center', justifyContent: 'center', height: 180, backgroundColor: '#e3eee5' }}><Icon name="truck" size={96} color="#064c3b"/></View>
                  <View
                    style={{ backgroundColor: '#124f37', padding: 16, gap: 5 }}
                  >
                    <Label bold style={{ color: '#fff', fontSize: 19 }}>
                    {checkedCount === 6 && !checklist.some((item) => item.estado === 'novedad')
                        ? '¡Todo listo!'
                        : checklist.some((item) => item.estado === 'novedad') ? 'Novedad detectada' : 'Tu seguridad primero'}
                    </Label>
                    <Label style={{ color: '#e0ecda' }}>
                      Buen viaje, que el mejor café llegue más lejos.
                    </Label>
                  </View>
                </View>
              </View>
              <Label style={s.muted}>
                La revisión queda ligada al vehículo {inspectionTrip?.vehiculo_placa || 'asignado'}, al viaje y al conductor. No sustituye una inspección mecánica.
              </Label>
              <Button icon="checklist" onPress={submitInspection} disabled={!checkReady || inspectionSaving || checkedCount < 6}>
                {inspectionSaving ? 'Enviando inspección…' : checklist.some((item) => item.estado === 'novedad') ? 'Reportar inspección con novedades' : 'Enviar inspección preoperacional'}
              </Button>
              {storageMessage && (
                <Label accessibilityLiveRegion="polite" style={s.alert}>
                  {storageMessage}
                </Label>
              )}
            </>
          )}
          {page === 'events' && (
            <>
              <Label style={s.muted}>
                Cuéntanos qué está pasando para poder ayudarte.
              </Label>
              <View style={s.quickGrid}>
                {reportTypes.map((type) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    aria-selected={reportType?.[0] === type[0]}
                    accessibilityState={{
                      selected: reportType?.[0] === type[0],
                    }}
                    key={type[0]}
                    onPress={() => setReportType(type)}
                    style={[
                      s.reportType,
                      darkMode && s.darkCard,
                      width < 650 && { flexBasis: '45%' },
                      reportType?.[0] === type[0] && {
                        backgroundColor: '#ecf3e7',
                        borderColor: '#318347',
                      },
                    ]}
                  >
                    <View style={s.row}>
                      <Icon name={type[2]} size={22} />
                      <Label bold style={{ fontSize: 14, flexShrink: 1 }}>
                        {type[0]}
                      </Label>
                    </View>
                    <Label style={s.muted}>{type[1]}</Label>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.detailColumns}>
                <View style={s.detailColumn}>
                  <Label bold>Evidencia fotográfica (opcional)</Label>
                  <View
                    style={[
                      s.card,
                      {
                        borderStyle: 'dashed',
                        minHeight: 110,
                        justifyContent: 'center',
                        alignItems: 'center',
                      },
                    ]}
                  >
                    <Icon name="document" size={30} />
                    <Label style={s.muted}>
                      Los adjuntos fotográficos aún no están disponibles.
                    </Label>
                  </View>
                </View>
                <View style={s.detailColumn}>
                  <Label bold>Comentario</Label>
                  <TextInput
                    accessibilityLabel="Comentario de la novedad"
                    value={comment}
                    onChangeText={setComment}
                    maxLength={200}
                    multiline
                    placeholder="Describe la novedad e indica si necesitas asistencia."
                    placeholderTextColor="#78818a"
                    style={[s.field, darkMode && s.darkField]}
                  />
                  <Label style={[s.muted, { textAlign: 'right' }]}>
                    {comment.length}/200
                  </Label>
                </View>
              </View>
              {!delivery && (
                <View style={s.alert}>
                  <Label>
                    Necesitas un viaje activo para enviar novedades.
                  </Label>
                </View>
              )}
              {reportMessage && (
                <View style={[s.card, darkMode && s.darkCard]}>
                  <Label accessibilityLiveRegion="polite">
                    {reportMessage}
                  </Label>
                </View>
              )}
              <Button
                icon="arrow"
                onPress={sendReport}
                disabled={!delivery || !reportType || reportSaving}
              >
                {reportSaving ? 'Enviando…' : 'Enviar novedad'}
              </Button>
            </>
          )}
          {page === 'settings' && (
            <>
              <View style={[s.card, darkMode && s.darkCard]}>
                <Label bold style={{ fontSize: 21 }}>Preferencias</Label>
                <Label style={s.muted}>Personaliza la apariencia del panel del conductor.</Label>
                <View style={[s.preferenceRow, darkMode && s.darkBorder]}>
                  <Label bold>Idioma</Label><Label style={s.muted}>Español</Label>
                </View>
                <View style={[s.preferenceRow, darkMode && s.darkBorder]}>
                  <Label bold>Zona horaria</Label><Label style={s.muted}>America/Bogota</Label>
                </View>
                <View style={[s.preferenceRow, darkMode && s.darkBorder]}>
                  <Label bold>Modo oscuro</Label>
                  <TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: darkMode }} onPress={onToggleDarkMode} style={[s.preferenceSwitch, darkMode && s.preferenceSwitchOn]}><View style={[s.preferenceKnob, darkMode && s.preferenceKnobOn]} /></TouchableOpacity>
                </View>
                <View style={[s.preferenceRow, darkMode && s.darkBorder]}>
                  <Label bold>Vista compacta</Label>
                  <TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: preferences.compact }} onPress={() => setPreferences({ ...preferences, compact: !preferences.compact })} style={[s.preferenceSwitch, preferences.compact && s.preferenceSwitchOn]}><View style={[s.preferenceKnob, preferences.compact && s.preferenceKnobOn]} /></TouchableOpacity>
                </View>
                <Button onPress={savePreferences}>Guardar cambios</Button>
                {preferenceMessage ? <Label accessibilityLiveRegion="polite" style={s.success}>{preferenceMessage}</Label> : null}
              </View>
            </>
          )}
          {page === 'profile' && (
            <>
              <View style={s.hero}>
                <Image source={landscape} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.15 }} accessible={false}/>
                <FotoConductor foto={user.foto_perfil} nombre={[user.nombre || user.nombre_usuario, user.apellido].filter(Boolean).join(' ')} size={62} />
                <View style={{ flex: 1 }}>
                  <Label bold style={{ fontSize: 22 }}>
                    {[user.nombre || user.nombre_usuario, user.apellido]
                      .filter(Boolean)
                      .join(' ')}
                  </Label>
                  <Badge>Conductor activo</Badge>
                  <Label style={s.muted}>
                    {user.correo || user.correo_electronico || 'Coffee Fly'}
                  </Label>
                </View>
              </View>
              <View style={s.row}>
                {['Historial de viajes', 'Estadísticas', 'Documentos'].map(
                  (name) => (
                    <TouchableOpacity
                      key={name}
                      accessibilityRole="button"
                      aria-selected={profileTab === name}
                      accessibilityState={{ selected: profileTab === name }}
                      onPress={() => setProfileTab(name)}
                      style={[
                        s.chip,
                        { flex: 1, paddingHorizontal: 5, alignItems: 'center' },
                        profileTab === name && s.chipActive,
                      ]}
                    >
                      <Label
                        style={[
                          s.chipText,
                          profileTab === name && { color: '#fff' },
                        ]}
                      >
                        {name}
                      </Label>
                    </TouchableOpacity>
                  ),
                )}
              </View>
              {profileTab === 'Historial de viajes' && (
                <View style={[s.card, darkMode && s.darkCard]}>
                  <Label bold>Historial de viajes</Label>
                  {summary.history.map((item) => (
                    <View key={item.id_viaje} style={s.checklistRow}>
                      <Icon name="truck" />
                      <View style={{ flex: 1 }}>
                        <Label bold>{item.cooperativa_nombre}</Label>
                        <Label style={s.muted}>
                          {driverDate(
                            item.completado_en || item.creado_en,
                          )?.toLocaleDateString()}{' '}
                          · {item.vehiculo_placa} · {item.cargas.length}{' '}
                          entregas ·{' '}
                          {(item.distancia_recorrida_m / 1000).toFixed(1)} km
                        </Label>
                      </View>
                      <Badge pending={item.estado_viaje === 'cancelado'}>
                        {item.estado_viaje === 'completado'
                          ? 'Completado'
                          : 'Cancelado'}
                      </Badge>
                    </View>
                  ))}
                  {!summary.history.length && (
                    <Label style={s.muted}>
                      Aún no tienes viajes finalizados.
                    </Label>
                  )}
                  <Label style={s.muted}>
                    Se muestran tus últimos 100 viajes finalizados.
                  </Label>
                </View>
              )}
              {profileTab === 'Estadísticas' && (
                <View style={s.metricRow}>
                  {metrics.map(([value, name, icon]) => (
                    <View key={name} style={[s.metric, darkMode && s.darkCard]}>
                      <Icon name={icon} />
                      <Label style={s.metricValue}>{value}</Label>
                      <Label style={s.muted}>{name}</Label>
                    </View>
                  ))}
                </View>
              )}
              {profileTab === 'Documentos' && (
                <View style={[s.card, darkMode && s.darkCard]}>
                  <Icon name="document" size={35} />
                  <Label bold>Documentos del conductor</Label>
                  <Fact icon="user" title="Documento de identidad">
                    {[driverProfile.tipo_documento, driverProfile.numero_documento].filter(Boolean).join(' · ') || 'Pendiente de registrar'}
                  </Fact>
                  <Fact icon="document" title="Licencia de conducción">
                    {[driverProfile.licencia && `Categoría ${driverProfile.licencia}`, driverProfile.numero_licencia && `N.º ${driverProfile.numero_licencia}`].filter(Boolean).join(' · ') || 'Pendiente de registrar'}
                  </Fact>
                  <Fact icon="calendar" title="Vigencia de la licencia">
                    {driverProfile.fecha_vencimiento_licencia ? `${driverProfile.estado_licencia === 'vigente' ? 'Vigente' : 'Vencida'} · vence ${driverDate(driverProfile.fecha_vencimiento_licencia)?.toLocaleDateString('es-CO')}` : 'Sin fecha registrada'}
                  </Fact>
                  <Fact icon="phone" title="Contacto">{driverProfile.telefono || driverProfile.telefono_usuario}</Fact>
                  {driverProfile.foto_licencia ? <Image source={{ uri: driverProfile.foto_licencia }} style={s.licenseImage} resizeMode="contain" accessibilityLabel="Imagen de la licencia registrada" /> : <Label style={s.muted}>No hay imagen de licencia disponible.</Label>}
                  <Button
                    secondary
                    icon="checklist"
                    onPress={() => navigate('checklist')}
                  >
                    Revisar checklist
                  </Button>
                </View>
              )}
              <Button secondary icon="back" onPress={onLogout}>
                Cerrar sesión
              </Button>
            </>
          )}
          {page === 'dashboard' && (
            <View
              style={{
                paddingTop: 8,
                borderTopWidth: 1,
                borderColor: '#e9e9df',
              }}
            >
              <Label
                style={{
                  textAlign: 'center',
                  fontSize: 11,
                  letterSpacing: 1,
                  color: '#78818a',
                }}
              >
                COFFEE FLY · TECNOLOGÍA QUE MUEVE UN MEJOR CAFÉ
              </Label>
            </View>
          )}
        </ScrollView>
      )}
      {Platform.OS !== 'web' && !(page === 'tracking' && navigationMode) && (
        <View style={[s.tabs, darkMode && s.darkTabs]}>
          {tabs.map(([target, name, icon]) => {
            const active =
              target === page ||
              (target === 'assignedDeliveries' && page === 'detail') ||
              (target === 'profile' && page === 'checklist');
            return (
              <TouchableOpacity
                key={target}
                accessibilityRole="tab"
                accessibilityLabel={name}
                aria-selected={active}
                accessibilityState={{ selected: active }}
                onPress={() => navigate(target)}
                style={s.tab}
              >
                <Icon
                  name={icon}
                  size={21}
                  color={active ? (darkMode ? '#8de0ba' : '#124f37') : (darkMode ? '#a8bbb5' : '#647082')}
                />
                <Label style={[s.tabLabel, active && s.activeLabel]}>
                  {name}
                </Label>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
    </MarcoOperativo>
    </ConductorThemeContext.Provider>
  );
}
