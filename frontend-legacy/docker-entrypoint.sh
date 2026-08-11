#!/bin/sh
# Genera un archivo JS con la configuración de entorno para el frontend
cat > /usr/share/nginx/html/env-config.js <<EOF
window.__env = {
  VITE_API_URL: "${VITE_API_URL:-http://localhost:8000}"
};
EOF

# Ejecutar nginx en primer plano
exec nginx -g 'daemon off;'
