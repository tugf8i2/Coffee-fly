import { registerRootComponent } from 'expo';
import { LogBox, Platform } from 'react-native';
import './src/estilos/global';

// Registra la tarea en el ámbito global antes de montar React. Es obligatorio
// para que el sistema operativo pueda iniciar únicamente el proceso GPS.
import './src/servicios/ubicacionSegundoPlano';
import App from './src/aplicacion/AplicacionPrincipal';

// Son avisos del entorno de desarrollo de Expo, no fallos funcionales de la
// aplicación. Los errores reales de Coffee Fly siguen visibles en pantalla.
if (__DEV__) {
  LogBox.ignoreLogs([
    'Cannot connect to Expo CLI',
    'SafeAreaView has been deprecated',
  ]);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// La PWA conserva el shell ya visitado para poder abrir la aplicacion sin red.
// En desarrollo se evita registrar el worker para no ocultar cambios del bundle.
if (!__DEV__ && Platform.OS === 'web' && 'serviceWorker' in navigator) {
  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = '/manifest.json';
  document.head.appendChild(manifest);
  const touchIcon = document.createElement('link');
  touchIcon.rel = 'apple-touch-icon';
  touchIcon.href = '/pwa-icon.png';
  document.head.appendChild(touchIcon);
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // La app sigue funcionando online aunque el navegador bloquee PWA/SW.
    });
  });
}
