import { Platform } from 'react-native';
import { coordinatorModuleStyles } from '../coordinador/Coordinador.styles';

// Comparte los controles del coordinador sin alterar la presentación nativa.
export const estilosOperativos = Platform.OS === 'web' ? Object.fromEntries(
  Object.entries({
    ...coordinatorModuleStyles,
    page: { ...coordinatorModuleStyles.page, maxWidth: 1500, padding: 20, paddingBottom: 32 },
  }).map(([key, value]) => [key, value.fontSize ? { ...value, fontFamily: 'Registrar' } : value]),
) : {};
