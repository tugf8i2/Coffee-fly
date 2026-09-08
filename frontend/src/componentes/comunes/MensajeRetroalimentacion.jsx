import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const variants = {
  success: { title: '✓ Operación correcta', color: '#14532d', backgroundColor: '#dcfce7', borderColor: '#15803d' },
  error: { title: '✕ Revisa lo siguiente', color: '#991b1b', backgroundColor: '#fee2e2', borderColor: '#dc2626' },
  info: { title: 'ⓘ Información', color: '#1e3a8a', backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  warning: { title: '⚠ Atención', color: '#78350f', backgroundColor: '#fef3c7', borderColor: '#b45309' },
};

const defaultDuration = { success: 4000, info: 6000, warning: 8000, error: 10000 };

export default function MensajeRetroalimentacion({ children, type = 'info', durationMs, onDismiss }) {
  const notice = useRef(null);
  const [visible, setVisible] = useState(Boolean(children));
  useEffect(() => {
    setVisible(Boolean(children));
    if (children && Platform.OS === 'web') notice.current?.scrollIntoView?.({ block: 'nearest' });
    if (!children) return undefined;
    const delay = durationMs ?? defaultDuration[type] ?? defaultDuration.info;
    if (delay <= 0) return undefined;
    const timer = setTimeout(() => setVisible(false), delay);
    return () => clearTimeout(timer);
  }, [children, durationMs, type]);
  if (!children || !visible) return null;
  const variant = variants[type] || variants.info;
  const message = typeof children === 'string' ? children : Array.isArray(children)
    ? children.map((item) => item.msg || String(item)).join('\n') : children.msg || 'No se pudo completar la operación.';
  const dismiss = () => {
    setVisible(false);
    onDismiss?.();
  };
  return <View ref={notice} accessibilityRole={type === 'error' ? 'alert' : undefined} accessibilityLiveRegion={type === 'error' ? 'assertive' : 'polite'} style={[styles.box, { backgroundColor: variant.backgroundColor, borderColor: variant.borderColor }]}>
    <View style={styles.header}>
      <Text style={[styles.title, { color: variant.color }]}>{variant.title}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Cerrar mensaje"
        hitSlop={8}
        onPress={dismiss}
        style={styles.closeButton}
      >
        <Text style={[styles.closeText, { color: variant.color }]}>×</Text>
      </TouchableOpacity>
    </View>
    <Text style={[styles.message, { color: variant.color }]}>{message}</Text>
  </View>;
}

const styles = StyleSheet.create({
  box: {
    ...Platform.select({
      web: { position: 'fixed', top: 82, right: 18, width: 390 },
      default: { position: 'relative', width: '100%', alignSelf: 'center' },
    }),
    zIndex: 9999,
    maxWidth: Platform.OS === 'web' ? 390 : '100%',
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderRadius: 10,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: .12,
    shadowRadius: 6,
    elevation: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  message: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  closeButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 25, lineHeight: 28, fontWeight: '600' },
});
