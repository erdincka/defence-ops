FROM --platform=linux/amd64 python:3.12-slim AS base
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /bin/uv

RUN groupadd -g 10001 app && useradd -u 10001 -g app -M -d /app app
WORKDIR /app

# Dependencies exactly as locked, in a virtualenv outside the app folder
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH=/opt/venv/bin:$PATH PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app
COPY video-service/pyproject.toml video-service/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY --chown=10001:10001 common/ ./common/
COPY --chown=10001:10001 video-service/main.py ./

# Bake the sample footage into the image
COPY assets/videos/ ./assets/videos/
# The app user owns the code so that Tilt's live update can replace it
RUN chown app:app /app
USER 10001

EXPOSE 8000

# Tilt's dev loop: reloads on every synced change
FROM base AS dev
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --reload

# Production, the default target (last, so a plain docker build builds it)
FROM base AS prod
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
