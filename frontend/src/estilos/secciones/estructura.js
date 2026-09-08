import { colores } from '../colores';

export const estilosEstructura = {
  safe: { flex: 1, backgroundColor: colores.crema },
  header: { minHeight: 64, backgroundColor: colores.bosque, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 6 },
  logo: { width: 46, height: 46, resizeMode: 'contain' },
  brand: { color: '#fff', fontWeight: '800', letterSpacing: 2, fontSize: 19 },
  headerButton: { backgroundColor: colores.lima, color: colores.bosque, fontWeight: '800', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  connectionBanner: { backgroundColor: '#EEF4D5', borderBottomWidth: 1, borderColor: 'rgba(56,102,65,.2)', paddingHorizontal: 18, paddingVertical: 6 },
  connectionText: { color: colores.bosque, fontWeight: '700', maxWidth: 1180, width: '100%', alignSelf: 'center' },
  page: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 18, gap: 11 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 11 },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '800', color: colores.bosque },
  section: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: colores.bosque, marginTop: 5 },
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 12 },
};
