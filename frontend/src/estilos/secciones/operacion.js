import { Platform } from 'react-native';

import { colores } from '../colores';

export const estilosOperacion = {
  mapPanel: { width: '100%', minHeight: 320, backgroundColor: colores.blanco, borderRadius: 15, padding: 13, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(56,102,65,.16)' },
  bagGroup: { width: '100%', backgroundColor: '#F2F8DF', borderRadius: 11, padding: 14, gap: 8, borderWidth: 1, borderColor: 'rgba(56,102,65,.18)' },
  statusActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 5 },
  statusButton: { backgroundColor: colores.lima, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(56,102,65,.18)' },
  statusButtonText: { color: colores.bosque, fontWeight: '800' },
  history: { gap: 4, marginTop: 6, paddingTop: 7, borderTopWidth: 1, borderColor: 'rgba(56,102,65,.18)' },
  deliveryHeader: { width: '100%', backgroundColor: '#EEF4D5', borderLeftWidth: 5, borderLeftColor: colores.verde, borderRadius: 13, padding: 18, gap: 6 },
  deliveryForm: { width: '100%', maxWidth: 760, alignSelf: 'center', backgroundColor: colores.blanco, borderRadius: 14, padding: 18, gap: 10, borderWidth: 1, borderColor: 'rgba(56,102,65,.18)', shadowColor: '#1d3322', shadowOpacity: .08, shadowRadius: 8, elevation: 3 },
  deliverySubmit: { width: '100%', backgroundColor: colores.bosque, paddingHorizontal: 18, paddingVertical: 13, minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  selectionHint: { color: colores.bosque, backgroundColor: '#F2F8DF', borderRadius: 9, padding: 12, fontWeight: '700' },
  totalBox: { backgroundColor: '#EEF4D5', borderRadius: 10, padding: 12, borderLeftWidth: 5, borderLeftColor: colores.verde },
  totalLabel: { color: colores.bosque, fontWeight: '700' },
  totalValue: { color: colores.bosque, fontSize: 27, fontWeight: '900' },
  locationActions: { width: '100%', flexDirection: Platform.OS === 'web' ? 'row' : 'column', flexWrap: 'wrap', gap: 10 },
};
