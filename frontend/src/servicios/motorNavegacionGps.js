const EARTH_RADIUS_M = 6371000;

export const NAVIGATION_GPS_DEFAULTS = Object.freeze({
  maxAccuracyM: 100,
  maxAgeMs: 30000,
  maxFutureMs: 10000,
  maxSpeedMps: 60,
  resetGapS: 30,
  maxSnapM: 50,
  minimumHeadingSpeedMps: 1.5,
  predictionMaxAgeMs: 3000,
  predictionMaxDistanceM: 20,
  predictionMinimumSpeedMps: 0.4,
  stationarySpeedMps: 0.4,
});

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const radians = (value) => value * Math.PI / 180;
const degrees = (value) => value * 180 / Math.PI;
const normalizeHeading = (value) => ((value % 360) + 360) % 360;
export const headingDifference = (first, second) => Math.abs(((first - second + 540) % 360) - 180);

const coordinateDistance = (first, second) => {
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
};

const normalizeMeasurement = (position) => ({
  timestampMs: Number(position?.timestamp || Date.now()),
  latitude: Number(position?.coords?.latitude),
  longitude: Number(position?.coords?.longitude),
  accuracyM: Number.isFinite(position?.coords?.accuracy) && position.coords.accuracy >= 0 ? Number(position.coords.accuracy) : null,
  speedMps: Number.isFinite(position?.coords?.speed) && position.coords.speed >= 0 ? Number(position.coords.speed) : null,
  headingDeg: Number.isFinite(position?.coords?.heading) && position.coords.heading >= 0 && position.coords.heading <= 360
    ? normalizeHeading(Number(position.coords.heading)) : null,
});

export function validateNavigationMeasurement(measurement, previous, nowMs = Date.now(), config = NAVIGATION_GPS_DEFAULTS) {
  if (!Number.isFinite(measurement.latitude) || measurement.latitude < -90 || measurement.latitude > 90
    || !Number.isFinite(measurement.longitude) || measurement.longitude < -180 || measurement.longitude > 180) {
    return { valid: false, code: 'invalid-coordinate' };
  }
  if (!Number.isFinite(measurement.accuracyM)) return { valid: false, code: 'missing-accuracy' };
  if (measurement.accuracyM > config.maxAccuracyM) return { valid: false, code: 'poor-accuracy' };
  if (!Number.isFinite(measurement.timestampMs) || measurement.timestampMs <= 0) return { valid: false, code: 'invalid-timestamp' };
  if (measurement.timestampMs > nowMs + config.maxFutureMs) return { valid: false, code: 'future-timestamp' };
  if (measurement.timestampMs < nowMs - config.maxAgeMs) return { valid: false, code: 'stale' };
  if (measurement.speedMps != null && measurement.speedMps > config.maxSpeedMps) return { valid: false, code: 'invalid-speed' };
  if (!previous) return { valid: true, code: 'ok', distanceM: null, elapsedS: null };
  const elapsedS = (measurement.timestampMs - previous.timestampMs) / 1000;
  if (elapsedS <= 0) return { valid: false, code: 'out-of-order' };
  const distanceM = coordinateDistance(previous, measurement);
  const uncertaintyM = Math.hypot(previous.accuracyM || 0, measurement.accuracyM || 0) * 2;
  const impliedSpeedMps = Math.max(0, distanceM - uncertaintyM) / elapsedS;
  if (impliedSpeedMps > config.maxSpeedMps) {
    return { valid: false, code: 'impossible-jump', distanceM, elapsedS, impliedSpeedMps };
  }
  return { valid: true, code: 'ok', distanceM, elapsedS, impliedSpeedMps };
}

const toLocal = (coordinate, origin) => ({
  east: EARTH_RADIUS_M * radians(coordinate.longitude - origin.longitude) * Math.cos(radians(origin.latitude)),
  north: EARTH_RADIUS_M * radians(coordinate.latitude - origin.latitude),
});

const toCoordinate = (point, origin) => ({
  latitude: origin.latitude + degrees(point.north / EARTH_RADIUS_M),
  longitude: origin.longitude + degrees(point.east / (EARTH_RADIUS_M * Math.cos(radians(origin.latitude)))),
});

const createAxis = (position, velocity, variance, velocityVariance) => ({
  position, velocity, p00: variance, p01: 0, p10: 0, p11: velocityVariance,
});

