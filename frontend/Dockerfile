FROM node:22.23.2-alpine3.24 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG EXPO_PUBLIC_API_URL=/api
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN npm exec -- expo export --platform web

FROM nginx:1.30.4-alpine3.24
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
