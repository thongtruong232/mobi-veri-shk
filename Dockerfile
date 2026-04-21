FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir uvicorn
COPY . /app/

# Expose port for ASGI server
EXPOSE 8001

# Start uvicorn ASGI server (default 1 workers, overridable via UVICORN_WORKERS env)
ENV UVICORN_WORKERS=1
CMD ["sh", "-c", "uvicorn WebDjango.asgi:application --host 0.0.0.0 --port 8005 --workers ${UVICORN_WORKERS}"]
