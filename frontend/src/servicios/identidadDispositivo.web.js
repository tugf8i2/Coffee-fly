export async function deviceLoginInfo() {
  let deviceId = sessionStorage.getItem('coffee_fly.device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    sessionStorage.setItem('coffee_fly.device_id', deviceId);
  }
  return { device_id: deviceId, device_name: 'Navegador web', platform: 'web' };
}
