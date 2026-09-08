import { Platform } from 'react-native';

import { colores } from '../colores';

export const estilosFormularios = {
  label: { fontSize: 14, lineHeight: 19, fontWeight: '800', color: colores.bosque, marginBottom: 5 },
  field: { width: '100%', maxWidth: 620, gap: 2 },
  input: { width: '100%', maxWidth: 620, minHeight: 48, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(56,102,65,.38)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colores.tinta },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  formCard: { width: '100%', maxWidth: 700, alignSelf: 'center', backgroundColor: colores.blanco, borderRadius: 16, padding: 21, gap: 12, borderWidth: 1, borderColor: 'rgba(56,102,65,.16)', shadowColor: '#1d3322', shadowOpacity: .07, shadowRadius: 10, elevation: 2 },
  formRow: { width: '100%', flexDirection: Platform.OS === 'web' ? 'row' : 'column', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 },
  primary: { backgroundColor: colores.bosque, paddingHorizontal: 18, paddingVertical: 12, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', shadowColor: '#1d3322', shadowOpacity: .1, shadowRadius: 5, elevation: 2 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15, lineHeight: 20, textAlign: 'center' },
  secondary: { backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.verde, borderRadius: 10, paddingHorizontal: 17, paddingVertical: 11, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colores.bosque, fontWeight: '800' },
  removeLink: { color: colores.error, fontWeight: '700', paddingVertical: 5 },
  link: { color: colores.bosque, fontWeight: '800', textAlign: 'center', paddingVertical: 9, textDecorationLine: 'underline' },
  error: { color: colores.error, fontWeight: '700' },
  success: { color: colores.exito, fontWeight: '700' },
  muted: { color: colores.textoSuave, fontSize: 14, lineHeight: 21 },
  readonly: { width: '100%', maxWidth: 620, backgroundColor: '#EEF4D5', color: colores.bosque, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 9, fontWeight: '700', borderWidth: 1, borderColor: 'rgba(56,102,65,.16)' },
  buttonDisabled: { backgroundColor: '#879689', opacity: .64, shadowOpacity: 0, elevation: 0 },
};
