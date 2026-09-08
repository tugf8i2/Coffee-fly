FROM python:3.11.16-slim-trixie

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# El lock incluye también dependencias transitivas para que otro PC instale
# exactamente el mismo entorno.
COPY requirements.txt requirements.lock.txt ./
RUN python -m pip install --no-cache-dir --requirement requirements.lock.txt

COPY . .

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
