FROM python:3.11-slim

WORKDIR /app

# Copia los archivos de requerimientos primero (Asegúrate de tener este archivo)
COPY requirements.txt .

# Instala las dependencias de Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia todo el código del backend
COPY . .

# Expone el puerto por defecto de FastAPI
EXPOSE 8000

# Comando para arrancar FastAPI usando Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
