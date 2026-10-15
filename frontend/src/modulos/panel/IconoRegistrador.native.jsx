import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

const drawings = {
  home: <><Path d="m2 11 10-9 10 9M5 10v12h14V10"/><Path d="M10 22v-8h4v8"/></>,
  people: <><Circle cx="12" cy="6" r="4"/><Circle cx="3" cy="9" r="2.5"/><Circle cx="21" cy="9" r="2.5"/><Path d="M6 23v-6a6 6 0 0 1 12 0v6ZM0 22v-6a4 4 0 0 1 5-4M24 22v-6a4 4 0 0 0-5-4"/></>,
  farmer: <><Path d="M6 7c0-8 12-8 12 0M1 8q11 5 22 0M7 12a5 5 0 0 0 10 0M3 23v-3q0-6 9-6t9 6v3M8 16v7m8-7v7"/></>,
  driver: <><Circle cx="12" cy="7" r="6"/><Path d="M6 5h12M2 24v-4q1-6 10-6t10 6v4M12 16v8m-3-8 3 3 3-3"/></>,
  truck: <><Path d="M1 3h14v15H1ZM15 9h5l3 5v4h-8"/><Circle cx="6" cy="19" r="3"/><Circle cx="19" cy="19" r="3"/><Path d="M17 11v4h5"/></>,
  coop: <><Path d="m3 5 9-4 9 4v16H3Z"/><Path d="M7 9h3v3H7Zm7 0h3v3h-3ZM10 17h4v5"/></>,
  clipboard: <><Path d="M8 4H4v19h17V4h-5M9 2h7v5H9Z M8 12h9M8 17h9"/></>,
  menu: <Path d="M2 5h20M2 12h20M2 19h20"/>,
  arrow: <Path d="M2 12h19m-6-6 6 6-6 6"/>,
  user: <><Circle cx="12" cy="6" r="4"/><Path d="M3 23v-4a9 9 0 0 1 18 0v4Z"/></>,
};

export default function IconoRegistrador({ name, size = 24, color = '#064c3b' }) {
  return <Svg width={size} height={size} viewBox="-1 -1 26 26" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{drawings[name] || drawings.people}</Svg>;
}
