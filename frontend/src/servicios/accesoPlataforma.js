export const MENSAJE_CONDUCTOR_SOLO_MOVIL = 'Recuerda que el perfil de conductor solo está disponible en la aplicación móvil Coffee Fly para Android y iOS. Inicia sesión desde Expo o desde el APK cuando esté disponible.';

export function accesoPermitidoEnPlataforma(role, platform) {
  return !(platform === 'web' && String(role || '').toLowerCase() === 'conductor');
}