const updateAxis = (axis, measurement, measurementVariance, elapsedS, accelerationSigma) => {
  const elapsed2 = elapsedS ** 2;
  const noise = accelerationSigma ** 2;
  const predictedPosition = axis.position + axis.velocity * elapsedS;
  const p00 = axis.p00 + elapsedS * (axis.p01 + axis.p10) + elapsed2 * axis.p11 + noise * elapsed2 ** 2 / 4;
  const p01 = axis.p01 + elapsedS * axis.p11 + noise * elapsedS * elapsed2 / 2;
  const p10 = axis.p10 + elapsedS * axis.p11 + noise * elapsedS * elapsed2 / 2;
  const p11 = axis.p11 + noise * elapsed2;
  const innovation = measurement - predictedPosition;
  const innovationVariance = p00 + measurementVariance;
  const positionGain = p00 / innovationVariance;
  const velocityGain = p10 / innovationVariance;
  const nextP01 = (1 - positionGain) * p01;
  const nextP10 = p10 - velocityGain * p00;
  return {
    position: predictedPosition + positionGain * innovation,
    velocity: axis.velocity + velocityGain * innovation,
    p00: Math.max(0, (1 - positionGain) * p00),
    p01: (nextP01 + nextP10) / 2,
    p10: (nextP01 + nextP10) / 2,
    p11: Math.max(0, p11 - velocityGain * p01),
  };
};

export function projectPointOnSegment(point, start, end) {
  const deltaEast = end.east - start.east;
  const deltaNorth = end.north - start.north;
  const lengthSquared = deltaEast ** 2 + deltaNorth ** 2;
  const fraction = lengthSquared === 0 ? 0 : clamp(
    ((point.east - start.east) * deltaEast + (point.north - start.north) * deltaNorth) / lengthSquared,
    0,
    1,
  );
  const projection = { east: start.east + deltaEast * fraction, north: start.north + deltaNorth * fraction };
  return { ...projection, fraction, distanceM: Math.hypot(point.east - projection.east, point.north - projection.north) };
}

const prepareRoute = (points, origin) => {
  const coordinates = (points || []).filter((point) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude));
  const local = coordinates.map((point) => toLocal(point, origin));
  const segments = [];
  let cumulativeM = 0;
  for (let index = 0; index < local.length - 1; index += 1) {
    const start = local[index];
    const end = local[index + 1];
    const lengthM = Math.hypot(end.east - start.east, end.north - start.north);
    if (lengthM < 0.25) continue;
    segments.push({
      index,
      start,
      end,
      lengthM,
      startDistanceM: cumulativeM,
      bearingDeg: normalizeHeading(degrees(Math.atan2(end.east - start.east, end.north - start.north))),
    });
    cumulativeM += lengthM;
  }
  return { coordinates, segments, totalLengthM: cumulativeM };
};

const pointAtRouteDistance = (route, distanceM) => {
  const target = clamp(distanceM, 0, route.totalLengthM);
  const segment = route.segments.find((item) => target <= item.startDistanceM + item.lengthM)
    || route.segments[route.segments.length - 1];
  if (!segment) return null;
  const fraction = clamp((target - segment.startDistanceM) / segment.lengthM, 0, 1);
  return {
    east: segment.start.east + (segment.end.east - segment.start.east) * fraction,
    north: segment.start.north + (segment.end.north - segment.start.north) * fraction,
  };
};

