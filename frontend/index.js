import { registerRootComponent } from 'expo';

// Registra la tarea en el ámbito global antes de montar React. Es obligatorio
// para que el sistema operativo pueda iniciar únicamente el proceso GPS.
import './src/services/backgroundLocation';
import App from './src/FullApp';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
