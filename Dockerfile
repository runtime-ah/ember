# Stage 1: Build React frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app/backend

# Install dependencies in a layer-cached step before copying source
ENV UV_PYTHON_DOWNLOADS=never
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

# Backend source
COPY backend/ .

# Built frontend — main.py resolves this as Path(__file__).parent x3 / "frontend/dist"
# i.e. /app/backend/app/main.py → /app/frontend/dist
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

VOLUME /data
ENV TODO_DATABASE_PATH=/data/todo.db

EXPOSE 8000
CMD ["/app/backend/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
