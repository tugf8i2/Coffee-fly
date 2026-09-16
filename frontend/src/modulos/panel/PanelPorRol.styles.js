import { crearEstilosModulo } from '../../estilos/crearEstilosModulo';

export const styles = crearEstilosModulo({
  dashboardIntro: { backgroundColor: '#E8F2EB', borderRadius: 16, borderWidth: 1, borderColor: '#D2E4D7', padding: 24, gap: 8 },
  dashboardEyebrow: { color: '#287457', fontSize: 12, lineHeight: 17, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  dashboardStatus: { marginTop: 2 },
  actionCard: { minHeight: 194, justifyContent: 'space-between' },
  actionTop: { gap: 9 },
  actionIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4D5' },
  actionIconText: { color: '#386641', fontSize: 20, fontWeight: '900' },
  actionDescription: { color: '#526451', fontSize: 14, lineHeight: 21 },
  actionLinkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  actionArrow: { color: '#6A994E', fontSize: 20, fontWeight: '900' },
  refreshButton: { alignSelf: 'flex-start', minWidth: 190 },
  secondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B7CBBE', borderRadius: 10, minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#123F34', fontWeight: '700', textAlign: 'center' },
});
