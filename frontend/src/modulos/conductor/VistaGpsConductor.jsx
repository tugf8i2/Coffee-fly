import { useState } from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Icon from './IconoConductor';
import { compactDistance, gpsStop, turnIcon } from './presentacionGps';

const reference = require('../../assets/brand/gps-conductor-reference.png');
function BrandArt({ crop, width, height, maskClock = false }) {
  const scale = Math.max(width / crop[2], height / crop[3]);
  return (
    <View
      accessibilityElementsHidden
      style={{ width, height, overflow: 'hidden' }}
    >
      <Image
        source={reference}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          width: 1448 * scale,
          height: 1086 * scale,
          left: -crop[0] * scale,
          top: -crop[1] * scale,
        }}
      />
      {maskClock && <View style={{ position: 'absolute', left: 0, top: 0, width: 25 * scale, height: 20 * scale, backgroundColor: '#fffdf6' }} />}
    </View>
  );
}
function Copy({ bold, style, children, ...props }) {
  return (
    <Text {...props} style={[styles.copy, bold && styles.bold, style]}>
      {children}
    </Text>
  );
}
function Action({ icon, title, subtitle, onPress, red, disabled }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        red && styles.finish,
        disabled && { opacity: 0.55 },
      ]}
    >
      <View style={[styles.actionIcon, red && { backgroundColor: '#fff' }]}>
        <Icon name={icon} size={29} color={red ? '#b72b31' : '#094931'} />
      </View>
      <View style={{ flex: 1 }}>
        <Copy bold style={[styles.actionTitle, red && { color: '#fff' }]}>
          {title}
        </Copy>
        <Copy style={[styles.secondary, red && { color: '#fff3ed' }]}>
          {subtitle}
        </Copy>
      </View>
      <Icon name="right" size={19} color={red ? '#fff' : '#101c30'} />
    </TouchableOpacity>
  );
}
export default function VistaGpsConductor({
  map,
  controlsRef,
  trip,
  deliveryId,
  tracking,
  currentInstruction,
  nextInstruction,
  turnDistance,
  remainingDistance,
  remainingDuration,
  routeAvailable,
  voiceEnabled,
  voiceStatus,
  onVoice,
  onRepeat,
  onAction,
  onSelectStop,
  onFinish,
  finishDisabled,
  finishBusy,
  gpsStatus,
  message,
  onRetry,
  onExit,
  onTheme,
  mapTheme,
  offline = false,
}) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 1000;
  const stop = gpsStop(trip, deliveryId, tracking?.etapa_viaje);
  const [statusOpen, setStatusOpen] = useState(false);
  const [stopsOpen, setStopsOpen] = useState(false);
  const eta =
    routeAvailable && Number.isFinite(Number(remainingDuration))
      ? new Date(
          Date.now() + Number(remainingDuration) * 1000,
        ).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
      : '—';
  const phone = tracking?.coordinador_telefono;
  const maneuver =
    currentInstruction?.texto ||
    (routeAvailable
      ? 'Continúa hacia el destino indicado'
      : 'Calculando ruta…');
  const instructionParts = maneuver.match(/^(.*?)(\s+(?:hacia|por)\s+.+)$/i);
  const mainInstruction = instructionParts?.[1] || maneuver;
  const roadInstruction = instructionParts?.[2]?.trim() || (currentInstruction?.calle ? `hacia ${currentInstruction.calle}` : null);
  const finishTitle = finishBusy
    ? 'Verificando GPS…'
    : stop.cooperative
      ? 'Finalizar entrega'
      : 'Confirmar recogida';
  const details = (
    <>
      {stopsOpen && (
        <View style={styles.delivery}>
          <Copy bold style={{ fontSize: 20 }}>
            Paradas de la ruta
          </Copy>
          {trip?.cargas?.map((load, index) => (
            <TouchableOpacity
              key={load.id_entrega}
              accessibilityRole="button"
              accessibilityState={{
                disabled: !!load.carga_recogida_en,
                selected: deliveryId === load.id_entrega,
              }}
              disabled={!!load.carga_recogida_en}
              onPress={() => {
                onSelectStop?.(load.id_entrega);
                setStopsOpen(false);
                controlsRef.current?.center?.();
              }}
              style={[
                styles.center,
                {
                  borderWidth: 1,
                  borderColor:
                    deliveryId === load.id_entrega ? '#368b51' : '#e4e8dd',
                },
              ]}
            >
              <Icon name={load.carga_recogida_en ? 'check' : 'pin'} size={20} />
              <Copy style={{ flex: 1 }}>
                {index + 1}. {load.caficultor_nombre} ·{' '}
                {Number(load.cantidad_kg).toLocaleString('es-CO')} kg
                {load.carga_recogida_en ? ' · recogida' : ''}
              </Copy>
            </TouchableOpacity>
          ))}
          <Copy bold>
            {(trip?.cargas?.length || 0) + 1}.{' '}
            {trip?.cooperativa_nombre || 'Cooperativa de destino'}
          </Copy>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setStopsOpen(false)}
          >
            <Copy bold style={{ color: '#175b36' }}>
              Cerrar lista de paradas
            </Copy>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.delivery}>
        <View style={styles.spread}>
          <Icon name="box" size={25} />
          <Copy bold style={{ fontSize: 20, flex: 1 }}>
            Entrega actual
          </Copy>
          <View style={styles.stopPill}>
            <Copy style={{ color: '#144f36', fontSize: 13 }}>
              {stop.number
                ? `Parada ${stop.number} de ${stop.total}`
                : 'Parada actual'}
            </Copy>
          </View>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Ver detalles de la entrega actual"
          onPress={() => onAction?.('delivery', deliveryId)}
          style={styles.deliveryInner}
        >
          <View style={styles.row}>
            <Icon name={stop.cooperative ? 'box' : 'home'} size={29} />
            <Copy bold style={{ fontSize: 23, flex: 1 }}>
              {stop.cooperative
                ? trip?.cooperativa_nombre
                : stop.load?.caficultor_nombre ||
                  tracking?.destino ||
                  'Destino actual'}
            </Copy>
          </View>
          <View
            style={[styles.row, { alignItems: 'flex-start', marginTop: 15 }]}
          >
            <Icon name="pin" size={19} color="#132437" />
            <Copy style={[styles.secondary, { fontSize: 17, flex: 1 }]}>
              {tracking?.destino || 'Ubicación no registrada'}
            </Copy>
          </View>
          <View style={styles.load}>
            <Icon name="box" size={26} color="#122139" />
            <View style={{ flex: 1 }}>
              <Copy style={styles.secondary}>Carga</Copy>
              <Copy bold style={{ fontSize: 18 }}>
                {stop.load
                  ? `${Number(stop.load.cantidad_kg).toLocaleString('es-CO')} kg de café`
                  : `${Number(trip?.peso_total_kg || 0).toLocaleString('es-CO')} kg · ${trip?.cargas?.length || 0} cargas`}
              </Copy>
            </View>
            <Icon name="right" size={18} />
          </View>
        </TouchableOpacity>
      </View>
      <Action
        icon="map"
        title="Ver ruta completa"
        subtitle="Lista de paradas y mapa general"
        onPress={() => {
          controlsRef.current?.fit?.();
          setStopsOpen(true);
        }}
      />
      <Action
        icon="warning"
        title="Reportar novedad"
        subtitle="Incidencias en ruta"
        onPress={() => onAction?.('events')}
      />
      <Action
        icon="phone"
        title={phone ? 'Llamar coordinador' : 'Contactar coordinador'}
        subtitle={phone || 'Teléfono no disponible · abrir mensajes'}
        onPress={() =>
          phone
            ? Linking.openURL(`tel:${String(phone).replace(/[^+\d]/g, '')}`)
            : onAction?.('support')
        }
      />
      <Action
        icon="stop"
        title={finishTitle}
        subtitle={
          stop.cooperative
            ? 'Entregar todas las cargas en cooperativa'
            : finishDisabled ? 'Acércate a la finca y espera un GPS preciso' : 'Registrar recogida en la finca con GPS'
        }
        red
        onPress={onFinish}
        disabled={finishDisabled || finishBusy}
      />
      <Copy style={styles.disclaimer}>
        La llegada GPS no confirma una entrega automáticamente. Estimaciones sin
        tráfico en vivo.
      </Copy>
    </>
  );
  const routeSummary = (
    <View style={[styles.summary, !wide && styles.summarySmall]}>
      {[
        [
          Math.ceil(Number(remainingDuration || 0) / 60) + ' min',
          `${compactDistance(remainingDistance)} restantes`,
          'road',
        ],
        [eta, 'Llegada estimada', 'clock'],
        [compactDistance(remainingDistance), 'Restantes', 'flag'],
      ].map(([value, label, icon], index) => (
        <View
          key={icon}
          style={[styles.summaryMetric, index > 0 && styles.summaryBorder]}
        >
          <View style={[styles.metricIcon, !wide && { width: 36, height: 36 }]}>
            <Icon name={icon} size={wide ? 30 : 23} />
          </View>
          <View style={{ flex: 1 }}>
            <Copy bold style={{ fontSize: wide ? 27 : 19 }}>
              {routeAvailable ? value : '—'}
            </Copy>
            <Copy style={[styles.secondary, { fontSize: wide ? 16 : 11 }]}>
              {label}
            </Copy>
          </View>
        </View>
      ))}
    </View>
  );
  const gpsMap = (
    <View
      style={[
        styles.mapStage,
        {
          minHeight: wide
            ? Math.max(560, height - 170)
            : Math.max(490, height - 230),
          flex: wide ? 1 : undefined,
        },
      ]}
    >
      {map}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.turnBanner,
            !wide && { left: 10, right: 10, top: 10, padding: 12, gap: 10 },
          ]}
        >
          <View style={[styles.turnIcon, !wide && { width: 49 }]}>
            <Icon
              name={turnIcon(maneuver)}
              size={wide ? 70 : 42}
              color="#fff"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Copy
              bold
              numberOfLines={3}
              style={{ fontSize: wide ? 30 : 20, color: '#fff' }}
            >
              {turnDistance != null
                ? `En ${compactDistance(turnDistance)}, `
                : ''}
              {mainInstruction.charAt(0).toLowerCase() + mainInstruction.slice(1)}
            </Copy>
            {roadInstruction && (
              <Copy style={{ fontSize: wide ? 24 : 16, color: '#f0f7ef' }}>
                {roadInstruction}
              </Copy>
            )}
          </View>
          {nextInstruction && wide && (
            <View style={styles.nextTurn}>
              <Icon
                name={turnIcon(nextInstruction.texto)}
                size={38}
                color="#fff"
              />
              <View style={{ flex: 1 }}>
                <Copy style={{ color: '#fff', fontSize: 19 }}>Luego</Copy>
                <Copy numberOfLines={3} style={{ color: '#fff', fontSize: 18 }}>
                  {nextInstruction.texto}
                </Copy>
              </View>
            </View>
          )}
        </View>
        <View
          style={[
            styles.mapButtons,
            { top: wide ? 156 : 130, gap: wide ? 13 : 9 },
          ]}
        >
          {!offline && <><TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Orientar mapa al norte"
            onPress={() => controlsRef.current?.north?.()}
            style={[styles.circle, !wide && { width: 48, height: 48 }]}
          >
            <Icon name="compass" size={28} color="#c83237" />
            <Copy bold style={{ fontSize: 11 }}>
              N
            </Copy>
          </TouchableOpacity>
          <View style={styles.zoom}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Acercar mapa GPS"
              style={[styles.zoomButton, !wide && { width: 48, height: 42 }]}
              onPress={() => controlsRef.current?.zoomIn?.()}
            >
              <Icon name="plus" size={28} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Alejar mapa GPS"
              style={[
                styles.zoomButton,
                !wide && { width: 48, height: 42 },
                { borderTopWidth: 1, borderColor: '#e6e9df' },
              ]}
              onPress={() => controlsRef.current?.zoomOut?.()}
            >
              <Icon name="minus" size={28} />
            </TouchableOpacity>
          </View></>}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              voiceEnabled ? 'Silenciar voz GPS' : 'Activar voz GPS'
            }
            onPress={onVoice}
            style={[styles.circle, !wide && { width: 48, height: 48 }]}
          >
            <Icon
              name={voiceEnabled ? 'volume' : 'muted'}
              size={29}
              color="#111c22"
            />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Reportar novedad en ruta"
            onPress={() => onAction?.('events')}
            style={[styles.circle, !wide && { width: 48, height: 48 }]}
          >
            <Icon name="warning" size={29} color="#db9200" />
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.mapBottom,
            {
              left: wide ? 16 : 10,
              right: wide ? 16 : 10,
              bottom: wide ? 35 : 30,
            },
          ]}
        >
          <View style={styles.mapUtility}>
            {!offline && <TouchableOpacity
              accessibilityRole="button"
              onPress={() => controlsRef.current?.center?.()}
              style={styles.center}
            >
              <Icon name="target" size={22} color="#131b1b" />
              <Copy bold style={{ fontSize: wide ? 15 : 13 }}>
                Centrar en mi ubicación
              </Copy>
            </TouchableOpacity>}
            {wide && (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={onRepeat}
                disabled={!currentInstruction}
                style={styles.center}
              >
                <Copy>Repetir indicación</Copy>
              </TouchableOpacity>
            )}
          </View>
          {routeSummary}
        </View>
      </View>
    </View>
  );
  return (
    <View style={styles.root}>
      <View style={[styles.header, !wide && { padding: 10, minHeight: 80 }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Salir del GPS al inicio"
          onPress={onExit}
        >
          <BrandArt
            maskClock
            crop={[91, 66, 162, 104]}
            width={wide ? 132 : 76}
            height={wide ? 88 : 51}
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Copy bold style={{ fontSize: wide ? 27 : 21 }}>
            Panel del conductor
          </Copy>
          {wide && (
            <BrandArt crop={[359, 121, 267, 44]} width={245} height={40} />
          )}
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Estado de navegación GPS"
          onPress={() => setStatusOpen(!statusOpen)}
          style={[styles.status, !wide && { padding: 10, gap: 7 }]}
        >
          <View style={styles.dot} />
          <Copy bold style={{ fontSize: wide ? 20 : 14 }}>
            En ruta
          </Copy>
          <Icon name="down" size={19} />
        </TouchableOpacity>
        {wide && (
          <View style={styles.slogan}>
            <Copy style={{ fontSize: 16, textAlign: 'right' }}>
              Haciendo crecer{'\n'}lo nuestro
            </Copy>
            <Icon name="leaf" size={39} />
          </View>
        )}
      </View>
      {statusOpen && (
        <View style={styles.statusDetails}>
          <Copy>{gpsStatus}</Copy>
          <Copy>{voiceStatus}</Copy>
          <View style={styles.row}>
            <TouchableOpacity accessibilityRole="button" onPress={onTheme}>
              <Copy bold>
                {mapTheme === 'dark' ? 'Mapa de día' : 'Mapa de noche'}
              </Copy>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onRepeat}
              disabled={!currentInstruction}
            >
              <Copy bold>Repetir indicación</Copy>
            </TouchableOpacity>
            {onRetry && (
              <TouchableOpacity accessibilityRole="button" onPress={onRetry}>
                <Copy bold>Reintentar GPS</Copy>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      {message && (
        <View style={styles.notice}>
          <Copy accessibilityLiveRegion="polite">{message}</Copy>
        </View>
      )}
      {wide ? (
        <View style={styles.body}>
          {gpsMap}
          <ScrollView
            style={styles.aside}
            contentContainerStyle={{ gap: 10, paddingBottom: 15 }}
          >
            {details}
          </ScrollView>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 8, gap: 12, paddingBottom: 15 }}
        >
          {gpsMap}
          <View style={{ gap: 10 }}>{details}</View>
        </ScrollView>
      )}
      <View style={styles.footer}>
        <Copy numberOfLines={2} style={{ fontSize: 12, color: '#557563' }}>
          {gpsStatus} · {voiceStatus}
        </Copy>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#faf9f2' },
  copy: { fontFamily: 'DriverRegular', color: '#101b2f', fontSize: 16 },
  bold: { fontFamily: 'DriverBold' },
  secondary: { color: '#4b6179', fontSize: 15, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spread: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  header: {
    minHeight: 125,
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    backgroundColor: '#fffdf7',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 17,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#e6e6dc',
    backgroundColor: '#fffdf8',
    boxShadow: '0 3px 16px #23352a14',
  },
  dot: { width: 17, height: 17, borderRadius: 12, backgroundColor: '#079f59' },
  slogan: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginLeft: 35,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 15,
  },
  mapStage: {
    borderRadius: 23,
    overflow: 'hidden',
    backgroundColor: '#d8eacb',
    borderWidth: 6,
    borderColor: '#cfe3c2',
    position: 'relative',
  },
  aside: { flexGrow: 0, width: 350 },
  turnBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    borderRadius: 20,
    backgroundColor: '#054b33',
    borderWidth: 1,
    borderColor: '#25834c',
    padding: 19,
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
    boxShadow: '0 3px 12px #11372316',
  },
  turnIcon: {
    width: 88,
    borderRightWidth: 1,
    borderColor: '#bfd8c4',
    paddingRight: 12,
  },
  nextTurn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#489363',
    width: 195,
  },
  mapButtons: { position: 'absolute', right: 14, gap: 13 },
  circle: {
    width: 59,
    height: 59,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    boxShadow: '0 2px 12px #13232216',
  },
  zoom: {
    backgroundColor: '#fff',
    borderRadius: 27,
    overflow: 'hidden',
    boxShadow: '0 2px 12px #13232216',
  },
  zoomButton: {
    width: 59,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBottom: { position: 'absolute', gap: 12 },
  mapUtility: { flexDirection: 'row', justifyContent: 'space-between', gap: 9 },
  center: {
    backgroundColor: '#fffdf7',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    boxShadow: '0 2px 8px #18382812',
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: '#fffdf7',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 15,
    boxShadow: '0 4px 12px #14362914',
  },
  summarySmall: { paddingHorizontal: 5, paddingVertical: 13 },
  summaryMetric: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  summaryBorder: { borderLeftWidth: 1, borderColor: '#c7d9c1' },
  metricIcon: {
    backgroundColor: '#edf3e6',
    borderRadius: 15,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delivery: {
    backgroundColor: '#fffefb',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eeeee5',
    gap: 20,
    boxShadow: '0 4px 12px #15291d09',
  },
  stopPill: {
    backgroundColor: '#e9f2e3',
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deliveryInner: {
    borderWidth: 1,
    borderColor: '#eaece2',
    borderRadius: 17,
    padding: 15,
  },
  load: {
    marginTop: 22,
    paddingTop: 17,
    borderTopWidth: 1,
    borderColor: '#eeeee4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  action: {
    backgroundColor: '#fffefb',
    padding: 15,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#e7e8df',
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    minHeight: 81,
    boxShadow: '0 3px 9px #21332009',
  },
  actionIcon: {
    width: 49,
    height: 49,
    borderRadius: 17,
    backgroundColor: '#e9f1e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: { fontSize: 20, lineHeight: 25 },
  finish: {
    backgroundColor: '#bb2d32',
    borderColor: '#a71f2c',
    minHeight: 94,
    marginTop: 7,
  },
  disclaimer: { fontSize: 12, lineHeight: 17, color: '#6f7e71', padding: 5 },
  statusDetails: { padding: 12, gap: 8, backgroundColor: '#edf3e7' },
  notice: { padding: 10, backgroundColor: '#fff0ce' },
  footer: { paddingHorizontal: 18, paddingVertical: 5 },
});
