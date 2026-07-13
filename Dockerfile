# ---- stage 1: build the React SPA ----
FROM node:20-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
RUN npm run build          # outputs to /web/dist

# ---- stage 2: python runtime serving API + SPA ----
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ ./server/
COPY --from=web /web/dist ./web_dist

ENV DATA_DIR=/data \
    STATIC_DIR=/app/web_dist \
    PYTHONUNBUFFERED=1
VOLUME ["/data"]
EXPOSE 8000

CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
