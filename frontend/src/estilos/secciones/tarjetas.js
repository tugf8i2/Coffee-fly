import { Platform } from 'react-native';

import { colores } from '../colores';

export const estilosTarjetas = {
  card: { flexGrow: 1, flexBasis: Platform.OS === 'web' ? 275 : '100%', maxWidth: Platform.OS === 'web' ? 380 : '100%', minWidth: Platform.OS === 'web' ? 250 : '100%', backgroundColor: colores.blanco, borderRadius: 14, padding: 17, gap: 7, borderWidth: 1, borderColor: 'rgba(56,102,65,.16)', shadowColor: '#1d3322', shadowOpacity: .07, shadowRadius: 8, elevation: 2 },
  fullCard: { width: '100%', backgroundColor: colores.blanco, borderRadius: 14, padding: 17, gap: 9, borderWidth: 1, borderColor: 'rgba(56,102,65,.16)', overflow: 'hidden' },
  cardSelected: { borderWidth: 2, borderColor: colores.verde, backgroundColor: '#F2F8DF' },
  cardTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: colores.bosque },
  cardLink: { color: colores.verde, fontWeight: '800', marginTop: 4 },
  role: { backgroundColor: colores.crema, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(56,102,65,.12)' },
  roleActive: { backgroundColor: colores.lima, borderColor: colores.verde },
  roleSummary: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roleFilter: { flexGrow: 1, flexBasis: Platform.OS === 'web' ? 150 : '45%', minWidth: 130, backgroundColor: colores.blanco, borderWidth: 1, borderColor: 'rgba(56,102,65,.2)', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11 },
  roleFilterActive: { backgroundColor: colores.bosque, borderColor: colores.bosque },
  roleFilterLabel: { color: colores.bosque, fontWeight: '700' },
  roleFilterLabelActive: { color: '#fff' },
  roleFilterCount: { color: colores.verde, fontSize: 24, fontWeight: '900', marginTop: 2 },
  metric: { flexGrow: 1, flexBasis: Platform.OS === 'web' ? 190 : '45%', minWidth: 145, minHeight: 104, backgroundColor: colores.bosque, borderRadius: 13, padding: 16, gap: 5, justifyContent: 'space-between', borderBottomWidth: 4, borderBottomColor: colores.lima },
  metricLabel: { color: colores.crema, fontWeight: '700', textTransform: 'capitalize' },
  metricValue: { color: '#fff', fontSize: 28, lineHeight: 34, fontWeight: '900' },
};
