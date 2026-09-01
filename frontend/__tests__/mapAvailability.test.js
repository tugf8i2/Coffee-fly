import { isNativeMapAvailable } from '../src/config/mapAvailability';

describe('native map availability', () => {
  it('blocks the Android native map when no Google Maps key is configured', () => {
    expect(isNativeMapAvailable('android', false)).toBe(false);
  });

  it('allows the Android native map when a Google Maps key is configured', () => {
    expect(isNativeMapAvailable('android', true)).toBe(true);
  });

  it('allows the map supplied by Expo Go without requiring a project key', () => {
    expect(isNativeMapAvailable('android', false, true)).toBe(true);
  });

  it('does not require the Android key on other platforms', () => {
    expect(isNativeMapAvailable('ios', false)).toBe(true);
    expect(isNativeMapAvailable('web', false)).toBe(true);
  });
});
