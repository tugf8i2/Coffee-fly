import { createClientUuid } from './idCliente';

const DEVICE_ID_KEY = 'coffee-fly:device-id:v1';

export async function identificarDispositivo() {
  let id;
  try {
    id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = createClientUuid();
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
  } catch {
    id = createClientUuid();
  }
  const agent = navigator.userAgent || '';
  const androidModel = agent.match(/Android[^;)]*;\s*([^;)]+?)(?:\s+Build\/|\))/i)?.[1]?.trim();
  const isAndroid = /Android/i.test(agent);
  return {
    device_id: id,
    device_name: isAndroid ? `Android${androidModel ? ` · ${androidModel}` : ''}` : /iPhone|iPad/i.test(agent) ? 'iPhone/iPad' : 'Navegador web',
    device_platform: isAndroid ? 'Android WebView' : /iPhone|iPad/i.test(agent) ? 'iOS WebView' : 'Web',
  };
}
