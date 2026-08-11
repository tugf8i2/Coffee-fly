# Etapa 1: Compilar la aplicación de Vite
FROM node:20-alpine AS build
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Etapa 2: Servir los archivos estáticos con Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# copiar entrypoint que inyecta variables de entorno en runtime
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
