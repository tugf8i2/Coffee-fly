import React from 'react';

export default function Icon({ name, size = 24, ...props }) {
  const shapes = {
    home: <><path d="m2 11 10-9 10 9M5 10v12h14V10"/><path d="M10 22v-8h4v8"/></>,
    people: <><circle cx="12" cy="6" r="4"/><circle cx="3" cy="9" r="2.5"/><circle cx="21" cy="9" r="2.5"/><path d="M6 23v-6a6 6 0 0 1 12 0v6ZM0 22v-6a4 4 0 0 1 5-4M24 22v-6a4 4 0 0 0-5-4"/></>,
    farmer: <><path d="M6 7c0-8 12-8 12 0M1 8q11 5 22 0M7 12a5 5 0 0 0 10 0M3 23v-3q0-6 9-6t9 6v3M8 16v7m8-7v7"/></>,
    driver: <><circle cx="12" cy="7" r="6"/><path d="M6 5h12M2 24v-4q1-6 10-6t10 6v4M12 16v8m-3-8 3 3 3-3"/></>,
    truck: <><path d="M1 3h14v15H1ZM15 9h5l3 5v4h-8"/><circle cx="6" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M17 11v4h5"/></>,
    coop: <><path d="m3 5 9-4 9 4v16H3Z"/><path d="M7 9h3v3H7Zm7 0h3v3h-3ZM10 17h4v5"/></>,
    file: <><path d="M5 1h11l4 4v18H5ZM15 1v6h5M8 11h9M8 15h9M8 19h6"/></>,
    clipboard: <><path d="M8 4H4v19h17V4h-5M9 2h7v5H9Z M8 12h9M8 17h9"/></>,
    pin: <><path d="M20 9c0 6-8 14-8 14S4 15 4 9a8 8 0 1 1 16 0Z"/><circle cx="12" cy="9" r="3"/></>,
    gear: <><path d="m9 1 6 0 1 4 4 1 3 5-3 3v5l-5 3-3-2-4 2-5-3v-5l-3-3 3-5 4-1Z"/><circle cx="12" cy="12" r="4"/></>,
    bell: <><path d="M5 16V9a7 7 0 0 1 14 0v7l3 3H2ZM9 22h6M12 0v3"/></>,
    menu: <path d="M2 5h20M2 12h20M2 19h20"/>,
    arrow: <path d="M2 12h19m-6-6 6 6-6 6"/>,
    chevron: <path d="m5 9 7 7 7-7"/>,
    clock: <><circle cx="12" cy="12" r="10"/><path d="M12 5v7l5 3"/></>,
    pulse: <path d="M0 12h6l3-10 5 20 3-10h7"/>,
    database: <><ellipse cx="12" cy="4" rx="8" ry="3"/><path d="M4 4v15c0 4 16 4 16 0V4M4 11c0 4 16 4 16 0"/></>,
    leaf: <><path d="M2 20C-1 3 14 6 23 1c0 16-8 23-18 16M0 24 19 7"/></>,
    user: <><circle cx="12" cy="6" r="4"/><path d="M3 23v-4a9 9 0 0 1 18 0v4Z"/></>,
  };
  return <svg width={size} height={size} viewBox="-1 -1 26 26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{shapes[name] || shapes.people}</svg>;
}