export function createNavigationEngine(options = {}) {
  const config = { ...NAVIGATION_GPS_DEFAULTS, ...options };
  let origin = null;
  let route = null;
  let previousMeasurement = null;
  let filter = null;
  let match = { status: 'unmatched', segmentIndex: null, routeDistanceM: null, goodCount: 0, badCount: 0, offRouteSinceMs: null };
  let lastOutput = null;

  const setRoute = (points) => {
    if (!origin && points?.length) origin = { latitude: points[0].latitude, longitude: points[0].longitude };
    route = origin ? prepareRoute(points, origin) : null;
    match = { status: 'unmatched', segmentIndex: null, routeDistanceM: null, goodCount: 0, badCount: 0, offRouteSinceMs: null };
    return route;
  };

  const findMatch = (point, headingDeg, speedMps, accuracyM, elapsedS) => {
    if (!route?.segments.length) return null;
    const hasPrevious = match.segmentIndex != null;
    const start = hasPrevious ? Math.max(0, match.segmentIndex - 60) : 0;
    const end = hasPrevious ? Math.min(route.segments.length, match.segmentIndex + 121) : route.segments.length;
    const expectedDistance = match.routeDistanceM == null ? null : match.routeDistanceM + speedMps * elapsedS;
    let best = null;
    for (let index = start; index < end; index += 1) {
      const segment = route.segments[index];
      const projected = projectPointOnSegment(point, segment.start, segment.end);
      if (projected.distanceM > config.maxSnapM) continue;
      const routeDistanceM = segment.startDistanceM + projected.fraction * segment.lengthM;
      const bearingDelta = headingDeg == null ? 0 : headingDifference(headingDeg, segment.bearingDeg);
      const distanceSigma = clamp(accuracyM, 5, 30);
      let score = (projected.distanceM / distanceSigma) ** 2;
      if (speedMps >= config.minimumHeadingSpeedMps) score += 0.75 * (bearingDelta / 35) ** 2;
      if (expectedDistance != null) score += 0.5 * ((routeDistanceM - expectedDistance) / Math.max(20, speedMps * elapsedS + 10)) ** 2;
      if (match.routeDistanceM != null && routeDistanceM < match.routeDistanceM - Math.max(15, accuracyM * 2)) {
        score += ((match.routeDistanceM - routeDistanceM) / 10) ** 2;
      }
      if (!best || score < best.score) best = { ...projected, segmentIndex: index, routeDistanceM, bearingDelta, score };
    }
    if (best && hasPrevious && Math.abs(best.segmentIndex - match.segmentIndex) > 20) {
      const incumbentSegment = route.segments[match.segmentIndex];
      const incumbent = projectPointOnSegment(point, incumbentSegment.start, incumbentSegment.end);
      const incumbentScore = (incumbent.distanceM / clamp(accuracyM, 5, 30)) ** 2;
      if (incumbent.distanceM <= config.maxSnapM && best.score > incumbentScore - 2) {
        return {
          ...incumbent,
          segmentIndex: match.segmentIndex,
          routeDistanceM: incumbentSegment.startDistanceM + incumbent.fraction * incumbentSegment.lengthM,
          bearingDelta: headingDeg == null ? 0 : headingDifference(headingDeg, incumbentSegment.bearingDeg),
          score: incumbentScore,
        };
      }
    }
    return best;
  };

  const pushLocation = (position, nowMs = Date.now()) => {
    const measurement = normalizeMeasurement(position);
    const validation = validateNavigationMeasurement(measurement, previousMeasurement, nowMs, config);
    if (!validation.valid) return { accepted: false, validation, previous: lastOutput };
    if (!origin) origin = { latitude: measurement.latitude, longitude: measurement.longitude };
    const measured = toLocal(measurement, origin);
    const elapsedS = previousMeasurement ? (measurement.timestampMs - previousMeasurement.timestampMs) / 1000 : 0;
    const reset = !filter || elapsedS >= config.resetGapS;
    if (reset) {
      const speed = measurement.speedMps || 0;
      const hasCourse = speed > 0 && measurement.headingDeg != null;
      const heading = radians(measurement.headingDeg || 0);
      const variance = Math.max(3, measurement.accuracyM) ** 2;
      filter = {
        timestampMs: measurement.timestampMs,
        east: createAxis(measured.east, hasCourse ? speed * Math.sin(heading) : 0, variance, hasCourse ? 9 : 400),
        north: createAxis(measured.north, hasCourse ? speed * Math.cos(heading) : 0, variance, hasCourse ? 9 : 400),
      };
    } else {
      const reportedSpeed = measurement.speedMps ?? Math.hypot(filter.east.velocity, filter.north.velocity);
      const accelerationSigma = reportedSpeed >= 5 ? 4.5 : reportedSpeed >= 1 ? 2.5 : 0.8;
      const responsiveAccuracy = reportedSpeed >= 5
        ? measurement.accuracyM * 0.5
        : reportedSpeed >= 1 ? measurement.accuracyM * 0.75 : measurement.accuracyM;
      const measurementVariance = Math.max(3, responsiveAccuracy) ** 2;
      filter = {
        timestampMs: measurement.timestampMs,
        east: updateAxis(filter.east, measured.east, measurementVariance, elapsedS, accelerationSigma),
        north: updateAxis(filter.north, measured.north, measurementVariance, elapsedS, accelerationSigma),
      };
      // El GPS del teléfono ya fusiona satélites y sensores. Cuando entrega una
      // velocidad y rumbo fiables, incorporarlos de inmediato evita que el
      // filtro quede varios metros detrás al acelerar o doblar una esquina.
      if (reportedSpeed >= config.minimumHeadingSpeedMps && measurement.headingDeg != null) {
        const heading = radians(measurement.headingDeg);
        const velocityTrust = clamp(0.45 + reportedSpeed / 25, 0.45, 0.8);
        const measuredEastVelocity = reportedSpeed * Math.sin(heading);
        const measuredNorthVelocity = reportedSpeed * Math.cos(heading);
        filter.east.velocity = filter.east.velocity * (1 - velocityTrust) + measuredEastVelocity * velocityTrust;
        filter.north.velocity = filter.north.velocity * (1 - velocityTrust) + measuredNorthVelocity * velocityTrust;
      } else if (measurement.speedMps != null && measurement.speedMps < config.stationarySpeedMps) {
        // Evita que el ruido de posición mantenga una velocidad ficticia al detenerse.
        filter.east.velocity *= 0.25;
        filter.north.velocity *= 0.25;
      }
    }
    const filteredLocal = { east: filter.east.position, north: filter.north.position };
    const estimatedSpeed = clamp(Math.hypot(filter.east.velocity, filter.north.velocity), 0, config.maxSpeedMps);
    const movementHeading = measurement.speedMps != null && measurement.speedMps < config.stationarySpeedMps
      ? (lastOutput?.headingDeg ?? measurement.headingDeg)
      : estimatedSpeed >= config.minimumHeadingSpeedMps
      ? normalizeHeading(degrees(Math.atan2(filter.east.velocity, filter.north.velocity)))
      : measurement.headingDeg;
    const candidate = findMatch(filteredLocal, movementHeading, estimatedSpeed, measurement.accuracyM, Math.max(0, elapsedS));
    const enterDistance = clamp(measurement.accuracyM, 12, 30);
    const exitDistance = clamp(measurement.accuracyM * 1.5, 25, 50);
    const good = candidate && candidate.distanceM <= enterDistance
      && (estimatedSpeed < config.minimumHeadingSpeedMps || candidate.bearingDelta <= 75);
    if (good) {
      const previousStatus = match.status;
      match.goodCount += 1;
      match.badCount = 0;
      if (previousStatus === 'uncertain') {
        match.status = 'on-route';
        match.goodCount = 2;
        match.offRouteSinceMs = null;
      } else if (match.goodCount >= 2) {
        match.status = 'on-route';
        match.offRouteSinceMs = null;
      } else if (previousStatus !== 'off-route') {
        match.status = 'acquiring';
      }
    } else {
      match.goodCount = 0;
      match.badCount += 1;
      if (match.status === 'on-route' || match.status === 'uncertain') match.status = match.badCount >= 3 ? 'off-route' : 'uncertain';
      else if (match.badCount >= 3) match.status = 'off-route';
      if (match.status === 'off-route' && match.offRouteSinceMs == null) match.offRouteSinceMs = measurement.timestampMs;
    }
    if (candidate) {
      match.segmentIndex = candidate.segmentIndex;
      match.routeDistanceM = candidate.routeDistanceM;
    }
    const maySnap = candidate && candidate.distanceM <= exitDistance
      && (match.status === 'on-route' || match.status === 'uncertain');
    const displayLocal = maySnap ? { east: candidate.east, north: candidate.north } : filteredLocal;
    previousMeasurement = measurement;
    lastOutput = {
      accepted: true,
      timestampMs: measurement.timestampMs,
      raw: { latitude: measurement.latitude, longitude: measurement.longitude },
      filtered: toCoordinate(filteredLocal, origin),
      display: toCoordinate(displayLocal, origin),
      speedMps: estimatedSpeed,
      headingDeg: movementHeading,
      accuracyM: measurement.accuracyM,
      displaySource: maySnap ? 'matched' : 'filtered',
      routeStatus: match.status,
      segmentIndex: match.segmentIndex,
      routeDistanceM: match.routeDistanceM,
      distanceFromRouteM: candidate?.distanceM ?? null,
      remainingRouteM: match.routeDistanceM == null ? null : Math.max(0, route.totalLengthM - match.routeDistanceM),
      rerouteSuggested: match.status === 'off-route' && match.offRouteSinceMs != null
        && measurement.timestampMs - match.offRouteSinceMs >= 10000,
      validation,
    };
    return lastOutput;
  };

  const predictDisplay = (timestampMs = Date.now()) => {
    if (!lastOutput || !filter) return lastOutput;
    const ageMs = Math.max(0, timestampMs - filter.timestampMs);
    const speedMps = Math.hypot(filter.east.velocity, filter.north.velocity);
    if (ageMs >= config.predictionMaxAgeMs || speedMps < config.predictionMinimumSpeedMps) return lastOutput;
    const advanceM = Math.min(config.predictionMaxDistanceM, speedMps * ageMs / 1000);
    let predictedLocal;
    if (route && match.routeDistanceM != null && lastOutput.displaySource === 'matched') {
      predictedLocal = pointAtRouteDistance(route, match.routeDistanceM + advanceM);
    } else {
      predictedLocal = {
        east: filter.east.position + filter.east.velocity / speedMps * advanceM,
        north: filter.north.position + filter.north.velocity / speedMps * advanceM,
      };
    }
    return {
      ...lastOutput,
      timestampMs,
      display: toCoordinate(predictedLocal, origin),
      displaySource: lastOutput.displaySource === 'matched' ? 'predicted-matched' : 'predicted-filtered',
      remainingRouteM: lastOutput.remainingRouteM == null ? null : Math.max(0, lastOutput.remainingRouteM - advanceM),
      predicted: true,
    };
  };

  return {
    pushLocation,
    predictDisplay,
    reset: () => {
      origin = null; route = null; previousMeasurement = null; filter = null; lastOutput = null;
      match = { status: 'unmatched', segmentIndex: null, routeDistanceM: null, goodCount: 0, badCount: 0, offRouteSinceMs: null };
    },
    setRoute,
  };
}
