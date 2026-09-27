import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { gruposPorRol } from '../../configuracion/navegacion';

export default function NavegacionPrincipal({ user, screen, go, darkMode = false }) {
  const { width } = useWindowDimensions();
  const compact = width < 1000;
  const [expanded, setExpanded] = useState(false);
  const navigate = (target) => { go(target); setExpanded(false); };
  const item = (label, target) => <TouchableOpacity key={target} accessibilityRole="button"
    accessibilityState={{ selected: screen === target }} onPress={() => navigate(target)}
    style={[s.item, screen === target && s.active]}>
    <Text style={[s.label, darkMode && s.darkLabel, screen === target && s.activeLabel]}>{label}</Text>
    {screen === target ? <Text style={s.activeLabel}>•</Text> : null}
  </TouchableOpacity>;
  return <View style={[compact ? s.mobile : s.sidebar, darkMode && s.darkSurface]}>
    {compact ? <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }}
      onPress={() => setExpanded(!expanded)} style={s.toggle}>
      <Text style={[s.toggleLabel, darkMode && s.darkLabel]}>{expanded ? 'Cerrar menú' : '☰  Explorar módulos'}</Text>
      <Text style={[s.toggleLabel, darkMode && s.darkLabel]}>{expanded ? '−' : '+'}</Text>
    </TouchableOpacity> : null}
    {!compact || expanded ? <ScrollView style={compact ? s.mobileScroll : s.scroll} contentContainerStyle={s.content}>
      {item('Inicio · Mi panel', 'dashboard')}
      {gruposPorRol(user?.rol).map(({ title, cards }) => <View key={title} style={s.group}>
        <Text style={[s.groupTitle, darkMode && s.darkGroupTitle]}>{title}</Text>
        {cards.map(([label, target]) => item(label, target))}
      </View>)}
    </ScrollView> : null}
  </View>;
}

const s = StyleSheet.create({
  sidebar: { width: 248, backgroundColor: '#FFFFFF', borderRightWidth: 1, borderColor: '#DFE7E1' },
  mobile: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#DFE7E1' },
  scroll: { flex: 1 },
  mobileScroll: { maxHeight: 300 },
  content: { padding: 16, gap: 8 },
  group: { gap: 4, marginTop: 12 },
  groupTitle: { color: '#65736C', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 12, marginBottom: 6 },
  item: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  label: { flex: 1, color: '#42564B', fontSize: 14, lineHeight: 20 },
  active: { backgroundColor: '#E8F2EB', borderLeftWidth: 3, borderLeftColor: '#287457' },
  activeLabel: { color: '#123F34', fontWeight: '700' },
  toggle: { minHeight: 48, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { color: '#123F34', fontWeight: '700' },
  darkSurface: { backgroundColor: '#17382f', borderColor: '#34594f' },
  darkLabel: { color: '#f0f7f2' },
  darkGroupTitle: { color: '#b8d8c9' },
});
