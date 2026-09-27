import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';

import { devicePosture, fuseNavigationHeading } from '../servicios/sensoresNavegacion';

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
  inputsRef.current = { gpsHeading, speedMps };

  useEffect(() => {
    if (Number(speedMps) >= 1.5 && Number.isFinite(Number(gpsHeading))) {
      headingRef.current = Number(gpsHeading);
    }
  }, [gpsHeading, speedMps]);

  useEffect(() => {
    if (!active) {
      setState((current) => ({ ...INITIAL_STATE, headingDeg: current.headingDeg }));
      return undefined;
    }

    let disposed = false;
    let motionSubscription;
    let headingSubscription;
    const applyHeading = (rotationRate = {}, now = Date.now()) => {
      const previousAt = lastMotionAtRef.current;
      lastMotionAtRef.current = now;
      const fused = fuseNavigationHeading({
        gpsHeading: inputsRef.current.gpsHeading,
        speedMps: inputsRef.current.speedMps,
        compassHeading: compassRef.current.heading,
        compassAccuracy: compassRef.current.accuracy,
        previousHeading: headingRef.current,
        gyroZDegPerSecond: rotationRate.alpha,
        deltaSeconds: previousAt ? (now - previousAt) / 1000 : 0,
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
              const gravity = measurement.accelerationIncludingGravity || INITIAL_STATE.gravity;
              const rotationRate = measurement.rotationRate || INITIAL_STATE.rotationRate;
              const fused = applyHeading(rotationRate);
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
          const fused = applyHeading();
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
    };
  }, [active]);

  return state;
}
