import { StyleSheet } from 'react-native';

import { estilosEstructura } from './secciones/estructura';
import { estilosFormularios } from './secciones/formularios';
import { estilosOperacion } from './secciones/operacion';
import { estilosTarjetas } from './secciones/tarjetas';

export const styles = StyleSheet.create({
  ...estilosEstructura,
  ...estilosFormularios,
  ...estilosTarjetas,
  ...estilosOperacion,
});
