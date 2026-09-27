export function mapaSinConexionConfigurado() {
  return false;
}

export async function obtenerEstadoMapaSinConexion() {
  return {
    disponible: false,
    listo: false,
    progreso: 0,
    motivo: 'La descarga regional esta disponible en la aplicacion movil instalada.',
  };
}

export async function prepararMapaSinConexion() {
  throw new Error('La descarga regional esta disponible en la aplicacion movil instalada.');
}

export async function eliminarMapaSinConexion() {}
