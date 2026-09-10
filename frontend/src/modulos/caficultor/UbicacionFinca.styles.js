import { crearEstilosModulo } from '../../estilos/crearEstilosModulo';

export const styles = crearEstilosModulo({
  suggestions: { borderWidth: 1, borderColor: '#cbd8ca', borderRadius: 12, overflow: 'hidden' },
  suggestion: { padding: 13, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e8efe9' },
  suggestionText: { color: '#233323' },
  attribution: { color: '#526451', fontSize: 11, textAlign: 'center' },
});
