import { crearEstilosModulo } from '../../estilos/crearEstilosModulo';

export const styles = crearEstilosModulo({
  fullWidthInput: { width: '100%' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fileInput: { marginBottom: 8 },
  licensePreview: { width: 180, height: 110, resizeMode: 'contain', alignSelf: 'flex-start' },
});
