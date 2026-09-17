import { crearEstilosModulo } from '../../estilos/crearEstilosModulo';

export const styles = crearEstilosModulo({
  fullWidthInput: { width: '100%' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fileInput: { marginBottom: 8 },
  licensePreview: { width: 180, height: 110, resizeMode: 'contain', alignSelf: 'flex-start' },
  profilePreview: { width: 88, height: 88, borderRadius: 44, resizeMode: 'cover', alignSelf: 'flex-start' },
});
