import { useMemo } from 'react';
import { devicePosture, fuseNavigationHeading } from '../servicios/sensoresNavegacion';

export default function useNavigationSensors({ active, gpsHeading, speedMps }) {
  return useMemo(() => {
    const fused = fuseNavigationHeading({ gpsHeading, speedMps });
    return {
      active,
      motionAvailable: false,
      gravity: { x: 0, y: 0, z: 0 },
      rotationRate: { alpha: 0, beta: 0, gamma: 0 },
      orientation: 0,
      posture: devicePosture(0),
      headingDeg: fused.headingDeg,
      headingSource: fused.source,
      compassAccuracy: 0,
    };
  }, [active, gpsHeading, speedMps]);
}
