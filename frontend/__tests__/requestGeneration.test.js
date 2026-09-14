import { createLatestRequestController } from '../src/servicios/controlSolicitudes';

describe('coordinación de solicitudes', () => {
  test('solo considera vigente la generación más reciente', () => {
    const requests = createLatestRequestController();
    const first = requests.start();
    const second = requests.start();

    expect(first.signal.aborted).toBe(true);
    expect(requests.isCurrent(first)).toBe(false);
    expect(requests.isCurrent(second)).toBe(true);
  });

  test('invalidar cancela la solicitud actual', () => {
    const requests = createLatestRequestController();
    const current = requests.start();
    requests.invalidate();

    expect(current.signal.aborted).toBe(true);
    expect(requests.isCurrent(current)).toBe(false);
  });
});
