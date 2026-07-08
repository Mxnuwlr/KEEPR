import { registerRootComponent } from 'expo';

// TEMP-DEBUG: Komponenten-Stack für "Text strings"-Fehler ins Metro-Log schreiben
const __origError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Text strings must be rendered')) {
    __origError('TEXT-ERR ARGS:', args.map(a => String(a)).join(' ||| '));
  }
  __origError(...args);
};

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
