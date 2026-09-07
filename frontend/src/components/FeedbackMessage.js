import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

const variants = {
  success: { title: '✓ Operación correcta', color: '#14532d', backgroundColor: '#dcfce7', borderColor: '#15803d' },
  error: { title: '✕ Revisa lo siguiente', color: '#991b1b', backgroundColor: '#fee2e2', borderColor: '#dc2626' },
  info: { title: 'ⓘ Información', color: '#1e3a8a', backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  warning: { title: '⚠ Atención', color: '#78350f', backgroundColor: '#fef3c7', borderColor: '#b45309' },
};

export default function FeedbackMessage({ children, type = 'info' }) {
  const notice = useRef(null);
  useEffect(() => {
    if (children && Platform.OS === 'web') notice.current?.scrollIntoView?.({ block: 'nearest' });
  }, [children, type]);
  if (!children) return null;
  const variant = variants[type] || variants.info;
  const message = typeof children === 'string' ? children : Array.isArray(children)
    ? children.map((item) => item.msg || String(item)).join('\n') : children.msg || 'No se pudo completar la operación.';
  return <View ref={notice} accessibilityRole={type === 'error' ? 'alert' : undefined} accessibilityLiveRegion={type === 'error' ? 'assertive' : 'polite'} style={[styles.box, { backgroundColor: variant.backgroundColor, borderColor: variant.borderColor }]}>
    <Text style={[styles.title, { color: variant.color }]}>{variant.title}</Text>
    <Text style={[styles.message, { color: variant.color }]}>{message}</Text>
  </View>;
}

const styles = StyleSheet.create({
  box: { ...Platform.select({ web: { position: 'fixed', top: 82, right: 18 }, default: { position: 'absolute', top: 8, left: 12, right: 12 } }), zIndex: 9999, width: Platform.OS === 'web' ? 420 : undefined, maxWidth: '92%', padding: 14, borderWidth: 1, borderLeftWidth: 6, borderRadius: 12, gap: 4, shadowColor: '#000', shadowOpacity: .2, shadowRadius: 10, elevation: 12 },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '800' },
  message: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
});
