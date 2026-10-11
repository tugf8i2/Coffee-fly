import { useEffect, useRef, useState } from 'react';
import { fuseNavigationHeading } from '../servicios/sensoresNavegacion';

export default function useNavigationSensors({ active, gpsHeading, speedMps }) {
  const [motion, setMotion] = useState(null);
  const [compass, setCompass] = useState(null);
  const [sensorHeading, setSensorHeading] = useState(null);
  const inputs = useRef({ gpsHeading, speedMps, compass: null, accuracy: 0, heading: null, at: null });
  inputs.current.gpsHeading = gpsHeading;
  inputs.current.speedMps = speedMps;
  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined;
    window.ReactNativeWebView?.postMessage?.('navigation_sensors_start');
    const applyHeading = (rotationRate) => {
      const now = Date.now();
      const previous = inputs.current;
      const fused = fuseNavigationHeading({
        gpsHeading: previous.gpsHeading,
        speedMps: previous.speedMps,
        compassHeading: previous.compass,
        compassAccuracy: previous.accuracy,
        previousHeading: previous.heading,
        gyroZDegPerSecond: rotationRate?.alpha,
        deltaSeconds: previous.at ? (now - previous.at) / 1000 : 0,
      });
      inputs.current.heading = fused.headingDeg;
      inputs.current.at = now;
      setSensorHeading(fused.headingDeg);
    };
    const onMotion = (event) => {
      const axes = event.accelerationIncludingGravity;
      if (axes && [axes.x, axes.y, axes.z].some((value) => value != null)) {
        setMotion({ x: axes.x, y: axes.y, z: axes.z, rotationRate: event.rotationRate });
        applyHeading(event.rotationRate);
      }
    };
    const onOrientation = (event) => {
      const heading = event.webkitCompassHeading ?? (event.alpha == null ? null : (360 - event.alpha) % 360);
      if (heading != null) {
        inputs.current.compass = heading;
        inputs.current.accuracy = 1;
        setCompass(heading);
        applyHeading();
      }
    };
    const onNativeSensor = (event) => {
      const data = event.detail;
      if (data?.type === 'motion') {
        const axes = data.gravity;
        if (axes) setMotion({ ...axes, rotationRate: data.rotationRate });
        applyHeading(data.rotationRate);
      }
      if (data?.type === 'heading' && Number.isFinite(Number(data.heading))) {
        inputs.current.compass = Number(data.heading);
        inputs.current.accuracy = Number(data.accuracy) || 1;
        setCompass(Number(data.heading));
        applyHeading();
      }
    };
    window.addEventListener('devicemotion', onMotion);
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('coffee-fly:navigation-sensors', onNativeSensor);
    return () => {
      window.ReactNativeWebView?.postMessage?.('navigation_sensors_stop');
      window.removeEventListener('devicemotion', onMotion);
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('coffee-fly:navigation-sensors', onNativeSensor);
    };
  }, [active]);
  const fused = fuseNavigationHeading({ gpsHeading, speedMps, compassHeading: compass, compassAccuracy: compass == null ? 0 : 1 });
  return {
    active,
    motionAvailable: Boolean(motion),
    gravity: motion ? { x: motion.x, y: motion.y, z: motion.z } : null,
    rotationRate: motion?.rotationRate || null,
    headingDeg: sensorHeading ?? fused.headingDeg,
    headingSource: fused.source,
  };
}
