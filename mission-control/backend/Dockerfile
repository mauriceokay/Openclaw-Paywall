# syntax=docker/dockerfile:1
# Pre-built: deps are installed on host and copied in (no network needed in build)

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN groupadd --system appgroup && useradd --system --gid appgroup --create-home appuser \
  && chown appuser:appgroup /app

# Copy pre-built venv from host and fix python symlink for container paths
COPY --chown=appuser:appgroup backend/.venv /app/.venv
RUN ln -sf /usr/local/bin/python3.12 /app/.venv/bin/python3.12 \
  && ln -sf python3.12 /app/.venv/bin/python \
  && ln -sf python3.12 /app/.venv/bin/python3 \
  && sed -i 's|home = /usr/bin|home = /usr/local/bin|' /app/.venv/pyvenv.cfg
ENV PATH="/app/.venv/bin:${PATH}"
ENV VIRTUAL_ENV="/app/.venv"
ENV PYTHONPATH="/app/.venv/lib/python3.12/site-packages"

# Copy app source
COPY --chown=appuser:appgroup backend/migrations ./migrations
COPY --chown=appuser:appgroup backend/alembic.ini ./alembic.ini
COPY --chown=appuser:appgroup backend/app ./app
COPY --chown=appuser:appgroup backend/templates ./templates
COPY --chown=appuser:appgroup scripts ./scripts

USER appuser

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
