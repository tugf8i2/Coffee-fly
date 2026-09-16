import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function Icon({ name, size = 24, color = '#124f37' }) {
  const paths = {
    turnRight: 'M3 23v-8C3 6 9 5 16 5V1l9 7-9 7v-4C8 11 9 12 9 16v7Z',
    turnLeft: 'M23 23v-8C23 6 17 5 10 5V1L1 8l9 7v-4c8 0 7 1 7 5v7Z',
    straight: 'M9 24V11H3L13 1l10 10h-6v13Z',
    roundabout: 'M7 19A9 9 0 1 1 21 8M17 3l5 5 3-6M7 19l-4 4M3 18l4 1 1 4',
    flag: 'M4 24V2M4 3h18v13H4M10 3v13M16 3v13M4 9h18',
    map: 'm2 4 7-3 8 4 7-3v20l-7 3-8-4-7 3ZM9 1v20M17 5v20',
    phone: 'M6 1 2 4q-1 13 17 20l5-4-6-6-4 4Q8 14 8 9l4-3-5-6Z',
    stop: 'M5 5h16v16H5Z',
    compass: 'm13 2 6 20-6-5-6 5Z',
    volume: 'M2 9h5l6-6v20l-6-6H2ZM17 7q8 6 0 12M17 11q3 2 0 4',
    muted: 'M2 9h5l6-6v20l-6-6H2ZM17 10l7 7M24 10l-7 7',
    target:
      'M13 1v5M13 20v5M1 13h5M20 13h5M4 13a9 9 0 1 0 18 0 9 9 0 0 0-18 0M9 13a4 4 0 1 0 8 0 4 4 0 0 0-8 0',
    plus: 'M13 3v20M3 13h20',
    minus: 'M3 13h20',
    down: 'm4 9 9 8 9-8',
    leaf: 'M3 21Q0 6 23 1q0 22-19 16M2 24 18 7',
    home: 'M3 11 12 3l9 8M5 10v11h14V10M10 21v-7h4v7',
    route: 'M5 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h10M19 18l3 3-3 3',
    box: 'm3 7 9-5 9 5v12l-9 5-9-5ZM3 7l9 5 9-5M12 12v12M7 4l10 5',
    bell: 'M5 17V9a7 7 0 0 1 14 0v8l2 3H3ZM9 23h6',
    user: 'M3 23v-3a9 9 0 0 1 18 0v3M8 6a4 4 0 1 0 8 0 4 4 0 0 0-8 0',
    truck:
      'M1 4h14v14H1ZM15 9h5l3 5v4h-8M17 11v4h5M3 19a3 3 0 1 0 6 0 3 3 0 0 0-6 0M16 19a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
    pin: 'M20 9c0 6-8 14-8 14S4 15 4 9a8 8 0 1 1 16 0ZM9 9a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
    clock: 'M12 5v7l5 3M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0',
    checklist: 'M8 4H4v19h17V4h-5M9 2h7v5H9ZM8 12h9M8 17h9',
    warning: 'm12 2 11 20H1ZM12 8v7M12 18v1',
    layers: 'm1 7 11-6 11 6-11 6ZM1 13l11 6 11-6M1 19l11 6 11-6',
    wifi: 'M2 7q10-9 20 0M5 11q7-6 14 0M8 15q4-3 8 0M11 19h2M2 2l20 20',
    check: 'm5 12 5 5L21 5',
    back: 'M21 12H3m7-7-7 7 7 7',
    right: 'm9 5 7 7-7 7',
    arrow: 'M3 12h18m-6-6 6 6-6 6',
    gear: 'M9 2h6l1 4 4 2 2 5-3 3v4l-5 2-3-2-4 2-5-3v-4l-3-3 3-5 4-1ZM8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0',
    play: 'm8 4 13 8-13 8Z',
    road: 'M7 2 2 23M17 2l5 21M12 2v5M12 11v4M12 20v3',
    tools: 'm4 3 17 18M20 2l-5 5 2 3 5-5M16 10 3 23M3 2v5l5 2 2-2-2-5Z',
    document: 'M5 1h10l5 5v17H5ZM15 1v6h5M8 12h9M8 17h9',
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path
        d={paths[name] || paths.route}
        fill={
          [
            'turnRight',
            'turnLeft',
            'straight',
            'stop',
            'compass',
            'leaf',
          ].includes(name)
            ? color
            : 'none'
        }
      />
    </Svg>
  );
}
