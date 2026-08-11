// Configuración de API que permite override en tiempo de ejecución
export const API_BASE_URL = (
  (typeof window !== 'undefined' && window.__env && window.__env.VITE_API_URL) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000'
);

export default API_BASE_URL;
