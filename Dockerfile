FROM node:22.23.2-alpine3.24 AS web-build
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
ARG EXPO_PUBLIC_API_URL=/api
ARG EXPO_PUBLIC_OSRM_URL=
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL \
    EXPO_PUBLIC_OSRM_URL=$EXPO_PUBLIC_OSRM_URL
RUN npm run export:web

FROM python:3.11.16-slim-trixie
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    COFFEE_FLY_STATIC_DIR=/app/static
COPY backend/requirements.txt backend/requirements.lock.txt ./
RUN python -m pip install --no-cache-dir --requirement requirements.lock.txt
COPY backend/ ./
COPY --from=web-build /web/dist /app/static
EXPOSE 8000
CMD ["sh", "-c", "PYTHONPATH=/app python scripts/bootstrap_empty_database.py && PYTHONPATH=/app alembic upgrade head && exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
