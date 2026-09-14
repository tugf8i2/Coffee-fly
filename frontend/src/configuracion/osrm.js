const configured = String(process.env.EXPO_PUBLIC_OSRM_URL || '').trim().replace(/\/+$/, '');

export const OSRM_BASE_URL = configured || 'https://router.project-osrm.org';
export const USING_PUBLIC_OSRM = !configured;
