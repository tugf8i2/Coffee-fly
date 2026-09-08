import { colores } from '../../estilos/colores';
import { crearEstilosModulo } from '../../estilos/crearEstilosModulo';

export const styles = crearEstilosModulo({
  loginPage: {
    flex: 1, position: 'relative', justifyContent: 'center', minHeight: 590, overflow: 'hidden',
    backgroundColor: colores.crema, maxWidth: '100%', paddingVertical: 38,
  },
  loginCard: {
    zIndex: 2, maxWidth: 480, padding: 26, borderTopWidth: 5, borderTopColor: colores.verde,
    shadowOpacity: .15, shadowRadius: 22, elevation: 7,
  },
  loginEyebrow: { color: '#6A994E', fontSize: 12, lineHeight: 17, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  loginDescription: { color: '#526451', fontSize: 15, lineHeight: 22, marginBottom: 4 },
  loginHelp: { color: '#526451', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 2 },
  loading: { opacity: 0.6 },
});
