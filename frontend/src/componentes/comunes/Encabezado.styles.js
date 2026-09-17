import { crearEstilosModulo } from '../../estilos/crearEstilosModulo';

export const styles = crearEstilosModulo({
  compactInner: { alignItems: 'stretch', gap: 10 },
  compactBrand: { width: '100%', minWidth: 0 },
  compactActions: { width: '100%', flexWrap: 'nowrap', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.18)', paddingTop: 10 },
  compactUser: { flex: 1, minWidth: 0, borderLeftWidth: 0, paddingHorizontal: 0 },
  loginHeader: { minHeight: 124, paddingVertical: 16 },
  loginBrandGroup: { width: '100%', justifyContent: 'center', gap: 16 },
  loginLogo: { width: 88, height: 88 },
  loginBrand: { fontSize: 25, lineHeight: 31, letterSpacing: 3 },
  loginHeaderContext: { fontSize: 14, lineHeight: 20 },
});
