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
import Icon from './IconoConductor';
import MarcoOperativo from '../panel/MarcoOperativo';
import useDriverSummary from './usarResumenConductor';
import { readDriverValue, writeDriverValue } from './almacenConductor';
import { styles as s } from './Conductor.styles';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import { obtenerRutaEntrega } from '../../servicios/sinConexion';
import { driverDate, driverTodayMetrics } from './presentacionConductor';
import MapaAbierto from '../../componentes/mapas/MapaAbierto';
import useTrackingPosition from '../../ganchos/usarPosicionSeguimiento';
import { ConductorThemeContext } from './ConductorTheme';

const logo = require('../../assets/brand/logo.png');
const landscape = require('../../assets/brand/coffee-landscape.jpg');
const checks = [
  ['Niveles de aceite', 'Motor, dirección y otros fluidos'],
  ['Llantas', 'Presión y estado general'],
  ['Frenos', 'Funcionamiento correcto'],
  ['Luces', 'Altas, bajas, direccionales'],
  ['Documentos', 'SOAT, revisión técnico-mecánica, licencia'],
  ['Equipo de seguridad', 'Botiquín, extintor, triángulos, chaleco'],
];
const reportTypes = [
  ['Retraso', 'Demora en ruta', 'clock', 'retraso'],
  ['Tráfico', 'Tráfico pesado', 'truck', 'inconveniente'],
  ['Avería', 'Problema mecánico', 'tools', 'daño vehicular'],
  ['Accidente', 'Siniestro en vía', 'warning', 'inconveniente'],
  [
    'Condiciones en la vía',
    'Clima, derrumbes, cierres',
    'road',
    'inconveniente',
  ],
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
    <Text {...props} style={[s.font, dark && s.darkFont, bold && s.bold, style]}>
      {children}
    </Text>
  );
}
function Badge({ children, pending = false }) {
  return (
    <View style={[s.badge, pending && { backgroundColor: '#fff0c7' }]}>
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
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={[
        secondary ? s.whiteButton : s.greenButton,
        disabled && { opacity: 0.5 },
      ]}
    >
      {icon && (
        <Icon name={icon} size={20} color={secondary ? '#124f37' : '#fff'} />
      )}
      <Label bold style={secondary ? { color: '#124f37' } : s.buttonText}>
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
  const [checklist, setChecklist] = useState([]);
  const [checkReady, setCheckReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  const [savedRoute, setSavedRoute] = useState(null);
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
    setChecklist([]);
    readDriverValue(checklistKey)
      .then((value) => {
        if (disposed) return;
        const parsed = value ? JSON.parse(value) : [];
        setChecklist(
          Array.isArray(parsed)
            ? parsed.filter(
                (index) => Number.isInteger(index) && index >= 0 && index < 6,
              )
            : [],
        );
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
    setSavedRoute(null);
    if (
      ['offline', 'tracking'].includes(page) &&
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
  const navigate = (target) => {
    setNavigationMode(false);
    setSelected(null);
    if (
      ['events', 'profile', 'checklist', 'offline', 'support', 'settings'].includes(target)
    )
      setLocalPage(target);
    else {
      setLocalPage(null);
      go(target);
      if (target === 'tracking') setTrackingStarted(true);
    }
  };
  const toggleCheck = async (index) => {
    const next = checklist.includes(index)
      ? checklist.filter((item) => item !== index)
      : [...checklist, index];
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
  const sendReport = async () => {
    if (!delivery || !reportType || reportBusy.current) return;
    if (connectionStatus !== 'online') {
      setReportMessage('Para enviar esta novedad al coordinador, espera a que vuelva la conexión. El texto permanecerá aquí.');
      return;
    }
    reportBusy.current = true;
    setReportSaving(true);
    setReportMessage('');
    try {
      const response = await fetchApi(
        `${API_BASE_URL}/entregas/${delivery.id_entrega}/eventos-conductor`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tipo_evento: reportType[3],
            detalle: `${reportType[0]}: ${comment.trim()}`.slice(0, 250),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'No se pudo enviar la novedad.',
        );
      setReportMessage('Novedad enviada al coordinador.');
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
      offline: 'Modo offline',
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
    <ConductorThemeContext.Provider value={preferences.dark}>
    <MarcoOperativo user={user} role="Conductor" dark={preferences.dark} menu={[
      ['home','Inicio','dashboard'], ['pin','Ruta activa','tracking'], ['truck','Entregas','assignedDeliveries'],
      ['clipboard','Checklist del vehículo','checklist'], ['bell','Novedades','events'], ['people','Servicio al cliente','support'],
      ['user','Perfil e historial','profile'], ['gear','Preferencias','settings'],
    ]} active={page === 'detail' ? 'assignedDeliveries' : page} go={navigate} onLogout={onLogout} connectionStatus={connectionStatus} immersive={page === 'tracking' && navigationMode}>
    <View style={[s.root, preferences.dark && s.darkRoot]}>
      {Platform.OS !== 'web' && !(page === 'tracking' && navigationMode) && (
        <View style={s.top}>
          {page === 'dashboard' ? (
            <Image source={logo} resizeMode="contain" style={{ width: 44, height: 44 }} accessibilityLabel="Coffee Fly"/>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Volver al inicio"
              onPress={() => navigate('dashboard')}
              style={{ padding: 5 }}
            >
              <Icon name="back" size={22} color="#111c2c" />
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
          <Badge>
            {page === 'offline'
              ? connectionStatus === 'online'
                ? 'En línea'
                : 'Sin conexión'
              : badge}
          </Badge>
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
              <View style={s.card}>
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
                  style={[s.card, { padding: 5, backgroundColor: '#e4efdf' }]}
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
              <View style={s.metricRow}>
                {metrics.map(([value, name, icon]) => (
                  <View
                    key={name}
                    style={[
                      s.metric,
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
              <View style={s.card}>
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
                {[
                  [
                    trip ? 'Continuar viaje' : 'Iniciar viaje',
                    'Comenzar ruta',
                    'play',
                    trip ? 'tracking' : 'assignedDeliveries',
                  ],
                  ['Checklist', 'Revisar vehículo', 'checklist', 'checklist'],
                  [
                    'Reportar novedad',
                    'Incidencias en ruta',
                    'warning',
                    'events',
                  ],
                ].map(([title, sub, icon, target], index) => (
                  <TouchableOpacity
                    key={title}
                    accessibilityRole="button"
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
                      style={[s.chip, filter === name && s.chipActive]}
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
                  style={[s.card, s.row]}
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
                <View style={s.card}>
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
              <View style={[s.card, s.spread]}>
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
              <View style={[s.card, s.detailColumns]}>
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
                <Badge pending={checklist.length < 6}>
                  {checklist.length}/6{' '}
                  {checklist.length === 6 ? 'Completado' : 'Por revisar'}
                </Badge>
              </View>
              <View style={[s.detailColumns, { alignItems: 'stretch' }]}>
                <View
                  style={[
                    s.card,
                    { flexGrow: 2, flexBasis: width < 600 ? '100%' : '60%' },
                  ]}
                >
                  {checks.map(([title, subtitle], index) => (
                    <TouchableOpacity
                      key={title}
                      disabled={!checkReady}
                      accessibilityRole="checkbox"
                      aria-checked={checklist.includes(index)}
                      accessibilityState={{
                        checked: checklist.includes(index),
                        disabled: !checkReady,
                      }}
                      accessibilityLabel={title}
                      onPress={() => toggleCheck(index)}
                      style={s.checklistRow}
                    >
                      <View
                        style={[
                          s.checkCircle,
                          checklist.includes(index) && s.checkDone,
                        ]}
                      >
                        {checklist.includes(index) && (
                          <Icon name="check" color="#fff" size={17} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Label bold>{title}</Label>
                        <Label style={s.muted}>{subtitle}</Label>
                      </View>
                      <Icon name="right" color="#78818a" size={15} />
                    </TouchableOpacity>
                  ))}
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
                      {checklist.length === 6
                        ? '¡Todo listo!'
                        : 'Tu seguridad primero'}
                    </Label>
                    <Label style={{ color: '#e0ecda' }}>
                      Buen viaje, que el mejor café llegue más lejos.
                    </Label>
                  </View>
                </View>
              </View>
              <Label style={s.muted}>
                Revisión manual guardada por conductor, vehículo y día. No
                sustituye una inspección mecánica.
              </Label>
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
                    style={s.field}
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
                <View style={s.card}>
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
          {page === 'offline' && (
            <>
              <Label style={s.muted}>
                Consulta qué puedes conservar al perder la conexión.
              </Label>
              <View style={s.metricRow}>
                <View style={s.metric}>
                  <Icon name="layers" size={38} />
                  <Label bold>Ruta guardada</Label>
                  <Label style={s.muted}>
                    {savedRoute
                      ? `${savedRoute.puntos?.length || 0} puntos del recorrido`
                      : 'No hay una ruta guardada para esta etapa'}
                  </Label>
                </View>
                <View style={s.metric}>
                  <Icon name="wifi" size={38} />
                  <Label bold>Estado</Label>
                  <Label style={s.muted}>
                    {connectionStatus === 'online'
                      ? 'En línea'
                      : connectionStatus === 'checking'
                        ? 'Comprobando conexión'
                        : 'Sin conexión'}
                  </Label>
                </View>
              </View>
              <View style={s.card}>
                <Label bold>Capacidades sin conexión</Label>
                <Fact icon="checklist" title="Checklist">
                  Revisión manual disponible y guardada en este dispositivo.
                </Fact>
                <Fact icon="route" title="Navegación móvil">
                  {savedRoute
                    ? 'Recorrido guardado disponible en la app móvil.'
                    : 'Abre una ruta con conexión para guardarla en la app móvil.'}
                </Fact>
                <Fact icon="pin" title="Posiciones GPS">
                  La app móvil conserva las posiciones pendientes para
                  sincronizarlas.
                </Fact>
              </View>
              <View style={s.alert}>
                <Label bold>Mapas regionales y recálculo offline</Label>
                <Label>
                  La descarga de mapas por región y el recálculo sin Internet
                  todavía no están disponibles. La capa de calles necesita
                  conexión.
                </Label>
              </View>
              <Button
                secondary
                icon="route"
                onPress={() => navigate('tracking')}
              >
                Ver ruta completa
              </Button>
            </>
          )}
          {page === 'settings' && (
            <>
              <View style={[s.card, preferences.dark && s.darkCard]}>
                <Label bold style={{ fontSize: 21 }}>Preferencias</Label>
                <Label style={s.muted}>Personaliza la apariencia del panel del conductor.</Label>
                <View style={[s.preferenceRow, preferences.dark && s.darkBorder]}>
                  <Label bold>Idioma</Label><Label style={s.muted}>Español</Label>
                </View>
                <View style={[s.preferenceRow, preferences.dark && s.darkBorder]}>
                  <Label bold>Zona horaria</Label><Label style={s.muted}>America/Bogota</Label>
                </View>
                <View style={[s.preferenceRow, preferences.dark && s.darkBorder]}>
                  <Label bold>Modo oscuro</Label>
                  <TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: preferences.dark }} onPress={() => setPreferences({ ...preferences, dark: !preferences.dark })} style={[s.preferenceSwitch, preferences.dark && s.preferenceSwitchOn]}><View style={[s.preferenceKnob, preferences.dark && s.preferenceKnobOn]} /></TouchableOpacity>
                </View>
                <View style={[s.preferenceRow, preferences.dark && s.darkBorder]}>
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
                <View style={s.card}>
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
                    <View key={name} style={s.metric}>
                      <Icon name={icon} />
                      <Label style={s.metricValue}>{value}</Label>
                      <Label style={s.muted}>{name}</Label>
                    </View>
                  ))}
                </View>
              )}
              {profileTab === 'Documentos' && (
                <View style={s.card}>
                  <Icon name="document" size={35} />
                  <Label bold>Documentos del conductor</Label>
                  <Label style={s.muted}>
                    La consulta de licencia y documentos no está disponible.
                    Comprueba su vigencia antes de salir.
                  </Label>
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
        <View style={s.tabs}>
          {tabs.map(([target, name, icon]) => {
            const active =
              target === page ||
              (target === 'assignedDeliveries' && page === 'detail') ||
              (target === 'profile' && ['offline', 'checklist'].includes(page));
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
                  color={active ? '#124f37' : '#647082'}
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
