import { Platform } from 'react-native';

import { colores } from '../colores';

export const estilosFormularios = {
  label: { fontWeight: '700', color: colores.bosque, marginBottom: 4 },
  field: { width: '100%', maxWidth: 620 },
  input: { width: '100%', maxWidth: 620, minHeight: 44, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(56,102,65,.32)', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: colores.tinta },
  textArea: { minHeight: 82, textAlignVertical: 'top' },
  formCard: { width: '100%', maxWidth: 680, alignSelf: 'center', backgroundColor: colores.blanco, borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: 'rgba(56,102,65,.12)' },
  formRow: { width: '100%', flexDirection: Platform.OS === 'web' ? 'row' : 'column', flexWrap: 'wrap', gap: 10 },
  primary: { backgroundColor: colores.bosque, paddingHorizontal: 16, paddingVertical: 11, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondary: { borderWidth: 2, borderColor: colores.verde, borderStyle: 'dashed', borderRadius: 9, padding: 11, alignItems: 'center' },
  secondaryText: { color: colores.bosque, fontWeight: '800' },
  removeLink: { color: colores.error, fontWeight: '700', paddingVertical: 5 },
  link: { color: colores.bosque, fontWeight: '800', textAlign: 'center', paddingVertical: 7 },
  error: { color: colores.error, fontWeight: '700' },
  success: { color: colores.exito, fontWeight: '700' },
  muted: { color: colores.textoSuave, fontSize: 14, lineHeight: 20 },
  readonly: { width: '100%', maxWidth: 620, backgroundColor: '#EEF4D5', color: colores.bosque, padding: 10, borderRadius: 8, fontWeight: '700' },
  buttonDisabled: { backgroundColor: '#879689', opacity: .72 },
};
