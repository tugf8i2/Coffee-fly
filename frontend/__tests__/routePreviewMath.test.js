import { lineBetween, projectCoordinates, sampleCoordinates } from '../src/components/routePreviewMath';

describe('offline route preview geometry', () => {
  test('downsamples a long route while preserving its endpoints', () => {
    const route = Array.from({ length: 500 }, (_, index) => ({ latitude: index, longitude: index }));
    const sampled = sampleCoordinates(route, 120);
    expect(sampled).toHaveLength(120);
    expect(sampled[0]).toBe(route[0]);
    expect(sampled.at(-1)).toBe(route.at(-1));
  });

  test('projects coordinates inside the drawing area', () => {
    const projected = projectCoordinates([
      { latitude: 4, longitude: -75 },
      { latitude: 5, longitude: -74 },
    ], 300, 250, 25);
    expect(projected).toEqual([{ x: 25, y: 225 }, { x: 275, y: 25 }]);
  });

  test('builds a centered line segment between two projected points', () => {
    const line = lineBetween({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(line.width).toBe(5);
    expect(line.left).toBe(-1);
    expect(line.top).toBe(0.5);
  });
});
