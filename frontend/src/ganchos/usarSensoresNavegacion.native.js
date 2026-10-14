import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';

import { devicePosture, fuseNavigationHeading, verticalTurnRate } from '../servicios/sensoresNavegacion';

const INITIAL_STATE = Object.freeze({
  active: false,
  motionAvailable: null,
  gravity: { x: 0, y: 0, z: 0 },
  rotationRate: { alpha: 0, beta: 0, gamma: 0 },
  orientation: 0,
  posture: 'orientación pendiente',
  headingDeg: null,
  headingSource: 'unavailable',
  compassAccuracy: 0,
});

export default function useNavigationSensors({ active, gpsHeading, speedMps }) {
  const [state, setState] = useState(INITIAL_STATE);
  const inputsRef = useRef({ gpsHeading, speedMps });
  const compassRef = useRef({ heading: null, accuracy: 0 });
  const headingRef = useRef(null);
  const lastMotionAtRef = useRef(null);
  const gravityRef = useRef(null);
  inputsRef.current = { gpsHeading, speedMps };

  useEffect(() => {
    if (Number(speedMps) >= 1.5 && gpsHeading != null && gpsHeading !== '' && Number.isFinite(Number(gpsHeading))
      && (headingRef.current == null || state.motionAvailable === false)) {
      headingRef.current = Number(gpsHeading);
    }
  }, [gpsHeading, speedMps, state.motionAvailable]);

  useEffect(() => {
    if (!active) {
      setState((current) => ({ ...INITIAL_STATE, headingDeg: current.headingDeg }));
      return undefined;
    }

    let disposed = false;
    let motionSubscription;
    let headingSubscription;
    const compassUsable = () => {
      const gravity = gravityRef.current;
      if (!gravity) return true;
      const magnitude = Math.hypot(gravity.x, gravity.y, gravity.z);
      return magnitude < 3 || Math.abs(gravity.z) / magnitude >= 0.3;
    };
    const applyHeading = ({ gyroYawDegPerSecond = null, compassUpdated = false } = {}) => {
      const now = Date.now();
      const previousAt = lastMotionAtRef.current;
      const useCompass = compassUsable();
      if (gyroYawDegPerSecond != null) lastMotionAtRef.current = now;
      const fused = fuseNavigationHeading({
        gpsHeading: inputsRef.current.gpsHeading,
        speedMps: inputsRef.current.speedMps,
        compassHeading: useCompass ? compassRef.current.heading : null,
        compassAccuracy: useCompass ? compassRef.current.accuracy : 0,
        previousHeading: headingRef.current,
        gyroYawDegPerSecond,
        deltaSeconds: gyroYawDegPerSecond != null && previousAt ? (now - previousAt) / 1000 : 0,
        compassUpdated,
      });
      headingRef.current = fused.headingDeg;
      return fused;
    };

    const start = async () => {
      try {
        const motionAvailable = await DeviceMotion.isAvailableAsync();
        if (disposed) return;
        setState((current) => ({ ...current, active: true, motionAvailable }));
        if (motionAvailable) {
          const permission = await DeviceMotion.requestPermissionsAsync();
          if (disposed) return;
          if (permission.granted) {
            DeviceMotion.setUpdateInterval(200);
            motionSubscription = DeviceMotion.addListener((measurement) => {
              if (disposed) return;
              const measuredGravity = measurement.accelerationIncludingGravity || INITIAL_STATE.gravity;
              const gravity = gravityRef.current
                ? Object.fromEntries(['x', 'y', 'z'].map((axis) => [
                    axis, gravityRef.current[axis] * 0.8 + measuredGravity[axis] * 0.2,
                  ]))
                : measuredGravity;
              gravityRef.current = gravity;
              const rotationRate = measurement.rotationRate || INITIAL_STATE.rotationRate;
              const fused = applyHeading({ gyroYawDegPerSecond: verticalTurnRate(rotationRate, gravity, Platform.OS) });
              setState((current) => ({
                ...current,
                active: true,
                motionAvailable: true,
                gravity,
                rotationRate,
                orientation: measurement.orientation,
                posture: devicePosture(measurement.orientation, gravity),
                headingDeg: fused.headingDeg,
                headingSource: fused.source,
              }));
            });
          } else {
            setState((current) => ({ ...current, active: true, motionAvailable: false }));
          }
        }
      } catch {
        if (!disposed) setState((current) => ({ ...current, active: true, motionAvailable: false }));
      }

      try {
        headingSubscription = await Location.watchHeadingAsync((heading) => {
          if (disposed) return;
          const compassHeading = heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading;
          compassRef.current = { heading: compassHeading, accuracy: heading.accuracy };
          const fused = applyHeading({ compassUpdated: true });
          setState((current) => ({
            ...current,
            active: true,
            compassAccuracy: heading.accuracy,
            headingDeg: fused.headingDeg,
            headingSource: fused.source,
          }));
        });
        if (disposed) headingSubscription?.remove();
      } catch {
        // La navegación continúa con rumbo GPS y giroscopio cuando no hay brújula.
      }
    };
    start();
    return () => {
      disposed = true;
      motionSubscription?.remove();
      headingSubscription?.remove();
      lastMotionAtRef.current = null;
      gravityRef.current = null;
    };
  }, [active]);

  return state;
}
