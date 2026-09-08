import { Platform } from 'react-native';

import { colores } from '../colores';

export const estilosTarjetas = {
  card: { flexGrow: 1, flexBasis: Platform.OS === 'web' ? 270 : '100%', maxWidth: Platform.OS === 'web' ? 370 : '100%', minWidth: Platform.OS === 'web' ? 250 : '100%', backgroundColor: colores.blanco, borderRadius: 12, padding: 14, gap: 6, borderWidth: 1, borderColor: 'rgba(56,102,65,.13)', shadowColor: '#1d3322', shadowOpacity: .07, shadowRadius: 6, elevation: 2 },
  fullCard: { width: '100%', backgroundColor: colores.blanco, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: 'rgba(56,102,65,.13)', overflow: 'hidden' },
  cardSelected: { borderWidth: 2, borderColor: colores.verde, backgroundColor: '#F2F8DF' },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: colores.bosque },
  cardLink: { color: colores.verde, fontWeight: '800' },
  role: { backgroundColor: colores.crema, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  roleActive: { backgroundColor: colores.lima },
  roleSummary: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roleFilter: { flexGrow: 1, flexBasis: Platform.OS === 'web' ? 150 : '45%', minWidth: 130, backgroundColor: colores.blanco, borderWidth: 1, borderColor: 'rgba(56,102,65,.2)', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11 },
  roleFilterActive: { backgroundColor: colores.bosque, borderColor: colores.bosque },
  roleFilterLabel: { color: colores.bosque, fontWeight: '700' },
  roleFilterLabelActive: { color: '#fff' },
  roleFilterCount: { color: colores.verde, fontSize: 24, fontWeight: '900', marginTop: 2 },
  metric: { flexGrow: 1, flexBasis: Platform.OS === 'web' ? 190 : '45%', minWidth: 145, backgroundColor: colores.bosque, borderRadius: 11, padding: 12, gap: 2 },
  metricLabel: { color: colores.crema, fontWeight: '700', textTransform: 'capitalize' },
  metricValue: { color: '#fff', fontSize: 23, fontWeight: '800' },
};
