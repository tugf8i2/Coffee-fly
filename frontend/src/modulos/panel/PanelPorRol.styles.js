import { crearEstilosModulo } from '../../estilos/crearEstilosModulo';

export const styles = crearEstilosModulo({
  dashboardIntro: { backgroundColor: '#EEF4D5', borderRadius: 14, borderLeftWidth: 5, borderLeftColor: '#6A994E', padding: 18, gap: 5 },
  dashboardEyebrow: { color: '#6A994E', fontSize: 12, lineHeight: 17, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  dashboardStatus: { marginTop: 2 },
  actionCard: { minHeight: 142, justifyContent: 'space-between' },
  actionTop: { gap: 9 },
  actionIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4D5' },
  actionIconText: { color: '#386641', fontSize: 20, fontWeight: '900' },
  actionDescription: { color: '#526451', fontSize: 13, lineHeight: 19 },
  actionLinkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  actionArrow: { color: '#6A994E', fontSize: 20, fontWeight: '900' },
  refreshButton: { alignSelf: 'flex-start', minWidth: 190 },
});
