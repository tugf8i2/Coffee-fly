import { StyleSheet } from 'react-native';

import { estilosEstructura } from './secciones/estructura';
import { estilosFormularios } from './secciones/formularios';
import { estilosOperacion } from './secciones/operacion';
import { estilosTarjetas } from './secciones/tarjetas';
import { aplicarTemaGlobal } from './temaGlobal';

export const crearEstilosModulo = (estilosPropios = {}) => {
  const base = StyleSheet.create({
  ...estilosEstructura,
  ...estilosFormularios,
  ...estilosTarjetas,
  ...estilosOperacion,
  ...estilosPropios,
  });
  return new Proxy(base, {
    get(target, property) {
      return aplicarTemaGlobal(property, target[property]);
    },
  });
};
