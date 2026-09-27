function normalizePoint(point, baseTimestamp) {
  const latitude = Number(point?.latitude);
  const longitude = Number(point?.longitude);
  const offsetMs = Math.max(0, Number(point?.offsetMs) || 0);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    timestamp: baseTimestamp + offsetMs,
    coords: {
      latitude,
      longitude,
      accuracy: Math.max(0, Number(point.accuracy) || 0),
      altitude: point.altitude == null ? null : Number(point.altitude),
      altitudeAccuracy: point.altitudeAccuracy == null ? null : Number(point.altitudeAccuracy),
      speed: point.speed == null ? null : Math.max(0, Number(point.speed)),
      heading: point.heading == null ? null : Number(point.heading),
    },
  };
}

export function createGpsRouteSimulator(trace, options = {}) {
  const source = Array.isArray(trace) ? trace : trace?.points;
  const points = (source || [])
    .filter((point) => Number.isFinite(Number(point?.offsetMs)))
    .sort((a, b) => Number(a.offsetMs) - Number(b.offsetMs));
  const speed = Math.max(0.1, Number(options.speed) || 1);
  let index = 0;
  let timer = null;
  let running = false;
  let baseTimestamp = Number(options.baseTimestamp) || Date.now();

  const clear = () => {
    if (timer != null) clearTimeout(timer);
    timer = null;
  };
  const emit = () => {
    if (index >= points.length) {
      running = false;
      options.onEnd?.();
      return null;
    }
    const point = normalizePoint(points[index], baseTimestamp);
    index += 1;
    if (point) options.onPosition?.(point, index - 1);
    return point;
  };
  const schedule = () => {
    if (!running) return;
    const emittedIndex = index;
    emit();
    if (!running || index >= points.length) return;
    const delay = Math.max(0, (Number(points[index].offsetMs) - Number(points[emittedIndex].offsetMs)) / speed);
    timer = setTimeout(schedule, delay);
  };

  return {
    start() {
      if (running || !points.length) return;
      running = true;
      const currentOffset = Number(points[index]?.offsetMs || 0);
      baseTimestamp = Date.now() - currentOffset;
      schedule();
    },
    pause() {
      running = false;
      clear();
    },
    reset() {
      running = false;
      clear();
      index = 0;
      baseTimestamp = Number(options.baseTimestamp) || Date.now();
    },
    seek(nextIndex) {
      index = Math.max(0, Math.min(points.length, Math.floor(Number(nextIndex) || 0)));
    },
    step() {
      return emit();
    },
    state() {
      return { index, total: points.length, running, finished: index >= points.length };
    },
  };
}
